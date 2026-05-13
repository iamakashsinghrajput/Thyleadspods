import { connectDB } from "@/lib/mongodb";
import InboxThread from "@/lib/models/inbox-thread";
import InboxMessage from "@/lib/models/inbox-message";
import InboxSyncState from "@/lib/models/inbox-sync-state";
import {
  fetchAllCampaigns,
  fetchCampaign,
  fetchCampaignLeads,
  fetchLead,
  fetchLeadMessageHistory,
  fetchLeadCategories,
  invalidateSmartleadCache,
  type SmartleadMessageHistoryItem,
  type SmartleadLeadRow,
} from "@/lib/smartlead";

// Webhooks are the primary source of fresh data; the full poll-sync is only a
// backstop in case a webhook is missed. So allow data to age 6h before the
// next idle GET kicks one off.
export const INBOX_STALE_MS = 6 * 60 * 60_000;
const HEARTBEAT_TIMEOUT_MS = 2 * 60_000;
const HEARTBEAT_INTERVAL_MS = 20_000;
const LEADS_PAGE_SIZE = 100;
const MAX_LEAD_PAGES_PER_CAMPAIGN = 50;
const PER_CAMPAIGN_HISTORY_CONCURRENCY = 3;

const ENGAGED_STATUSES = new Set([
  "REPLIED",
  "INTERESTED",
  "NOT_INTERESTED",
  "MEETING_BOOKED",
  "MEETING_COMPLETED",
  "OUT_OF_OFFICE",
  "WRONG_PERSON",
  "DO_NOT_CONTACT",
]);

function asAny(v: unknown): Record<string, unknown> {
  return (v as Record<string, unknown>) || {};
}

function isEngaged(row: SmartleadLeadRow): boolean {
  const m = asAny(row.campaign_lead_map);
  const r = asAny(row);
  const status = String(m.status || r.status || "").toUpperCase();
  if (status && ENGAGED_STATUSES.has(status)) return true;
  if (m.is_replied === true || r.is_replied === true) return true;
  if (m.replied === true || r.replied === true) return true;
  if (m.has_replied === true || r.has_replied === true) return true;
  if (m.lead_category_id != null) return true;
  if (r.lead_category_id != null) return true;
  if (m.last_replied_at || r.last_replied_at) return true;
  if (m.last_reply_received_at || r.last_reply_received_at) return true;
  if (m.reply_received_at || r.reply_received_at) return true;
  const replyCount = Number(m.total_replied_count ?? r.total_replied_count ?? 0);
  if (Number.isFinite(replyCount) && replyCount > 0) return true;
  return false;
}

function makeThreadKey(leadId: number, campaignId: number) {
  return `${leadId}:${campaignId}`;
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function previewFromHtml(html: string, max = 240): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function isReplyType(type: string | undefined): boolean {
  if (!type) return false;
  const t = type.toString().toUpperCase();
  return t === "REPLY" || t === "RECEIVED" || t === "INBOUND" || t.includes("REPLY");
}

function statusOf(row: SmartleadLeadRow): string {
  return ((row.campaign_lead_map?.status as string) || "").toUpperCase();
}

export async function getSyncState() {
  await connectDB();
  let state = await InboxSyncState.findOne({ key: "global" });
  if (!state) state = await InboxSyncState.create({ key: "global" });
  return state;
}

export function isStale(lastSyncedAt: Date | null | undefined) {
  if (!lastSyncedAt) return true;
  return Date.now() - new Date(lastSyncedAt).getTime() > INBOX_STALE_MS;
}

async function tryAcquireSyncLock(): Promise<boolean> {
  await connectDB();
  const heartbeatCutoff = new Date(Date.now() - HEARTBEAT_TIMEOUT_MS);
  const now = new Date();
  const res = await InboxSyncState.updateOne(
    {
      key: "global",
      $or: [
        { syncingAt: null },
        { heartbeatAt: null },
        { heartbeatAt: { $lt: heartbeatCutoff } },
      ],
    },
    {
      $set: {
        syncingAt: now,
        heartbeatAt: now,
        cancelRequested: false,
        progress: { stage: "starting", campaignsTotal: 0, campaignsProcessed: 0, currentCampaign: "", leadsScanned: 0, threadsPersisted: 0 },
        lastError: "",
      },
    },
    { upsert: true },
  );
  return (res.upsertedCount || 0) > 0 || (res.modifiedCount || 0) > 0;
}

async function releaseSyncLock(error?: string) {
  await connectDB();
  await InboxSyncState.updateOne(
    { key: "global" },
    { $set: { syncingAt: null, heartbeatAt: null, cancelRequested: false, lastError: error || "" } },
  );
}

async function isCancelled(): Promise<boolean> {
  await connectDB();
  const doc = await InboxSyncState.findOne({ key: "global" }).select("cancelRequested").lean<{ cancelRequested?: boolean }>();
  return !!doc?.cancelRequested;
}

export async function requestSyncCancel(): Promise<void> {
  await connectDB();
  await InboxSyncState.updateOne(
    { key: "global" },
    { $set: { cancelRequested: true } },
  );
}

async function heartbeat(progress?: Record<string, unknown>) {
  await connectDB();
  const set: Record<string, unknown> = { heartbeatAt: new Date() };
  if (progress) {
    for (const [k, v] of Object.entries(progress)) set[`progress.${k}`] = v;
  }
  await InboxSyncState.updateOne({ key: "global" }, { $set: set });
}

async function persistThreadFromMessages(args: {
  leadId: number;
  campaignId: number;
  campaignName: string;
  campaignStatus: string;
  lead: NonNullable<SmartleadLeadRow["lead"]>;
  leadStatus: string;
  category: string;
  messages: SmartleadMessageHistoryItem[];
}): Promise<boolean> {
  const { leadId, campaignId, campaignName, campaignStatus, lead, leadStatus, category, messages } = args;
  const threadKey = makeThreadKey(leadId, campaignId);
  const replyMessages = messages.filter((m) => isReplyType(m.type));
  if (replyMessages.length === 0) return false;

  await connectDB();

  const msgOps = messages.map((m, idx) => {
    const messageId = m.message_id || m.stats_id || `${leadId}-${campaignId}-${idx}`;
    const time = parseDate(m.time);
    return InboxMessage.updateOne(
      { messageId },
      {
        $set: {
          messageId,
          threadKey,
          leadId,
          campaignId,
          time,
          type: m.type || "",
          subject: m.subject || "",
          body: m.email_body || "",
          fromEmail: m.from || "",
          toEmail: m.to || "",
          openCount: m.open_count || 0,
          clickCount: m.click_count || 0,
          syncedAt: new Date(),
        },
      },
      { upsert: true },
    );
  });
  await Promise.all(msgOps);

  const lastReply = replyMessages[replyMessages.length - 1];
  const lastReplyAt = parseDate(lastReply?.time) || new Date();

  await InboxThread.updateOne(
    { threadKey },
    {
      $set: {
        threadKey,
        leadId,
        campaignId,
        campaignName,
        campaignStatus,
        leadFirstName: lead.first_name || "",
        leadLastName: lead.last_name || "",
        leadEmail: lead.email || lastReply?.from || "",
        leadCompany: lead.company_name || "",
        leadTitle: lead.job_title || "",
        leadPhone: lead.phone_number || "",
        leadStatus,
        category,
        replyCount: replyMessages.length,
        lastReplyAt,
        lastReplyPreview: previewFromHtml(lastReply?.email_body || ""),
        lastReplySubject: lastReply?.subject || "",
        syncedAt: new Date(),
        messageHistorySyncedAt: new Date(),
      },
    },
    { upsert: true },
  );
  return true;
}

async function mapLimitedLocal<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      try { results[idx] = await fn(items[idx]); }
      catch { results[idx] = undefined as unknown as R; }
    }
  });
  await Promise.all(workers);
  return results;
}

const CAMPAIGN_PARALLELISM = 4;

export async function syncMasterInbox(): Promise<{ campaigns: number; threads: number; skipped?: boolean; cancelled?: boolean; error?: string }> {
  const acquired = await tryAcquireSyncLock();
  if (!acquired) return { campaigns: 0, threads: 0, skipped: true };

  let totalThreads = 0;
  let processedCampaigns = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  try {
    heartbeatTimer = setInterval(() => { void heartbeat(); }, HEARTBEAT_INTERVAL_MS);

    const [campaigns, categories] = await Promise.all([
      fetchAllCampaigns(),
      fetchLeadCategories().catch(() => []),
    ]);
    const categoryById = new Map<number, string>();
    for (const c of categories) {
      if (c.id !== undefined && c.name) categoryById.set(Number(c.id), c.name);
    }

    const active = campaigns.filter((c) => c.id !== undefined && (c.status || "").toLowerCase() !== "drafted");
    await heartbeat({ stage: "scanning", campaignsTotal: active.length, campaignsProcessed: 0 });

    // Pre-load every threadKey we already have. Skipping these in the engaged
    // loop eliminates the bulk of message-history calls (which is what
    // dominates the sync time).
    await connectDB();
    const existingDocs = await InboxThread.find({}).select("threadKey").lean<{ threadKey: string }[]>();
    const existingKeys = new Set(existingDocs.map((d) => d.threadKey));
    console.log(`[inbox-sync] existing threads in DB: ${existingKeys.size}`);

    async function processCampaign(campaign: { id?: number | string; name?: string; status?: string }) {
      if (campaign.id === undefined) return;
      if (await isCancelled()) return;
      const campaignId = Number(campaign.id);
      const campaignName = campaign.name || `Campaign ${campaignId}`;
      const campaignStatus = campaign.status || "";

      // Page through leads, collect engaged + new.
      const engagedNew: SmartleadLeadRow[] = [];
      let totalLeadsThisCampaign = 0;
      for (let page = 0; page < MAX_LEAD_PAGES_PER_CAMPAIGN; page++) {
        if (await isCancelled()) return;
        let resp;
        try {
          resp = await fetchCampaignLeads(String(campaignId), { limit: LEADS_PAGE_SIZE, offset: page * LEADS_PAGE_SIZE });
        } catch (e) {
          console.warn(`[inbox-sync] leads fetch failed for campaign ${campaignId} page ${page}:`, e);
          break;
        }
        const rows = resp.data || [];
        if (rows.length === 0) break;
        totalLeadsThisCampaign += rows.length;
        for (const row of rows) {
          if (!isEngaged(row)) continue;
          const leadId = Number(row.lead?.id);
          if (!Number.isFinite(leadId)) continue;
          if (existingKeys.has(makeThreadKey(leadId, campaignId))) continue; // already have it
          engagedNew.push(row);
        }
        if (rows.length < LEADS_PAGE_SIZE) break;
      }

      console.log(`[inbox-sync] campaign ${campaignId} "${campaignName}": ${totalLeadsThisCampaign} leads, ${engagedNew.length} new engaged`);

      if (engagedNew.length === 0) return;

      await mapLimitedLocal(engagedNew, PER_CAMPAIGN_HISTORY_CONCURRENCY, async (row) => {
        if (await isCancelled()) return;
        const lead = row.lead;
        if (!lead?.id) return;
        const leadId = Number(lead.id);
        const leadStatus = statusOf(row);
        const catId = row.campaign_lead_map?.lead_category_id ?? row.lead_category_id ?? null;
        const category = catId !== null && catId !== undefined ? (categoryById.get(Number(catId)) || "") : "";
        try {
          const messages = await fetchLeadMessageHistory(String(campaignId), String(leadId));
          const persisted = await persistThreadFromMessages({
            leadId,
            campaignId,
            campaignName,
            campaignStatus,
            lead,
            leadStatus,
            category,
            messages,
          });
          if (persisted) {
            totalThreads++;
            existingKeys.add(makeThreadKey(leadId, campaignId));
            await heartbeat({ threadsPersisted: totalThreads });
          }
        } catch {
          // Skip this lead; sync continues.
        }
      });
    }

    // Process campaigns in parallel — bounded by CAMPAIGN_PARALLELISM. Each
    // worker also respects the global rate budget + 6-concurrency request cap.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CAMPAIGN_PARALLELISM, active.length) }, async () => {
      while (cursor < active.length) {
        const idx = cursor++;
        const campaign = active[idx];
        try {
          await heartbeat({ currentCampaign: campaign.name || `Campaign ${campaign.id}` });
          await processCampaign(campaign);
        } catch (e) {
          console.warn(`[inbox-sync] campaign worker error:`, e);
        }
        processedCampaigns++;
        await heartbeat({ campaignsProcessed: processedCampaigns });
      }
    });
    await Promise.all(workers);

    await connectDB();
    await InboxSyncState.updateOne(
      { key: "global" },
      {
        $set: {
          lastSyncedAt: new Date(),
          lastSyncedCampaignCount: active.length,
          lastSyncedThreadCount: totalThreads,
          lastError: "",
        },
      },
    );
    await releaseSyncLock();
    return { campaigns: active.length, threads: totalThreads };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await releaseSyncLock(msg);
    return { campaigns: 0, threads: totalThreads, error: msg };
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

function parseFromAddress(raw: string | undefined): { email: string; first: string; last: string } {
  const s = (raw || "").trim();
  if (!s) return { email: "", first: "", last: "" };
  const m = s.match(/^(?:"?([^"<]+?)"?\s*)?<([^>]+)>$/);
  let email = s;
  let name = "";
  if (m) { name = (m[1] || "").trim(); email = m[2].trim(); }
  else if (s.includes("@")) email = s;
  const [first = "", ...rest] = name.split(/\s+/);
  return { email, first, last: rest.join(" ") };
}

export async function syncThreadMessages(leadId: number, campaignId: number, opts?: { force?: boolean }): Promise<{ messages: number; error?: string }> {
  try {
    const threadKey = makeThreadKey(leadId, campaignId);
    if (opts?.force) {
      // Bust both L1 (memory) and L2 (Mongo) caches for this thread's history
      // so the upcoming fetch hits Smartlead live and sees the new reply.
      await invalidateSmartleadCache(`/campaigns/${campaignId}/leads/${leadId}/message-history`).catch(() => {});
    }
    const history = await fetchLeadMessageHistory(String(campaignId), String(leadId), { force: !!opts?.force });
    if (history.length === 0) {
      await connectDB();
      await InboxThread.updateOne(
        { threadKey },
        { $set: { messageHistorySyncedAt: new Date() } },
      );
      return { messages: 0 };
    }

    await connectDB();
    const ops = history.map((m: SmartleadMessageHistoryItem, idx) => {
      const messageId = m.message_id || m.stats_id || `${leadId}-${campaignId}-${idx}`;
      const time = parseDate(m.time);
      return InboxMessage.updateOne(
        { messageId },
        {
          $set: {
            messageId,
            threadKey,
            leadId,
            campaignId,
            time,
            type: m.type || "",
            subject: m.subject || "",
            body: m.email_body || "",
            fromEmail: m.from || "",
            toEmail: m.to || "",
            openCount: m.open_count || 0,
            clickCount: m.click_count || 0,
            syncedAt: new Date(),
          },
        },
        { upsert: true },
      );
    });
    await Promise.all(ops);

    const replyMessages = history.filter((m) => isReplyType(m.type));
    const last = replyMessages[replyMessages.length - 1] || history[history.length - 1];

    // If this thread doesn't exist yet (webhook fired for a brand-new lead),
    // fetch real campaign + lead info from Smartlead so it appears in the UI
    // with proper names instead of placeholders.
    const existing = await InboxThread.findOne({ threadKey }).lean<{ leadEmail?: string }>();
    const setFields: Record<string, unknown> = {
      threadKey,
      leadId,
      campaignId,
      messageHistorySyncedAt: new Date(),
      lastReplyPreview: previewFromHtml(last?.email_body || ""),
      lastReplySubject: last?.subject || "",
      replyCount: replyMessages.length || 1,
      lastReplyAt: parseDate(last?.time) || new Date(),
      syncedAt: new Date(),
    };
    if (!existing) {
      const leadFromAddr = parseFromAddress(replyMessages[0]?.from || last?.from);
      const [campaignMeta, leadMeta] = await Promise.all([
        fetchCampaign(String(campaignId)).catch(() => null),
        fetchLead(String(leadId)).catch(() => null),
      ]);
      setFields.campaignName = campaignMeta?.name || `Campaign ${campaignId}`;
      setFields.campaignStatus = campaignMeta?.status || "";
      setFields.leadEmail = leadMeta?.email || leadFromAddr.email;
      setFields.leadFirstName = leadMeta?.first_name || leadFromAddr.first;
      setFields.leadLastName = leadMeta?.last_name || leadFromAddr.last;
      setFields.leadCompany = leadMeta?.company_name || "";
      setFields.leadTitle = leadMeta?.job_title || "";
      setFields.leadPhone = leadMeta?.phone_number || "";
    }
    await InboxThread.updateOne({ threadKey }, { $set: setFields }, { upsert: true });

    return { messages: history.length };
  } catch (e) {
    return { messages: 0, error: e instanceof Error ? e.message : "Sync failed" };
  }
}
