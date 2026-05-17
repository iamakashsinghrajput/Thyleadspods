"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X, Plus, Pencil, Check, Download, Calendar, Megaphone, Building2, Loader2, UploadCloud, Link2, Ban, CheckCircle2, AlertTriangle, Save, ListX, RefreshCw, ChevronDown } from "lucide-react";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-context";
import { usePods } from "@/lib/pod-context";
import { useSidebar } from "@/lib/sidebar-context";
import type { ClientDetail, MeetingStatus } from "@/lib/client-data";
import { fireSideCannons } from "@/lib/confetti-side-cannons";
import ConfirmDelete from "@/components/confirm-delete";
import CampaignDetails from "@/components/client/campaign-details";

const inputClass = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]";

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GEO_OPTIONS = ["India", "US", "UK", "UAE", "Canada", "Australia", "APAC", "EMEA", "Global"];

const contactCols = [
  { label: "Meeting ID", short: "ID", bp: 100, w: 110 },
  { label: "Month", short: "Mon", bp: 90, w: 100 },
  { label: "Meeting Date", short: "Date", bp: 120, w: 130 },
  { label: "Meeting Time", short: "Time", bp: 120, w: 120 },
  { label: "Company Name", short: "Company", bp: 130, w: 150 },
  { label: "Geo", short: "Geo", bp: 80, w: 90 },
  { label: "Thyleads Rep", short: "Rep", bp: 110, w: 140 },
  { label: "Account Manager", short: "AM", bp: 130, w: 140 },
  { label: "Meeting Status", short: "Status", bp: 120, w: 120 },
  { label: "Meeting Link", short: "Link", bp: 100, w: 100 },
  { label: "Contact Name", short: "Contact", bp: 120, w: 140 },
  { label: "Contact Title", short: "Title", bp: 110, w: 140 },
  { label: "Contact Email", short: "Email", bp: 120, w: 190 },
  { label: "Contact Number", short: "Phone", bp: 120, w: 150 },
];

function useResizableCols(defaults: number[]) {
  const [widths, setWidths] = useState(defaults);
  const dragRef = useRef<{ i: number; startX: number; startW: number } | null>(null);

  const onMouseDown = useCallback((i: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { i, startX: e.clientX, startW: widths[i] };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      setWidths((prev) => { const next = [...prev]; next[dragRef.current!.i] = Math.max(70, dragRef.current!.startW + diff); return next; });
    };
    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [widths]);

  return { widths, onMouseDown };
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { pods, podMap } = usePods();
  const { projects, details, addDetail, updateDetail, deleteDetail, updateProject } = useData();
  const { addNotification } = useNotifications();

  const isPod = user?.role === "pod" || user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const contactResize = useResizableCols(contactCols.map((c) => c.w));
  const project = projects.find((p) => p.id === id);
  const records = useMemo(() => details[id] ?? [], [details, id]);
  const clientName = project?.clientName ?? records[0]?.clientName ?? "Unknown Client";
  const podLabel = project?.assignedPod ? (podMap[project.assignedPod]?.name ?? "") : "";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>(() => new Date().toLocaleString("en-US", { month: "long" }));
  const availableMonths = useMemo(() => {
    const currentMonth = new Date().toLocaleString("en-US", { month: "long" });
    return [...new Set([currentMonth, ...records.map((r) => r.month)])];
  }, [records]);
  const [showDetailForm, setShowDetailForm] = useState(false);
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [detailForm, setDetailForm] = useState(() => ({
    month: new Date().toLocaleString("en-US", { month: "long" }),
    year: String(new Date().getFullYear()),
    geo: "India",
    salesRep: user?.name || "",
    meetingDate: "", meetingTime: "", meetingStatus: "scheduled" as MeetingStatus, meetingLink: "",
    companyName: "", contactName: "", contactTitle: "", contactEmail: "", contactNumber: "",
  }));
  const [viewMeeting, setViewMeeting] = useState<ClientDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"meetings" | "campaigns" | "accounts">("meetings");
  const { setCollapsed: setMainSidebarCollapsed } = useSidebar();
  useEffect(() => { setMainSidebarCollapsed(true); }, [setMainSidebarCollapsed]);
  const [campaignFilterSlot, setCampaignFilterSlot] = useState<HTMLDivElement | null>(null);
  const [popupRemarks, setPopupRemarks] = useState("");
  const [popupAdditionalInfo, setPopupAdditionalInfo] = useState("");
  const [popupSummary, setPopupSummary] = useState("");
  const [clientRemarks, setClientRemarks] = useState<Record<string, { remark: string; updatedAt: string; updatedBy: string }>>({});
  const [celebration, setCelebration] = useState<string | null>(null);
  const [smartleadIdsDraft, setSmartleadIdsDraft] = useState("");
  const [smartleadSaving, setSmartleadSaving] = useState(false);
  const [smartleadSavedAt, setSmartleadSavedAt] = useState(false);
  const [smartleadPickerOpen, setSmartleadPickerOpen] = useState(false);
  const [smartleadPickerLoading, setSmartleadPickerLoading] = useState(false);
  const [smartleadPickerError, setSmartleadPickerError] = useState("");
  const [smartleadPickerQuery, setSmartleadPickerQuery] = useState("");
  const [smartleadPickerStatus, setSmartleadPickerStatus] = useState<"all" | "active" | "paused" | "completed" | "other">("all");
  const [smartleadPickerCampaigns, setSmartleadPickerCampaigns] = useState<Array<{ id: number; name: string; status: string }>>([]);
  const smartleadCurrent = (project?.smartleadCampaignIds || []).join(", ");
  const [smartleadCurrentSnapshot, setSmartleadCurrentSnapshot] = useState(smartleadCurrent);
  if (smartleadCurrentSnapshot !== smartleadCurrent) {
    setSmartleadCurrentSnapshot(smartleadCurrent);
    setSmartleadIdsDraft(smartleadCurrent);
  }
  const smartleadDirty = smartleadIdsDraft.trim() !== smartleadCurrent;
  const selectedSmartleadIds = useMemo(
    () => new Set(smartleadIdsDraft.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)),
    [smartleadIdsDraft],
  );
  async function saveSmartleadIds() {
    if (!project) return;
    setSmartleadSaving(true);
    const ids = smartleadIdsDraft.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
    await Promise.resolve(updateProject(project.id, { smartleadCampaignIds: ids }));
    setSmartleadSaving(false);
    setSmartleadSavedAt(true);
    setTimeout(() => setSmartleadSavedAt(false), 2500);
  }
  async function openSmartleadPicker() {
    if (!user?.email) return;
    setSmartleadPickerOpen(true);
    setSmartleadPickerError("");
    setSmartleadPickerLoading(true);
    setSmartleadPickerQuery(project?.clientName || "");
    setSmartleadPickerStatus("all");
    try {
      const res = await fetch(`/api/smartlead/campaigns?actor=${encodeURIComponent(user.email)}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setSmartleadPickerError(data.error || "Failed to load campaigns");
        setSmartleadPickerCampaigns([]);
      } else {
        setSmartleadPickerCampaigns((data.campaigns || []).map((c: { id: number; name: string; status: string }) => ({ id: c.id, name: c.name, status: c.status })));
      }
    } catch (e) {
      setSmartleadPickerError(e instanceof Error ? e.message : "Network error");
    }
    setSmartleadPickerLoading(false);
  }
  function toggleSmartleadId(id: string) {
    const ids = new Set(smartleadIdsDraft.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    setSmartleadIdsDraft(Array.from(ids).join(", "));
  }
  function setSmartleadSelection(ids: string[]) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    setSmartleadIdsDraft(unique.join(", "));
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/portal/meetings?projectId=${id}`);
        const data = await res.json();
        if (!ignore) setClientRemarks(data.remarks || {});
      } catch {}
    })();
    return () => { ignore = true; };
  }, [id]);

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (monthFilter && r.month !== monthFilter) return false;
      if (statusFilter !== "all" && r.meetingStatus !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.contactName.toLowerCase().includes(q) || r.salesRep.toLowerCase().includes(q) ||
          r.geo.toLowerCase().includes(q) || r.companyName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [records, search, monthFilter, statusFilter]);

  const monthCounts = useMemo(() => {
    const scope = records.filter((r) => !monthFilter || r.month === monthFilter);
    return {
      done: scope.filter((r) => r.meetingStatus === "done").length,
      scheduled: scope.filter((r) => r.meetingStatus === "scheduled").length,
      pipeline: scope.filter((r) => r.meetingStatus === "pipeline").length,
      total: scope.length,
    };
  }, [records, monthFilter]);

  function resetDetailForm() {
    setDetailForm({
      month: new Date().toLocaleString("en-US", { month: "long" }),
      year: String(new Date().getFullYear()),
      geo: "India",
      salesRep: user?.name || "",
      meetingDate: "", meetingTime: "", meetingStatus: "scheduled" as MeetingStatus, meetingLink: "",
      companyName: "", contactName: "", contactTitle: "", contactEmail: "", contactNumber: "",
    });
    setShowDetailForm(false);
    setEditingDetailId(null);
  }

  function handleSaveDetail() {
    const payload = {
      month: detailForm.month, year: Number(detailForm.year), clientName,
      geo: detailForm.geo, salesRep: detailForm.salesRep, meetingDate: detailForm.meetingDate,
      meetingTime: detailForm.meetingTime, meetingStatus: detailForm.meetingStatus, meetingLink: detailForm.meetingLink,
      companyName: detailForm.companyName, contactName: detailForm.contactName, contactTitle: detailForm.contactTitle,
      contactEmail: detailForm.contactEmail, contactNumber: detailForm.contactNumber,
    };
    const wasNew = !editingDetailId;
    if (editingDetailId) {
      updateDetail(id, editingDetailId, payload);
    } else {
      const uuid = crypto.randomUUID();
      const newId = `d${uuid}`;
      const meetingId = `MTG-${uuid.slice(0, 4).toUpperCase()}`;
      addDetail(id, { id: newId, meetingId, ...payload, accountManager: "", remarks: "", additionalInfo: "", meetingSummary: "" });
    }
    resetDetailForm();
    const canCelebrate = user?.role === "pod" || user?.role === "admin" || user?.role === "superadmin";
    if (wasNew && canCelebrate) {
      const target = project?.monthlyTargetInternal || 0;
      let message: string;
      if (payload.meetingStatus === "done") {
        const newDoneCount = monthCounts.done + 1;
        const remaining = Math.max(0, target - newDoneCount);
        if (target === 0) {
          message = `${newDoneCount} done — keep going!`;
        } else if (remaining === 0) {
          message = `${newDoneCount} done · target hit! 🏆`;
        } else if (remaining === 1) {
          message = `${newDoneCount} done · just 1 more to go!`;
        } else {
          message = `${newDoneCount} done · ${remaining} more to go, keep it up!`;
        }
      } else if (payload.meetingStatus === "scheduled") {
        const upcoming = monthCounts.scheduled + 1;
        message = `${upcoming} scheduled · keep filling the calendar!`;
      } else if (payload.meetingStatus === "pipeline") {
        const pipelineNow = monthCounts.pipeline + 1;
        message = `${pipelineNow} in pipeline · keep building momentum!`;
      } else {
        message = `Meeting added — keep it up!`;
      }
      fireSideCannons(3000);
      setCelebration(message);
      setTimeout(() => setCelebration(null), 3500);
    }
  }

  function startEditDetail(d: ClientDetail) {
    setEditingDetailId(d.id);
    setDetailForm({
      month: d.month, year: String(d.year), geo: d.geo, salesRep: d.salesRep,
      meetingDate: d.meetingDate, meetingTime: d.meetingTime, meetingStatus: d.meetingStatus, meetingLink: d.meetingLink,
      companyName: d.companyName, contactName: d.contactName, contactTitle: d.contactTitle,
      contactEmail: d.contactEmail, contactNumber: d.contactNumber,
    });
    setShowDetailForm(true);
  }

  function openMeetingPopup(d: ClientDetail) {
    setViewMeeting(d);
    setPopupRemarks(d.remarks || "");
    setPopupAdditionalInfo(d.additionalInfo || "");
    setPopupSummary(d.meetingSummary || "");
  }

  function saveMeetingExtras() {
    if (!viewMeeting) return;
    updateDetail(id, viewMeeting.id, { remarks: popupRemarks, additionalInfo: popupAdditionalInfo, meetingSummary: popupSummary });
    setViewMeeting(null);
  }

  function handleDeleteDetail(d: ClientDetail) {
    deleteDetail(id, d.id);
    if (isPod) addNotification(`${podLabel} deleted a contact for ${clientName} (${d.contactName})`, "admin");
  }

  function escapeCsv(val: string) {
    if (!val) return "";
    if (val.includes(",") || val.includes('"') || val.includes("\n")) return '"' + val.replace(/"/g, '""') + '"';
    return val;
  }

  function downloadCsv(filename: string, headers: string[], rows: string[][]) {
    const csv = [headers.join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMeetings() {
    const headers = ["Meeting ID", "Month", "Year", "Client Name", "Geo", "Thyleads Rep", "Account Manager", "Meeting Date", "Meeting Time", "Meeting Status", "Meeting Link", "Company Name", "Contact Name", "Contact Title", "Contact Email", "Contact Number", "Remarks", "Additional Info", "Meeting Summary"];
    const rows = filtered.map((r) => [
      r.meetingId, r.month, String(r.year), r.clientName, r.geo, r.salesRep, r.accountManager || "", r.meetingDate, r.meetingTime, r.meetingStatus, r.meetingLink, r.companyName, r.contactName, r.contactTitle, r.contactEmail, r.contactNumber, r.remarks || "", r.additionalInfo || "", r.meetingSummary || "",
    ]);
    downloadCsv(`${clientName.replace(/\s+/g, "_")}_meetings.csv`, headers, rows);
  }

  return (
    <div className="min-h-full">
      {celebration && <CelebrationBanner message={celebration} onClose={() => setCelebration(null)} />}
      <div className="px-8 pt-8 pb-4">
        <button onClick={() => router.push("/")} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-[#6800FF] transition-colors mb-4">
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{clientName}</h1>
            <p className="text-sm text-slate-400 mt-0.5 font-mono">{project?.clientId}</p>
          </div>
          {project?.assignedMembers && project.assignedMembers.length > 0 && (
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Handled by</span>
              {project.assignedMembers.map((m) => (
                <span key={m} className="inline-flex items-center px-2 py-0.5 bg-violet-50 border border-violet-200 text-violet-700 rounded-md text-xs font-semibold">{m}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="pb-8 flex items-stretch min-h-[calc(100vh-200px)]">
        <aside className="w-60 shrink-0 border-r-2 border-slate-300 bg-slate-50/60 pl-8 pr-6 pt-4 shadow-[inset_-1px_0_0_rgba(15,23,42,0.04)]">
          <div className="sticky top-4">
            <div className="px-2 pb-2 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">Sections</div>
            <nav className="space-y-0.5">
              {([
                { key: "meetings" as const, label: "Meeting Details", icon: Calendar, count: records.length },
                { key: "campaigns" as const, label: "Campaign Details", icon: Megaphone, count: (project?.smartleadCampaignIds || []).length || undefined },
                { key: "accounts" as const, label: "Accounts", icon: Building2 },
              ]).map((t) => {
                const Icon = t.icon;
                const active = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-[13px] flex items-center justify-between gap-2 transition-colors ${
                      active ? "bg-[#6800FF] text-white font-semibold shadow-sm" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 min-w-0">
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </span>
                    {typeof t.count === "number" && (
                      <span className={`text-[10px] tabular-nums rounded px-1.5 py-0.5 ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>{t.count}</span>
                    )}
                  </button>
                );
              })}
            </nav>
            {activeTab === "campaigns" && (
              <div
                ref={(el) => setCampaignFilterSlot(el)}
                className="mt-5 pt-4 border-t border-slate-200"
              />
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 pl-8 pr-8 pt-2 space-y-8">

        {activeTab === "campaigns" && isAdmin && (
          <section className="bg-white border border-slate-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-slate-800">Smartlead campaigns</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Pick the Smartlead campaigns this client&apos;s portal should surface. IDs are stored under the hood.</p>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[260px] justify-end">
                <input
                  type="text"
                  value={smartleadIdsDraft}
                  onChange={(e) => setSmartleadIdsDraft(e.target.value)}
                  placeholder="e.g. 12345, 67890"
                  className="flex-1 max-w-md px-3 py-1.5 text-sm font-mono border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
                />
                <button
                  onClick={openSmartleadPicker}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                >
                  Browse…
                </button>
                <button
                  onClick={saveSmartleadIds}
                  disabled={!smartleadDirty || smartleadSaving}
                  className="px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {smartleadSaving ? "Saving…" : smartleadSavedAt ? "Saved ✓" : "Save"}
                </button>
              </div>
            </div>
          </section>
        )}

        {smartleadPickerOpen && (
          <>
            <div className="fixed inset-0 bg-slate-900/40 z-40" onClick={() => setSmartleadPickerOpen(false)} />
            <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[80vh] overflow-hidden flex flex-col">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Pick Smartlead campaigns</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">Live list pulled from your Smartlead workspace</p>
                </div>
                <button onClick={() => setSmartleadPickerOpen(false)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100">
                  <X size={16} />
                </button>
              </div>
              <div className="px-5 py-3 border-b border-slate-100 space-y-2">
                <input
                  type="text"
                  value={smartleadPickerQuery}
                  onChange={(e) => setSmartleadPickerQuery(e.target.value)}
                  placeholder="Search campaigns by name or ID…"
                  className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
                />
                {(() => {
                  const counts = smartleadPickerCampaigns.reduce<Record<string, number>>((acc, c) => {
                    const s = (c.status || "").toLowerCase();
                    if (s === "active" || s === "paused" || s === "completed") acc[s] = (acc[s] || 0) + 1;
                    else acc.other = (acc.other || 0) + 1;
                    return acc;
                  }, {});
                  const chips: Array<{ key: typeof smartleadPickerStatus; label: string; count: number }> = [
                    { key: "all", label: "All", count: smartleadPickerCampaigns.length },
                    { key: "active", label: "Active", count: counts.active || 0 },
                    { key: "paused", label: "Paused", count: counts.paused || 0 },
                    { key: "completed", label: "Completed", count: counts.completed || 0 },
                  ];
                  if (counts.other) chips.push({ key: "other", label: "Other", count: counts.other });
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {chips.map((chip) => {
                        const active = smartleadPickerStatus === chip.key;
                        const cls = active
                          ? (chip.key === "active" ? "bg-emerald-600 text-white border-emerald-600"
                            : chip.key === "paused" ? "bg-amber-500 text-white border-amber-500"
                            : chip.key === "completed" ? "bg-slate-700 text-white border-slate-700"
                            : "bg-[#6800FF] text-white border-[#6800FF]")
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50";
                        return (
                          <button
                            key={chip.key}
                            type="button"
                            onClick={() => setSmartleadPickerStatus(chip.key)}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-full border transition-colors ${cls}`}
                          >
                            {chip.label} <span className="opacity-70">· {chip.count}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {!smartleadPickerLoading && !smartleadPickerError && smartleadPickerCampaigns.length > 0 && (() => {
                const q = smartleadPickerQuery.trim().toLowerCase();
                const matchesStatus = (c: { status: string }) => {
                  if (smartleadPickerStatus === "all") return true;
                  const s = (c.status || "").toLowerCase();
                  if (smartleadPickerStatus === "other") return s !== "active" && s !== "paused" && s !== "completed";
                  return s === smartleadPickerStatus;
                };
                const filteredIds = smartleadPickerCampaigns
                  .filter(matchesStatus)
                  .filter((c) => !q || c.name?.toLowerCase().includes(q) || String(c.id).includes(q))
                  .map((c) => String(c.id));
                const visibleCount = filteredIds.length;
                const visibleSelectedCount = filteredIds.filter((id) => selectedSmartleadIds.has(id)).length;
                const allVisibleSelected = visibleCount > 0 && visibleSelectedCount === visibleCount;
                return (
                  <div className="px-5 py-2 border-b border-slate-100 flex items-center justify-between gap-3 text-xs">
                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={() => {
                          const next = new Set(selectedSmartleadIds);
                          if (allVisibleSelected) for (const id of filteredIds) next.delete(id);
                          else for (const id of filteredIds) next.add(id);
                          setSmartleadSelection(Array.from(next));
                        }}
                        className="h-3.5 w-3.5 accent-[#6800FF]"
                      />
                      <span className="font-semibold text-slate-700">
                        {allVisibleSelected ? "Deselect all" : "Select all"}
                        {q ? ` (${visibleCount} shown)` : ` (${visibleCount})`}
                      </span>
                    </label>
                    {selectedSmartleadIds.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setSmartleadSelection([])}
                        className="text-slate-500 hover:text-red-600 font-medium"
                      >
                        Clear ({selectedSmartleadIds.size})
                      </button>
                    )}
                  </div>
                );
              })()}
              <div className="flex-1 overflow-y-auto">
                {smartleadPickerLoading && (
                  <div className="px-5 py-10 text-sm text-slate-400 text-center">Loading campaigns…</div>
                )}
                {!smartleadPickerLoading && smartleadPickerError && (
                  <div className="px-5 py-6 text-sm text-amber-700 bg-amber-50 m-4 rounded-lg">
                    {smartleadPickerError}
                    {smartleadPickerError.toLowerCase().includes("smartlead_api_key") && (
                      <p className="mt-2 text-[11px] text-amber-700">Set <code className="px-1 py-0.5 bg-amber-100 rounded">SMARTLEAD_API_KEY</code> in <code className="px-1 py-0.5 bg-amber-100 rounded">.env.local</code> and restart the dev server.</p>
                    )}
                  </div>
                )}
                {!smartleadPickerLoading && !smartleadPickerError && (() => {
                  const q = smartleadPickerQuery.trim().toLowerCase();
                  const filtered = smartleadPickerCampaigns
                    .filter((c) => {
                      if (smartleadPickerStatus === "all") return true;
                      const s = (c.status || "").toLowerCase();
                      if (smartleadPickerStatus === "other") return s !== "active" && s !== "paused" && s !== "completed";
                      return s === smartleadPickerStatus;
                    })
                    .filter((c) => {
                      if (!q) return true;
                      return c.name?.toLowerCase().includes(q) || String(c.id).includes(q);
                    });
                  if (filtered.length === 0) {
                    return <div className="px-5 py-10 text-sm text-slate-400 text-center">{smartleadPickerCampaigns.length === 0 ? "No campaigns in this Smartlead workspace yet." : "No matches"}</div>;
                  }
                  return (
                    <ul className="divide-y divide-slate-100">
                      {filtered.map((c) => {
                        const idStr = String(c.id);
                        const checked = selectedSmartleadIds.has(idStr);
                        const status = (c.status || "").toLowerCase();
                        const statusCls =
                          status === "active" ? "bg-emerald-50 text-emerald-700" :
                          status === "paused" ? "bg-amber-50 text-amber-700" :
                          status === "completed" ? "bg-slate-100 text-slate-600" :
                          "bg-slate-50 text-slate-500";
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => toggleSmartleadId(idStr)}
                              className={`w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 ${checked ? "bg-violet-50/40" : ""}`}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{c.name || `Campaign ${c.id}`}</p>
                                <p className="text-[10px] text-slate-400 font-mono">#{c.id}</p>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusCls}`}>{c.status || "unknown"}</span>
                                <span className={`text-[10px] font-semibold ${checked ? "text-[#6800FF]" : "text-slate-400"}`}>
                                  {checked ? "Selected ✓" : "+ Add"}
                                </span>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()}
              </div>
              <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between">
                <p className="text-[11px] text-slate-500">{selectedSmartleadIds.size} selected</p>
                <button
                  onClick={() => setSmartleadPickerOpen(false)}
                  className="px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] text-white text-xs font-semibold rounded-lg"
                >
                  Done
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === "meetings" && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-base font-semibold text-slate-800">Meeting Details</h2>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
              >
                <option value="">All Months</option>
                {availableMonths.map((m, i) => <option key={`mf-${i}`} value={m}>{m}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
              >
                <option value="all">All Statuses</option>
                <option value="done">Done</option>
                <option value="scheduled">Scheduled</option>
                <option value="pipeline">Pipeline</option>
              </select>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-40 pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
                />
              </div>
              <button onClick={exportMeetings} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
                <Download size={14} /> Export CSV
              </button>
              {isPod && !showDetailForm && (
                <button onClick={() => { resetDetailForm(); setShowDetailForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus size={14} /> Add
                </button>
              )}
            </div>
          </div>

          {(() => {
            const target = project?.monthlyTargetInternal || 0;
            const remaining = Math.max(0, target - monthCounts.done);
            const targetPct = target > 0 ? Math.min(100, Math.round((monthCounts.done / target) * 100)) : 0;
            const doneSub = target === 0
              ? "No target set"
              : remaining === 0
                ? "Target hit"
                : `${targetPct}% of ${target}`;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <MeetingFilterCard
                  label="Total"
                  value={monthCounts.total}
                  sub={monthFilter || "All months"}
                  dot="slate"
                  active={statusFilter === "all"}
                  onClick={() => setStatusFilter("all")}
                />
                <MeetingFilterCard
                  label="Pipeline"
                  value={monthCounts.pipeline}
                  sub="Being qualified"
                  dot="amber"
                  active={statusFilter === "pipeline"}
                  onClick={() => setStatusFilter(statusFilter === "pipeline" ? "all" : "pipeline")}
                />
                <MeetingFilterCard
                  label="Scheduled"
                  value={monthCounts.scheduled}
                  sub="Upcoming"
                  dot="blue"
                  active={statusFilter === "scheduled"}
                  onClick={() => setStatusFilter(statusFilter === "scheduled" ? "all" : "scheduled")}
                />
                <MeetingFilterCard
                  label="Done"
                  value={monthCounts.done}
                  sub={doneSub}
                  dot="emerald"
                  active={statusFilter === "done"}
                  onClick={() => setStatusFilter(statusFilter === "done" ? "all" : "done")}
                />
              </div>
            );
          })()}

          {showDetailForm && isPod && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 mb-3 space-y-3">
              <p className="text-sm font-semibold text-slate-700">{editingDetailId ? "Edit Record" : "New Record"}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <select value={detailForm.month} onChange={(e) => setDetailForm({ ...detailForm, month: e.target.value })} className={inputClass}>
                  <option value="">Select Month</option>
                  {MONTH_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <select value={detailForm.year} onChange={(e) => setDetailForm({ ...detailForm, year: e.target.value })} className={inputClass}>
                  <option value="">Select Year</option>
                  {(() => {
                    const current = new Date().getFullYear();
                    const years = new Set<number>([current - 1, current, current + 1]);
                    records.forEach((r) => years.add(r.year));
                    return Array.from(years).sort((a, b) => b - a).map((y) => <option key={y} value={String(y)}>{y}</option>);
                  })()}
                </select>
                <select value={detailForm.geo} onChange={(e) => setDetailForm({ ...detailForm, geo: e.target.value })} className={inputClass}>
                  {GEO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={detailForm.salesRep} onChange={(e) => setDetailForm({ ...detailForm, salesRep: e.target.value })} className={inputClass}>
                  <option value="">Select Thyleads Rep</option>
                  {(() => {
                    const allMembers = Array.from(new Set(pods.flatMap((p) => p.members))).sort((a, b) => a.localeCompare(b));
                    return allMembers.map((m) => <option key={m} value={m}>{m}</option>);
                  })()}
                  {detailForm.salesRep && !pods.some((p) => p.members.includes(detailForm.salesRep)) && (
                    <option value={detailForm.salesRep}>{detailForm.salesRep} (legacy)</option>
                  )}
                </select>
                <input type="date" value={detailForm.meetingDate} onChange={(e) => setDetailForm({ ...detailForm, meetingDate: e.target.value })} className={inputClass} />
                <input type="time" value={detailForm.meetingTime} onChange={(e) => setDetailForm({ ...detailForm, meetingTime: e.target.value })} className={inputClass} />
                <select value={detailForm.meetingStatus} onChange={(e) => setDetailForm({ ...detailForm, meetingStatus: e.target.value as MeetingStatus })} className={inputClass}>
                  <option value="scheduled">Scheduled</option>
                  <option value="done">Done</option>
                  <option value="pipeline">Pipeline</option>
                </select>
                <input placeholder="Meeting Link" value={detailForm.meetingLink} onChange={(e) => setDetailForm({ ...detailForm, meetingLink: e.target.value })} className={inputClass} />
                <input placeholder="Company Name" value={detailForm.companyName} onChange={(e) => setDetailForm({ ...detailForm, companyName: e.target.value })} className={inputClass} />
                <input placeholder="Contact Name" value={detailForm.contactName} onChange={(e) => setDetailForm({ ...detailForm, contactName: e.target.value })} className={inputClass} />
                <input placeholder="Contact Title" value={detailForm.contactTitle} onChange={(e) => setDetailForm({ ...detailForm, contactTitle: e.target.value })} className={inputClass} />
                <input placeholder="Contact Email" value={detailForm.contactEmail} onChange={(e) => setDetailForm({ ...detailForm, contactEmail: e.target.value })} className={inputClass} />
                <input placeholder="Contact Number" value={detailForm.contactNumber} onChange={(e) => setDetailForm({ ...detailForm, contactNumber: e.target.value })} className={inputClass} />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={handleSaveDetail} className="flex items-center gap-1.5 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors"><Check size={14} /> {editingDetailId ? "Update" : "Save"}</button>
                <button onClick={resetDetailForm} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm text-left" style={{ tableLayout: "fixed", minWidth: contactResize.widths.reduce((a, b) => a + b, 0) + (isPod ? 80 : 0) }}>
                <colgroup>
                  {contactResize.widths.map((w, i) => <col key={i} style={{ width: w }} />)}
                  {isPod && <col style={{ width: 80 }} />}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                    {contactCols.map((col, i) => (
                      <th key={i} title={col.label} className="relative px-4 py-3 font-semibold overflow-hidden text-ellipsis whitespace-nowrap bg-slate-50">
                        {contactResize.widths[i] < col.bp ? col.short : col.label}
                        <div onMouseDown={(e) => contactResize.onMouseDown(i, e)} className="absolute right-0 top-2 bottom-2 w-0.75 cursor-col-resize rounded-full bg-slate-200 hover:bg-[#5800DD] active:bg-[#6800FF] transition-colors" />
                      </th>
                    ))}
                    {isPod && <th className="px-4 py-3 w-20"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-3 overflow-hidden">
                        <button onClick={() => openMeetingPopup(r)} className="text-[#6800FF] hover:text-indigo-800 font-mono text-xs font-semibold hover:underline transition-colors">{r.meetingId}</button>
                      </td>
                      <td className="px-4 py-3 text-slate-700 overflow-hidden truncate">{r.month}</td>
                      <td className="px-4 py-3 text-slate-700 tabular-nums overflow-hidden truncate">{r.meetingDate}</td>
                      <td className="px-4 py-3 text-slate-700 tabular-nums overflow-hidden truncate">{r.meetingTime}</td>
                      <td className="px-4 py-3 text-slate-700 overflow-hidden truncate">{r.companyName}</td>
                      <td className="px-4 py-3 overflow-hidden"><span className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 truncate">{r.geo}</span></td>
                      <td className="px-4 py-3 text-slate-700 overflow-hidden truncate">{r.salesRep}</td>
                      <td className="px-4 py-3 text-slate-700 overflow-hidden truncate">{r.accountManager}</td>
                      <td className="px-4 py-3 overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          {isPod ? (
                            <select
                              value={r.meetingStatus}
                              onChange={(e) => updateDetail(id, r.id, { meetingStatus: e.target.value as MeetingStatus })}
                              className={`px-2 py-0.5 rounded-md text-xs font-medium border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#6800FF]/30 appearance-none pr-5 bg-[length:8px_8px] bg-no-repeat bg-[right_0.4rem_center] ${
                                r.meetingStatus === "done" ? "bg-emerald-50 text-emerald-700" :
                                r.meetingStatus === "pipeline" ? "bg-[#f0e6ff] text-indigo-700" :
                                "bg-amber-50 text-amber-700"
                              }`}
                              style={{ backgroundImage: "url(\"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")" }}
                              title="Update meeting status"
                            >
                              <option value="scheduled">Scheduled</option>
                              <option value="done">Done</option>
                              <option value="pipeline">Pipeline</option>
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-md text-xs font-medium ${
                              r.meetingStatus === "done" ? "bg-emerald-50 text-emerald-700" :
                              r.meetingStatus === "pipeline" ? "bg-[#f0e6ff] text-indigo-700" :
                              "bg-amber-50 text-amber-700"
                            }`}>
                              {r.meetingStatus === "done" ? "Done" : r.meetingStatus === "pipeline" ? "Pipeline" : "Scheduled"}
                            </span>
                          )}
                          {clientRemarks[r.meetingId]?.remark && (
                            <span className="w-2 h-2 rounded-full bg-[#6800FF] shrink-0" title="Has client remark" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 overflow-hidden">
                        {r.meetingLink ? <a href={r.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[#6800FF] hover:text-indigo-800 text-xs font-medium">Join</a> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 overflow-hidden truncate">{r.contactName}</td>
                      <td className="px-4 py-3 text-slate-500 overflow-hidden truncate">{r.contactTitle}</td>
                      <td className="px-4 py-3 overflow-hidden truncate"><a href={`mailto:${r.contactEmail}`} className="text-[#6800FF] hover:text-indigo-800">{r.contactEmail}</a></td>
                      <td className="px-4 py-3 text-slate-700 tabular-nums overflow-hidden truncate">{r.contactNumber}</td>
                      {isPod && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => startEditDetail(r)} className="p-1.5 rounded-md text-slate-400 hover:text-[#6800FF] hover:bg-[#f0e6ff] transition-colors"><Pencil size={14} /></button>
                            <ConfirmDelete onConfirm={() => handleDeleteDetail(r)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={contactCols.length + (isPod ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">{search ? "No results" : "No records yet"}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
        )}

        {activeTab === "campaigns" && project && (
          <CampaignDetails projectId={project.id} actorEmail={user?.email || ""} filterSlot={campaignFilterSlot} />
        )}

        {activeTab === "accounts" && project && (
          <LeadAccountsSection projectId={project.id} clientName={clientName} actorEmail={user?.email || ""} />
        )}


        </main>
      </div>

      {viewMeeting && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setViewMeeting(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono text-[#6800FF] font-semibold">{viewMeeting.meetingId}</p>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">Meeting Details</h3>
              </div>
              <button onClick={() => setViewMeeting(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Client</p>
                  <p className="text-sm text-slate-800 font-medium">{viewMeeting.clientName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Company</p>
                  <p className="text-sm text-slate-800">{viewMeeting.companyName}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Date & Time</p>
                  <p className="text-sm text-slate-800">{viewMeeting.meetingDate} at {viewMeeting.meetingTime}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</p>
                  <span className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${
                    viewMeeting.meetingStatus === "done" ? "bg-emerald-50 text-emerald-700" :
                    viewMeeting.meetingStatus === "pipeline" ? "bg-[#f0e6ff] text-indigo-700" :
                    "bg-amber-50 text-amber-700"
                  }`}>
                    {viewMeeting.meetingStatus === "done" ? "Done" : viewMeeting.meetingStatus === "pipeline" ? "Pipeline" : "Scheduled"}
                  </span>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Geo</p>
                  <p className="text-sm text-slate-800">{viewMeeting.geo}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Thyleads Rep</p>
                  <p className="text-sm text-slate-800">{viewMeeting.salesRep}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Account Manager</p>
                  <p className="text-sm text-slate-800">{viewMeeting.accountManager || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact</p>
                  <p className="text-sm text-slate-800 font-medium">{viewMeeting.contactName}</p>
                  <p className="text-xs text-slate-500">{viewMeeting.contactTitle}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Contact Info</p>
                  <p className="text-sm text-[#6800FF]">{viewMeeting.contactEmail}</p>
                  <p className="text-xs text-slate-500">{viewMeeting.contactNumber}</p>
                </div>
              </div>

              {viewMeeting.meetingLink && (
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Meeting Link</p>
                  <a href={viewMeeting.meetingLink} target="_blank" rel="noopener noreferrer" className="text-sm text-[#6800FF] hover:text-indigo-800 hover:underline">{viewMeeting.meetingLink}</a>
                </div>
              )}

              {clientRemarks[viewMeeting.meetingId]?.remark && (
                <div className="border-t border-slate-100 pt-5">
                  <div className="bg-[#6800FF]/5 rounded-xl p-4 border border-[#6800FF]/10">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-semibold text-[#6800FF] uppercase">Client Remark</p>
                      <p className="text-[10px] text-slate-400">
                        {clientRemarks[viewMeeting.meetingId].updatedBy && `${clientRemarks[viewMeeting.meetingId].updatedBy} · `}
                        {new Date(clientRemarks[viewMeeting.meetingId].updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{clientRemarks[viewMeeting.meetingId].remark}</p>
                  </div>
                </div>
              )}

              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Internal Remarks</label>
                  <textarea
                    value={popupRemarks}
                    onChange={(e) => setPopupRemarks(e.target.value)}
                    placeholder="Add remarks from the client..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] resize-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Additional Information</label>
                  <textarea
                    value={popupAdditionalInfo}
                    onChange={(e) => setPopupAdditionalInfo(e.target.value)}
                    placeholder="Any additional information..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] resize-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5 block">Meeting Summary</label>
                  <textarea
                    value={popupSummary}
                    onChange={(e) => setPopupSummary(e.target.value)}
                    placeholder="Summarize the meeting outcome..."
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-50/50 rounded-b-2xl">
              <button onClick={() => setViewMeeting(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={saveMeetingExtras} className="px-4 py-2 text-sm font-medium text-white bg-[#6800FF] hover:bg-[#5800DD] rounded-lg transition-colors">
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const FILTER_DOT: Record<string, string> = {
  slate: "bg-slate-900",
  amber: "bg-amber-500",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
};

const FILTER_RING: Record<string, string> = {
  slate: "ring-slate-900/15 border-slate-900",
  amber: "ring-amber-500/15 border-amber-500",
  blue: "ring-blue-500/15 border-blue-500",
  emerald: "ring-emerald-500/15 border-emerald-500",
};

function MeetingFilterCard({ label, value, sub, dot, active, onClick }: {
  label: string;
  value: number;
  sub: string;
  dot: "slate" | "amber" | "blue" | "emerald";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`text-left bg-white border rounded-xl px-4 py-3.5 transition-all hover:border-slate-300 ${
        active ? `ring-2 ${FILTER_RING[dot]}` : "border-slate-200"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${FILTER_DOT[dot]}`} />
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">{label}</span>
        </div>
        {active && <span className="text-[10px] font-semibold text-slate-400">Filtered</span>}
      </div>
      <p className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight leading-none mt-3">{value.toLocaleString()}</p>
      <p className="text-[11px] text-slate-500 mt-1.5">{sub}</p>
    </button>
  );
}

function CelebrationBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[101] pointer-events-auto">
      <div onClick={onClose} className="cursor-pointer flex items-center gap-3 px-5 py-3 bg-white rounded-2xl shadow-lg ring-1 ring-slate-200/80 border border-slate-100 animate-celebration-pop">
        <span className="text-2xl">🎉</span>
        <div className="text-left">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6800FF]">Congrats!</p>
          <p className="text-sm font-bold text-slate-800">{message}</p>
        </div>
      </div>
      <style jsx global>{`
        @keyframes celebration-pop {
          0% { transform: translateY(-30px) scale(0.6); opacity: 0; }
          50% { transform: translateY(8px) scale(1.05); opacity: 1; }
          70% { transform: translateY(-2px) scale(0.98); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .animate-celebration-pop { animation: celebration-pop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>
    </div>
  );
}

type LeadAccountGroup = {
  rootKey: string;
  displayDomain: string;
  company: string;
  domains: { domain: string; company: string }[];
};

type LeadGoogleSheetMeta = {
  sheetUrl: string;
  spreadsheetId: string;
  tabTitle: string;
  tabSheetId: number | null;
  connectedAt: string | null;
  connectedBy: string;
  lastSyncAt: string | null;
  lastSyncError: string;
  domainColumn: string;
  companyColumn: string;
};

type LeadListResponse = {
  groups: LeadAccountGroup[];
  totals: { uploaded: number; net: number; uniqueDomains: number; manualDnc: number; manualDncMatched: number };
  manualDnc: string[];
  googleSheet?: LeadGoogleSheetMeta | null;
  syncedNow?: boolean;
  syncError?: string;
  updatedAt: string | null;
};

function LeadAccountsSection({ projectId, clientName, actorEmail }: { projectId: string; clientName: string; actorEmail: string }) {
  const [data, setData] = useState<LeadListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadFlash, setUploadFlash] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [sheetModalOpen, setSheetModalOpen] = useState(false);
  const [dncModalOpen, setDncModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!actorEmail) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/accounts/list?actor=${encodeURIComponent(actorEmail)}&projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to load accounts"); return; }
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [projectId, actorEmail]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleUpload = useCallback(async (file: File) => {
    if (!actorEmail) return;
    setUploading(true);
    setUploadError("");
    setUploadFlash("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("actor", actorEmail);
      fd.append("projectId", projectId);
      const res = await fetch("/api/accounts/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || "Upload failed"); return; }
      setUploadFlash(`Uploaded ${json.uploaded} rows · ${json.uniqueDomains} unique`);
      await fetchData();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Network error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [actorEmail, projectId, fetchData]);

  const groups = useMemo(() => data?.groups || [], [data?.groups]);
  const updatedAt = data?.updatedAt || null;

  const flatRows = useMemo(() => {
    const rows: { domain: string; company: string; rootKey: string }[] = [];
    for (const g of groups) {
      for (const d of g.domains) rows.push({ domain: d.domain, company: d.company || g.company, rootKey: g.rootKey });
    }
    return rows;
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return flatRows;
    return flatRows.filter((r) => r.domain.includes(q) || r.company.toLowerCase().includes(q) || r.rootKey.includes(q));
  }, [flatRows, search]);

  return (
    <div className="space-y-4">
    <DailyGrowthPanel projectId={projectId} refreshKey={updatedAt} />
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-slate-800">Accounts</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {flatRows.length.toLocaleString()} rows · {groups.length.toLocaleString()} unique domains for {clientName}
            {data?.googleSheet && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#6800FF]">
                <Link2 size={9} /> {data.googleSheet.tabTitle}{data.syncedNow ? " · synced" : ""}
              </span>
            )}
            {data?.syncError && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700">
                <AlertTriangle size={9} /> {data.syncError}
              </span>
            )}
            {updatedAt && <span className="ml-2 text-slate-400">· last synced {new Date(updatedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-44 pl-8 pr-2 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
            />
          </div>
          <button
            onClick={() => setDncModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
          >
            <Ban size={12} /> DNC ({data?.totals?.manualDnc ?? 0})
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-60"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <UploadCloud size={12} />} Upload XLSX
          </button>
          <button
            onClick={() => setSheetModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] rounded-lg transition-colors"
          >
            <Link2 size={12} /> {data?.googleSheet ? "Change Sheet" : "Connect Sheet"}
          </button>
          <button onClick={fetchData} disabled={loading} className="inline-flex items-center justify-center w-8 h-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-60" title="Refresh">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleUpload(f);
            }}
          />
        </div>
      </div>

      {(uploadError || uploadFlash) && (
        <div className={`mx-4 mt-3 text-xs px-3 py-2 rounded-lg border ${uploadError ? "bg-rose-50 border-rose-200 text-rose-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          {uploadError || uploadFlash}
        </div>
      )}
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        {loading && flatRows.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-sm text-slate-400">
            <Loader2 size={14} className="animate-spin mr-2" /> Loading accounts…
          </div>
        ) : error ? (
          <div className="m-4 p-4 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-slate-400">
            <Building2 size={22} className="text-slate-300 mx-auto mb-2" />
            {flatRows.length > 0 ? "No matches for your search." : "No accounts available yet for this client."}
          </div>
        ) : (
          <table className="border-collapse text-[12.5px]" style={{ minWidth: "100%" }}>
            <thead>
              <tr className="sticky top-0 z-20 bg-[#f1f3f4] text-slate-600">
                <th className="sticky left-0 z-30 bg-[#f1f3f4] w-12 h-7 px-2 border-b border-r border-slate-300 text-[10.5px] font-semibold"></th>
                <th className="h-7 px-3 border-b border-r border-slate-300 text-[10.5px] font-semibold text-center min-w-[120px]">A</th>
                <th className="h-7 px-3 border-b border-r border-slate-300 text-[10.5px] font-semibold text-center min-w-[120px]">B</th>
              </tr>
              <tr className="sticky top-7 z-20 bg-white text-slate-700">
                <th className="sticky left-0 z-30 bg-[#f8f9fa] w-12 h-9 px-2 border-b border-r border-slate-300 text-[10.5px] font-bold text-center">1</th>
                <th className="h-9 px-3 border-b border-r border-slate-300 text-left text-[11.5px] font-semibold min-w-[260px]">Domain</th>
                <th className="h-9 px-3 border-b border-r border-slate-300 text-left text-[11.5px] font-semibold min-w-[320px]">Company</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={`${r.domain}-${i}`} className="hover:bg-[#f0fbff]">
                  <td className="sticky left-0 z-10 bg-[#f8f9fa] w-12 h-8 px-2 border-b border-r border-slate-200 text-[10.5px] font-semibold text-slate-500 text-center tabular-nums">{i + 2}</td>
                  <td className="h-8 px-3 border-b border-r border-slate-200 text-slate-900 font-medium">{r.domain}</td>
                  <td className="h-8 px-3 border-b border-r border-slate-200 text-slate-700 truncate max-w-md">{r.company || <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {sheetModalOpen && (
        <LeadConnectSheetModal
          actor={actorEmail}
          projectId={projectId}
          current={data?.googleSheet || null}
          onClose={() => setSheetModalOpen(false)}
          onConnected={async () => { setSheetModalOpen(false); await fetchData(); }}
        />
      )}

      {dncModalOpen && (
        <LeadDncModal
          actor={actorEmail}
          projectId={projectId}
          initial={data?.manualDnc || []}
          totalsOnList={data?.totals?.manualDnc || 0}
          totalsMatched={data?.totals?.manualDncMatched || 0}
          onClose={() => setDncModalOpen(false)}
          onSaved={async () => { await fetchData(); }}
        />
      )}
    </section>
    </div>
  );
}

type DailyGrowthSeries = {
  date: string;
  totalRows: number;
  uniqueDomains: number;
  newRows: number;
  newDomains: number;
  newDomainsList: string[];
  newRowsList: string[];
  listAvailable?: boolean;
  isFilled?: boolean;
};

function DailyGrowthPanel({ projectId, refreshKey }: { projectId: string; refreshKey: string | null }) {
  const [series, setSeries] = useState<DailyGrowthSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [days, setDays] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/portal/accounts/daily?projectId=${encodeURIComponent(projectId)}&days=${days}`, { cache: "no-store" });
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json.error || "Failed to load daily growth"); return; }
        setSeries(json.series || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [projectId, days, refreshKey]);

  const today = series[series.length - 1];
  const yesterday = series[series.length - 2];
  const sumWindow = series.reduce((s, d) => s + d.newDomains, 0);
  const maxDelta = Math.max(1, ...series.map((d) => d.newDomains));

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <UploadCloud size={14} />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-slate-800">Daily Growth</h2>
            <p className="text-[11px] text-slate-500">
              New unique domains added since the previous day.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center bg-slate-100 rounded-md p-0.5">
          {([7, 14, 30] as const).map((d) => {
            const active = days === d;
            return (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                  active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {d}d
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-slate-100">
        <GrowthStat label="Added today"   value={today?.newDomains ?? 0} accent="violet" />
        <GrowthStat label="Yesterday"     value={yesterday?.newDomains ?? 0} />
        <GrowthStat label={`Last ${days}d`} value={sumWindow} accent="emerald" />
      </div>

      <div className="px-4 py-3">
        {error ? (
          <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">{error}</div>
        ) : loading && series.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs text-slate-400">
            <Loader2 size={12} className="animate-spin mr-1.5" /> Loading…
          </div>
        ) : series.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No history yet. Upload or sync a sheet to start tracking daily growth.</p>
        ) : (
          <>
            <div className="flex items-end gap-1 h-24 mb-2">
              {series.map((d) => {
                const h = Math.round((d.newDomains / maxDelta) * 100);
                const isToday = d === today;
                return (
                  <div key={d.date} className="flex-1 min-w-0 flex flex-col items-center justify-end group">
                    <div
                      className={`w-full rounded-t transition-all ${
                        d.newDomains === 0 ? "bg-slate-200" : isToday ? "bg-[#6800FF]" : "bg-violet-300 group-hover:bg-violet-400"
                      }`}
                      style={{ height: `${Math.max(4, h)}%` }}
                      title={`${d.date} · +${d.newDomains} new (total ${d.uniqueDomains})`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 gap-1 text-[9px] text-slate-400 tabular-nums text-center">
              {series.filter((_, i, arr) => i === 0 || i === arr.length - 1 || i % Math.max(1, Math.floor(arr.length / 6)) === 0).slice(0, 7).map((d) => (
                <span key={d.date}>{d.date.slice(5)}</span>
              ))}
            </div>
          </>
        )}
      </div>

      <NewEntriesList series={series} />
    </section>
  );
}

function NewEntriesList({ series }: { series: DailyGrowthSeries[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const daysWithAdds = useMemo(
    () => series.filter((d) => d.newDomains > 0).slice().reverse(),
    [series],
  );
  if (daysWithAdds.length === 0) return null;
  const anyMissingList = daysWithAdds.some((d) => !d.listAvailable && d.newDomains > 0);

  function toggle(date: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <div className="border-t border-slate-100">
      <div className="px-4 pt-3 pb-1.5 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">New Entries</p>
        <span className="text-[10px] text-slate-400 tabular-nums">{daysWithAdds.length} {daysWithAdds.length === 1 ? "day" : "days"} with additions</span>
      </div>
      {anyMissingList && (
        <p className="px-4 pb-2 text-[10.5px] text-amber-700 bg-amber-50/70 border-y border-amber-100 mb-1 pt-2">
          Per-domain tracking started after the first baseline sync. Counts are accurate, but individual entries from earlier days aren&apos;t listed.
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {daysWithAdds.map((d) => {
          const isOpen = expanded.has(d.date);
          const items = d.newDomainsList.length > 0 ? d.newDomainsList : d.newRowsList;
          const preview = items.slice(0, 3).join(", ");
          const extra = items.length > 3 ? items.length - 3 : 0;
          return (
            <li key={d.date}>
              <button
                onClick={() => toggle(d.date)}
                className="w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition-colors"
              >
                <div className="shrink-0 w-12 text-center">
                  <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 leading-none">{new Date(`${d.date}T00:00:00`).toLocaleDateString("en-US", { month: "short" })}</p>
                  <p className="text-[14px] font-bold tabular-nums text-slate-900 leading-tight mt-0.5">{new Date(`${d.date}T00:00:00`).getDate()}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-semibold text-slate-900">
                    <span className="text-[#6800FF]">+{d.newDomains}</span> new {d.newDomains === 1 ? "domain" : "domains"}
                    {d.newRows !== d.newDomains && <span className="text-slate-500 font-normal"> · {d.newRows} {d.newRows === 1 ? "row" : "rows"}</span>}
                    {!d.listAvailable && d.newDomains > 0 && (
                      <span className="ml-2 text-[9.5px] font-normal text-amber-600">names not tracked</span>
                    )}
                  </p>
                  {items.length > 0 && (
                    <p className="text-[10.5px] text-slate-500 mt-0.5 truncate font-mono">
                      {preview}
                      {extra > 0 && <span className="text-slate-400 not-italic"> · +{extra} more</span>}
                    </p>
                  )}
                </div>
                {items.length > 0 && (
                  <ChevronDown size={13} className={`shrink-0 mt-1 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                )}
              </button>
              {isOpen && items.length > 0 && (
                <div className="px-4 pb-3 pl-[4.25rem]">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5">
                    {items.map((item) => (
                      <li key={item} className="text-[11.5px] font-mono text-slate-700 truncate flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-[#6800FF]/60 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GrowthStat({ label, value, accent }: { label: string; value: number; accent?: "violet" | "emerald" }) {
  const accentCls = accent === "violet" ? "text-[#6800FF]" : accent === "emerald" ? "text-emerald-700" : "text-slate-900";
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
      <p className="text-[9.5px] font-bold uppercase tracking-wider text-slate-500 leading-none">{label}</p>
      <p className={`text-[18px] font-bold tabular-nums leading-tight mt-1 ${accentCls}`}>
        {value > 0 && <span className="text-[12px] mr-0.5">+</span>}
        {value.toLocaleString()}
      </p>
    </div>
  );
}

type LeadTab = { title: string; sheetId: number; rowCount: number; columnCount: number };

function LeadConnectSheetModal({ actor, projectId, current, onClose, onConnected }: {
  actor: string;
  projectId: string;
  current: LeadGoogleSheetMeta | null;
  onClose: () => void;
  onConnected: () => Promise<void> | void;
}) {
  const [sheetUrl, setSheetUrl] = useState(current?.sheetUrl || "");
  const [spreadsheetId, setSpreadsheetId] = useState(current?.spreadsheetId || "");
  const [tabs, setTabs] = useState<LeadTab[] | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>(current?.tabTitle || "");
  const [loadingTabs, setLoadingTabs] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadTabs() {
    setError(""); setSuccess(""); setTabs(null); setLoadingTabs(true);
    try {
      const res = await fetch("/api/accounts/connect-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, sheetUrl }),
      });
      const json = await res.json();
      if (!res.ok) { setError(`${json.error || "Failed"}${json.hint ? ` — ${json.hint}` : ""}`); return; }
      setSpreadsheetId(json.spreadsheetId);
      setTabs(json.tabs || []);
      if (!selectedTab && json.tabs?.length) setSelectedTab(json.tabs[0].title);
    } catch (e) { setError(e instanceof Error ? e.message : "Network error"); }
    finally { setLoadingTabs(false); }
  }

  async function connect() {
    setError(""); setSuccess(""); setSaving(true);
    try {
      const tabMeta = tabs?.find((t) => t.title === selectedTab);
      const res = await fetch("/api/accounts/save-tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, sheetUrl, spreadsheetId, tabTitle: selectedTab, tabSheetId: tabMeta?.sheetId }),
      });
      let json: { error?: string; detectedHeaders?: string[]; uploaded?: number; domainColumn?: string; companyColumn?: string } = {};
      try { json = await res.json(); } catch {}
      if (!res.ok) {
        const hdrs = Array.isArray(json.detectedHeaders) ? ` Headers seen: ${json.detectedHeaders.join(", ")}` : "";
        setError(`${json.error || `HTTP ${res.status}`}${hdrs}`);
        setSaving(false);
        return;
      }
      setSuccess(`Synced ${json.uploaded ?? 0} rows from "${selectedTab}". Domain → "${json.domainColumn ?? "?"}"${json.companyColumn ? `, Company → "${json.companyColumn}"` : ""}.`);
      await onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-[#f0e6ff] text-[#6800FF] flex items-center justify-center"><Link2 size={15} /></span>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">Connect Google Sheet</h2>
              <p className="text-[11px] text-slate-500">Live sync — the Accounts tab refreshes every time it&apos;s opened.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 1 · Sheet URL</label>
            <p className="text-[11px] text-slate-500 mt-0.5 mb-2">Paste the link. The sheet must be set to <span className="font-semibold">&quot;Anyone with the link can view&quot;</span>.</p>
            <div className="flex gap-2">
              <input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className="flex-1 px-3 py-2 text-[12.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10"
              />
              <button onClick={loadTabs} disabled={loadingTabs || !sheetUrl.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50">
                {loadingTabs ? <Loader2 size={12} className="animate-spin" /> : null} Load tabs
              </button>
            </div>
          </div>
          {tabs && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Step 2 · Pick a tab</label>
              <p className="text-[11px] text-slate-500 mt-0.5 mb-2">{tabs.length} {tabs.length === 1 ? "tab" : "tabs"} found.</p>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {tabs.map((t) => (
                  <button key={t.title} onClick={() => setSelectedTab(t.title)} className={`w-full text-left px-3 py-2 rounded-lg border transition-colors flex items-center justify-between gap-2 ${selectedTab === t.title ? "border-[#6800FF] bg-[#f0e6ff]" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className="flex items-center gap-2 min-w-0">
                      <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${selectedTab === t.title ? "border-[#6800FF] bg-[#6800FF]" : "border-slate-300"}`} />
                      <span className="text-[13px] font-semibold text-slate-900 truncate">{t.title}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 tabular-nums shrink-0">{t.rowCount} rows</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-[11px] text-slate-600">
            <p className="font-semibold text-slate-700 mb-1">Required fields:</p>
            <ul className="space-y-0.5">
              <li>• <span className="font-mono text-slate-900">Domain</span> — header can also be Website / URL / Site</li>
              <li>• <span className="font-mono text-slate-900">Company</span> — header can also be Company Name / Account / Brand <span className="text-slate-400">(optional)</span></li>
            </ul>
          </div>
          {error && <div className="text-[12px] px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">{error}</div>}
          {success && <div className="text-[12px] px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">{success}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={connect} disabled={saving || !selectedTab || !tabs || tabs.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 rounded-lg transition-colors">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            {saving ? "Connecting…" : "Connect & Sync"}
          </button>
        </div>
      </div>
    </div>
  );
}

function LeadDncModal({ actor, projectId, initial, totalsOnList, totalsMatched, onClose, onSaved }: {
  actor: string;
  projectId: string;
  initial: string[];
  totalsOnList: number;
  totalsMatched: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [text, setText] = useState(initial.join("\n"));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState("");

  async function save() {
    setSaving(true); setError(""); setFlash("");
    try {
      const res = await fetch("/api/accounts/dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor, projectId, raw: text }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Save failed"); return; }
      setFlash(`Saved ${json.count} domains`);
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-md bg-rose-50 text-rose-600 flex items-center justify-center"><Ban size={15} /></span>
            <div>
              <h2 className="text-[14px] font-bold text-slate-900">DNC List for this Client</h2>
              <p className="text-[11px] text-slate-500">{totalsOnList} on list · {totalsMatched} matched in current sheet.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"><X size={15} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"One domain per line\nmamaearth.co\nnykaa.com"}
            rows={10}
            className="w-full px-3 py-2 text-[12.5px] font-mono bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/10 resize-y"
          />
          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <ListX size={11} className="text-slate-400" />
            Matches root domain too — adding <span className="font-mono">mamaearth.co</span> will also exclude <span className="font-mono">mamaearth.ae</span>.
          </div>
          {error && <div className="text-[12px] px-3 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700">{error}</div>}
          {flash && <div className="text-[12px] px-3 py-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">{flash}</div>}
        </div>
        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors">Close</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 rounded-lg transition-colors">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save DNC List
          </button>
        </div>
      </div>
    </div>
  );
}

