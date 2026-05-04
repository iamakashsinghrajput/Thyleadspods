"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Briefcase, Target, Users, Lightbulb, Award, Ban, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface BriefFormProps {
  pilotId: string;
  clientName: string;
  canEdit: boolean;
}

interface BriefData {
  sellerProduct: string;
  sellerOneLineValue: string;
  sellerCapabilities: string[];
  sellerUsps: string[];
  targetSegments: string[];
  targetPersonas: string[];
  commonPainsSolved: string[];
  caseStudyWins: string[];
  antiIcp: string[];
  notes: string;
}

const EMPTY: BriefData = {
  sellerProduct: "",
  sellerOneLineValue: "",
  sellerCapabilities: [],
  sellerUsps: [],
  targetSegments: [],
  targetPersonas: [],
  commonPainsSolved: [],
  caseStudyWins: [],
  antiIcp: [],
  notes: "",
};

export default function BriefForm({ pilotId, clientName, canEdit }: BriefFormProps) {
  const { user } = useAuth();
  const [data, setData] = useState<BriefData>(EMPTY);
  const [loaded, setLoaded] = useState<BriefData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch(`/api/outbound/pilots/${pilotId}/brief`, { cache: "no-store" });
        const d = (await res.json()) as BriefData;
        if (!ignore) {
          setData(d);
          setLoaded(d);
        }
      } catch {
        if (!ignore) setErr("Failed to load brief.");
      }
    })();
    return () => { ignore = true; };
  }, [pilotId]);

  function update<K extends keyof BriefData>(key: K, value: BriefData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  function updateList(key: keyof BriefData, raw: string) {
    const list = raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    setData((prev) => ({ ...prev, [key]: list }));
  }

  async function save() {
    if (!user) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/outbound/pilots/${pilotId}/brief`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actorRole: user.role, ...data }),
      });
      const d = await res.json();
      if (!res.ok) {
        setErr(d.error || `Save failed (${res.status})`);
        return;
      }
      setSavedTick((n) => n + 1);
      setLoaded(data);
    } finally { setBusy(false); }
  }

  const dirty = loaded ? JSON.stringify(loaded) !== JSON.stringify(data) : true;
  const filled = [
    data.sellerProduct.length > 0,
    data.sellerOneLineValue.length > 0,
    data.sellerCapabilities.length > 0,
    data.sellerUsps.length > 0,
    data.targetSegments.length > 0,
    data.targetPersonas.length > 0,
    data.commonPainsSolved.length > 0,
    data.caseStudyWins.length > 0,
  ].filter(Boolean).length;
  const completionPct = Math.round((filled / 8) * 100);

  return (
    <div className="space-y-4">
      <div className="bg-linear-to-br from-[#f8f5ff] to-white rounded-2xl border border-[#6800FF]/20 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-xl bg-[#6800FF]/10 text-[#6800FF] flex items-center justify-center">
            <Briefcase size={16} />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm font-bold text-slate-900">Client brief for {clientName}</p>
              <p className="text-[11px] tabular-nums text-slate-600">{completionPct}% complete · {filled}/8 sections filled</p>
            </div>
            <p className="text-[12px] text-slate-600 mt-1 leading-relaxed">
              The brain reads this brief on every per-lead research call. Better brief = sharper research = sharper drafts. The seller&apos;s product, target segments, real case-study wins, and anti-ICP all change how each lead&apos;s pain point and value angle get framed.
            </p>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#6800FF] transition-all" style={{ width: `${completionPct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Section icon={<Target size={13} />} title="What the seller does" hint="One paragraph + a one-line value prop the brain can paraphrase per lead">
          <Field label="Seller product" sub="What does this product actually do?" rows={3}
            value={data.sellerProduct} onChange={(v) => update("sellerProduct", v)} disabled={!canEdit}
            placeholder="VWO is a CRO and experimentation platform: A/B testing, behaviour analytics, heatmaps & session recordings, personalization, server-side and mobile-app testing, form analytics. Used by D2C, BFSI, EdTech, SaaS, and travel brands to lift conversion on existing pages without a full redesign or heavy dev investment." />
          <Field label="Value in one line" sub="≤25 words. The headline value the brain anchors body 1 paragraph 2 to" rows={2}
            value={data.sellerOneLineValue} onChange={(v) => update("sellerOneLineValue", v)} disabled={!canEdit}
            placeholder="VWO helps mid-market and enterprise B2C / D2C / BFSI brands lift conversion on their existing funnel without rebuilding pages or shipping new code." />
        </Section>

        <Section icon={<Lightbulb size={13} />} title="Capabilities & USPs" hint="One per line. Brain picks 3 capabilities to reference per lead.">
          <ListField label="Capabilities" sub="What VWO can actually do (the menu the brain picks 3 from)" rows={6}
            value={data.sellerCapabilities} onChange={(raw) => updateList("sellerCapabilities", raw)} disabled={!canEdit}
            placeholder="A/B Testing&#10;Behaviour Analytics&#10;Heatmaps & Session Recording&#10;Personalization&#10;Funnel Analytics&#10;Form Analytics&#10;Server-side Testing" />
          <ListField label="USPs" sub="What sets VWO apart — the brain emphasizes these per pain match" rows={4}
            value={data.sellerUsps} onChange={(raw) => updateList("sellerUsps", raw)} disabled={!canEdit}
            placeholder="No-code experimentation&#10;Mobile-first analytics&#10;Real-time visitor recording&#10;Indian market expertise&#10;ISO 27001 + SOC2 compliant" />
        </Section>

        <Section icon={<Users size={13} />} title="Who to target" hint="Segments + personas the brain uses to confirm fit">
          <ListField label="Target segments" sub="Which segments are most valuable for the seller" rows={5}
            value={data.targetSegments} onChange={(raw) => updateList("targetSegments", raw)} disabled={!canEdit}
            placeholder="D2C — apparel, beauty, wellness&#10;BFSI — banks, insurance, lending&#10;EdTech — UG/PG, upskilling, K-12&#10;SaaS B2B — mid-market+&#10;Travel & mobility&#10;Healthcare diagnostics" />
          <ListField label="Target personas" sub="Buyer titles. Brain uses these to qualify the contact" rows={5}
            value={data.targetPersonas} onChange={(raw) => updateList("targetPersonas", raw)} disabled={!canEdit}
            placeholder="Head of Growth&#10;VP Marketing&#10;Head of CRO / Optimization&#10;Head of Digital&#10;Head of D2C&#10;CMO&#10;Head of Product&#10;Senior Product Manager" />
        </Section>

        <Section icon={<Lightbulb size={13} />} title="Pains the seller solves" hint="The menu the brain matches each prospect's situation against">
          <ListField label="Common pains solved" sub="One per line. Brain picks the most relevant per lead" rows={9}
            value={data.commonPainsSolved} onChange={(raw) => updateList("commonPainsSolved", raw)} disabled={!canEdit}
            placeholder="Checkout abandonment, especially on mobile&#10;Low conversion on tier-2/3 cohort&#10;Long KYC / document upload drop-off&#10;Demo form drop-off due to persona collision&#10;Free-to-paid drop-off in EdTech&#10;Category page density issues&#10;Heavy dev cost of every test cycle&#10;No visibility into where users hesitate&#10;Same homepage serving multiple buyer types" />
        </Section>

        <Section icon={<Award size={13} />} title="Case-study wins" hint="Specific, verified metrics the brain can cite as social proof">
          <ListField label="Case study wins" sub='Format: "Brand: metric outcome". Brain uses these (verbatim) in body 1' rows={9}
            value={data.caseStudyWins} onChange={(raw) => updateList("caseStudyWins", raw)} disabled={!canEdit}
            placeholder="BigBasket: 30% lift in cart-to-checkout&#10;ICICI Bank: 47% drop in CPA on insurance funnel&#10;HDFC ERGO: 47% CPA reduction&#10;Wakefit: 75% lift in mobile PDP CVR&#10;Yuppiechef: 100% lift in nav rework conversion&#10;POSist / Restroworks: 52% demo-form lift&#10;Andaaz Fashion: 125% lift on size-guide test&#10;Online Manipal: improved free-to-paid by 20%" />
        </Section>

        <Section icon={<Ban size={13} />} title="Anti-ICP (who NOT to target)" hint="Brain de-prioritizes these and surfaces a flag in the lead view">
          <ListField label="Anti-ICP" sub="Stage / segment / size / signal that disqualifies a lead" rows={6}
            value={data.antiIcp} onChange={(raw) => updateList("antiIcp", raw)} disabled={!canEdit}
            placeholder="Pre-PMF / pre-revenue (under $1M ARR)&#10;<50 employees (no buying committee)&#10;Government / public sector&#10;Manufacturing without ecom presence&#10;Already a paying VWO customer&#10;Direct competitors (Optimizely, AB Tasty, Mida)&#10;Non-Indian companies (this pilot is India-focused)" />
          <Field label="Notes (free-form)" sub="Anything else the brain should know about the seller's positioning" rows={5}
            value={data.notes} onChange={(v) => update("notes", v)} disabled={!canEdit}
            placeholder="VWO is on a 14-day free trial motion. Indian buyers respond best to direct value framing + 3 blue-chip brand stack. Avoid mentioning specific dollar figures (Indian market is INR-coded). Indian fintech buyers' #1 silent objection is 'this needs my engineering team's bandwidth' — pre-empt this by referencing 'no heavy dev effort' explicitly." />
        </Section>
      </div>

      {err && <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">{err}</p>}
      {savedTick > 0 && !err && <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">Saved. The brain will use the new brief on the next phase 8 / 9 run.</p>}

      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={save} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-300 text-white text-sm font-semibold rounded-lg transition-colors">
            {busy ? <><Loader2 size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save brief for {clientName}</>}
          </button>
          {dirty && loaded && (
            <button onClick={() => setData(loaded)} disabled={busy} className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium rounded-lg transition-colors">
              Discard changes
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3 inline-flex items-start gap-1.5">
        <FileText size={12} className="shrink-0 mt-0.5 text-slate-400" />
        <span><strong>How this is used:</strong> Phase 8 (research) injects this brief into every per-lead Claude call. The brain reads <em>both</em> the live Tavily research about the prospect <em>and</em> this brief about the seller, then writes per-lead pain mapping that connects them. After saving, hit &ldquo;Run from here&rdquo; on Phase 8 in the Pipeline tab to re-research with the updated brief.</span>
      </p>
    </div>
  );
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 space-y-3">
      <div>
        <p className="text-xs font-bold text-slate-800 inline-flex items-center gap-1.5"><span className="text-[#6800FF]">{icon}</span> {title}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Field({ label, sub, value, onChange, disabled, placeholder, rows }: { label: string; sub: string; value: string; onChange: (v: string) => void; disabled?: boolean; placeholder?: string; rows: number }) {
  const wc = value.split(/\s+/).filter(Boolean).length;
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-700">{label}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">{wc} words</span>
      </div>
      <p className="text-[10px] text-slate-500 mb-1">{sub}</p>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={rows} placeholder={placeholder}
        className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-[12px] leading-relaxed focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15 disabled:bg-slate-50 resize-y" />
    </label>
  );
}

function ListField({ label, sub, value, onChange, disabled, placeholder, rows }: { label: string; sub: string; value: string[]; onChange: (raw: string) => void; disabled?: boolean; placeholder?: string; rows: number }) {
  const text = value.join("\n");
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-bold text-slate-700">{label}</span>
        <span className="text-[10px] text-slate-400 tabular-nums">{value.length} entries</span>
      </div>
      <p className="text-[10px] text-slate-500 mb-1">{sub}</p>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={rows} placeholder={placeholder}
        className="w-full px-2.5 py-2 border border-slate-200 rounded-md text-[12px] font-mono leading-relaxed focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15 disabled:bg-slate-50 resize-y" />
    </label>
  );
}
