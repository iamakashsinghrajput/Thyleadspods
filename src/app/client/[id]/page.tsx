"use client";

import { use, useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, X, Upload, Pickaxe, Plus, Pencil, Check, Download } from "lucide-react";
import { useData } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-context";
import { usePods } from "@/lib/pod-context";
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

const metricCols = [
  { label: "Date", short: "Date", bp: 80, w: 220 },
  { label: "Leads Uploaded", short: "Leads", bp: 120, w: 220 },
  { label: "Accounts Mined", short: "Accounts", bp: 130, w: 220 },
  { label: "Daily Total", short: "Total", bp: 100, w: 220 },
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
  const { projects, details, addDetail, updateDetail, deleteDetail, metrics, addMetric, updateMetric, deleteMetric, updateProject } = useData();
  const { addNotification } = useNotifications();

  const isPod = user?.role === "pod" || user?.role === "superadmin";
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const contactResize = useResizableCols(contactCols.map((c) => c.w));
  const metricResize = useResizableCols(metricCols.map((c) => c.w));
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
  const [popupRemarks, setPopupRemarks] = useState("");
  const [popupAdditionalInfo, setPopupAdditionalInfo] = useState("");
  const [popupSummary, setPopupSummary] = useState("");
  const [clientRemarks, setClientRemarks] = useState<Record<string, { remark: string; updatedAt: string; updatedBy: string }>>({});
  const [celebration, setCelebration] = useState<string | null>(null);
  const [smartleadIdsDraft, setSmartleadIdsDraft] = useState("");
  const [smartleadSaving, setSmartleadSaving] = useState(false);
  const [smartleadSavedAt, setSmartleadSavedAt] = useState(0);
  const [smartleadPickerOpen, setSmartleadPickerOpen] = useState(false);
  const [smartleadPickerLoading, setSmartleadPickerLoading] = useState(false);
  const [smartleadPickerError, setSmartleadPickerError] = useState("");
  const [smartleadPickerQuery, setSmartleadPickerQuery] = useState("");
  const [smartleadPickerStatus, setSmartleadPickerStatus] = useState<"all" | "active" | "paused" | "completed" | "other">("all");
  const [smartleadPickerCampaigns, setSmartleadPickerCampaigns] = useState<Array<{ id: number; name: string; status: string }>>([]);
  useEffect(() => {
    setSmartleadIdsDraft((project?.smartleadCampaignIds || []).join(", "));
  }, [project?.smartleadCampaignIds]);
  const smartleadCurrent = (project?.smartleadCampaignIds || []).join(", ");
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
    setSmartleadSavedAt(Date.now());
    setTimeout(() => setSmartleadSavedAt(0), 2500);
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

  const metricsData = metrics[id] ?? [];
  const metricsMonths = [...new Set(metricsData.map((m) => `${m.month} ${m.year}`))];
  const [selectedMetricsMonth, setSelectedMetricsMonth] = useState(metricsMonths[0] ?? "");
  const activeMetrics = metricsData.find((m) => `${m.month} ${m.year}` === selectedMetricsMonth);
  const dailyRows = activeMetrics?.dailyMetrics ?? [];
  const totalLeads = dailyRows.reduce((s, d) => s + d.leadsUploaded, 0);
  const totalAccounts = dailyRows.reduce((s, d) => s + d.accountsMined, 0);

  const [showMetricForm, setShowMetricForm] = useState(false);
  const [editingMetricDate, setEditingMetricDate] = useState<string | null>(null);
  const [metricForm, setMetricForm] = useState({ date: "", leadsUploaded: "", accountsMined: "" });

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

  function resetMetricForm() {
    setMetricForm({ date: "", leadsUploaded: "", accountsMined: "" });
    setShowMetricForm(false);
    setEditingMetricDate(null);
  }

  function handleSaveMetric() {
    if (!activeMetrics) return;
    const leads = Number(metricForm.leadsUploaded) || 0;
    const accounts = Number(metricForm.accountsMined) || 0;
    if (editingMetricDate) {
      updateMetric(id, activeMetrics.month, activeMetrics.year, editingMetricDate, { date: metricForm.date, leadsUploaded: leads, accountsMined: accounts });
      if (isPod) addNotification(`${podLabel} updated metrics for ${clientName} on ${metricForm.date}`, "admin");
    } else {
      addMetric(id, metricForm.date, activeMetrics.month, activeMetrics.year, leads, accounts);
      if (isPod) addNotification(`${podLabel} added metrics for ${clientName} on ${metricForm.date} — Leads: ${leads}, Accounts: ${accounts}`, "admin");
    }
    resetMetricForm();
  }

  function handleDeleteMetric(date: string) {
    if (!activeMetrics) return;
    deleteMetric(id, activeMetrics.month, activeMetrics.year, date);
    if (isPod) addNotification(`${podLabel} deleted metrics for ${clientName} on ${date}`, "admin");
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

  function exportMetrics() {
    if (!dailyRows.length) return;
    const headers = ["Date", "Leads Uploaded", "Accounts Mined", "Daily Total"];
    const rows = dailyRows.map((d) => [d.date, String(d.leadsUploaded), String(d.accountsMined), String(d.leadsUploaded + d.accountsMined)]);
    rows.push(["Total", String(totalLeads), String(totalAccounts), String(totalLeads + totalAccounts)]);
    const monthLabel = selectedMetricsMonth.replace(/\s+/g, "_");
    downloadCsv(`${clientName.replace(/\s+/g, "_")}_metrics_${monthLabel}.csv`, headers, rows);
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

      <div className="px-8 pb-8 space-y-8">

        {isAdmin && (
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

        {project && (
          <CampaignDetails projectId={project.id} actorEmail={user?.email || ""} />
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-slate-800">Daily Metrics</h2>
              {metricsMonths.length > 0 && (
                <select value={selectedMetricsMonth} onChange={(e) => setSelectedMetricsMonth(e.target.value)} className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20">
                  {metricsMonths.map((m, i) => <option key={`mm-${i}`} value={m}>{m}</option>)}
                </select>
              )}
            </div>
            <div className="flex items-center gap-2">
              {dailyRows.length > 0 && (
                <button onClick={exportMetrics} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium rounded-lg transition-colors">
                  <Download size={14} /> Export CSV
                </button>
              )}
              {isPod && !showMetricForm && activeMetrics && (
                <button onClick={() => { resetMetricForm(); setShowMetricForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors">
                  <Plus size={14} /> Add
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#f0e6ff] border border-[#e0ccff]"><Upload size={16} className="text-[#6800FF]" /></div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Leads Uploaded</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{totalLeads}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100"><Pickaxe size={16} className="text-emerald-600" /></div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase">Accounts Mined</p>
                <p className="text-xl font-bold text-slate-900 tabular-nums">{totalAccounts}</p>
              </div>
            </div>
          </div>

          {showMetricForm && isPod && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 mb-3 space-y-3">
              <p className="text-sm font-semibold text-slate-700">{editingMetricDate ? "Edit Entry" : "New Entry"}</p>
              <div className="grid grid-cols-3 gap-2.5">
                <input type="date" value={metricForm.date} onChange={(e) => setMetricForm({ ...metricForm, date: e.target.value })} className={inputClass} />
                <input type="number" placeholder="Leads Uploaded" value={metricForm.leadsUploaded} onChange={(e) => setMetricForm({ ...metricForm, leadsUploaded: e.target.value })} className={inputClass} />
                <input type="number" placeholder="Accounts Mined" value={metricForm.accountsMined} onChange={(e) => setMetricForm({ ...metricForm, accountsMined: e.target.value })} className={inputClass} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveMetric} className="flex items-center gap-1.5 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors"><Check size={14} /> {editingMetricDate ? "Update" : "Save"}</button>
                <button onClick={resetMetricForm} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors">Cancel</button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="overflow-auto max-h-[70vh]">
              <table className="w-full text-sm text-left" style={{ tableLayout: "fixed", minWidth: metricResize.widths.reduce((a, b) => a + b, 0) + (isPod ? 80 : 0) }}>
                <colgroup>
                  {metricResize.widths.map((w, i) => <col key={i} style={{ width: w }} />)}
                  {isPod && <col style={{ width: 80 }} />}
                </colgroup>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 uppercase tracking-wider">
                    {metricCols.map((col, i) => (
                      <th key={i} title={col.label} className={`relative px-4 py-3 font-semibold overflow-hidden text-ellipsis whitespace-nowrap bg-slate-50 ${i > 0 ? "text-right" : ""}`}>
                        {metricResize.widths[i] < col.bp ? col.short : col.label}
                        <div onMouseDown={(e) => metricResize.onMouseDown(i, e)} className="absolute right-0 top-2 bottom-2 w-0.75 cursor-col-resize rounded-full bg-slate-200 hover:bg-[#5800DD] active:bg-[#6800FF] transition-colors" />
                      </th>
                    ))}
                    {isPod && <th className="px-4 py-3 w-20"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dailyRows.map((day) => (
                    <tr key={day.date} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-2.5 text-slate-700 tabular-nums font-medium overflow-hidden truncate">{day.date}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-indigo-700 overflow-hidden truncate">{day.leadsUploaded}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-emerald-700 overflow-hidden truncate">{day.accountsMined}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900 overflow-hidden truncate">{day.leadsUploaded + day.accountsMined}</td>
                      {isPod && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingMetricDate(day.date); setMetricForm({ date: day.date, leadsUploaded: String(day.leadsUploaded), accountsMined: String(day.accountsMined) }); setShowMetricForm(true); }} className="p-1.5 rounded-md text-slate-400 hover:text-[#6800FF] hover:bg-[#f0e6ff] transition-colors"><Pencil size={14} /></button>
                            <ConfirmDelete onConfirm={() => handleDeleteMetric(day.date)} />
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {dailyRows.length === 0 && (
                    <tr><td colSpan={metricCols.length + (isPod ? 1 : 0)} className="px-4 py-12 text-center text-slate-400">No metrics data</td></tr>
                  )}
                </tbody>
                {dailyRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50/60 border-t border-slate-200">
                      <td className="px-4 py-2.5 font-semibold text-slate-600 text-xs uppercase">Total</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-indigo-700">{totalLeads}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-emerald-700">{totalAccounts}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-bold text-slate-900">{totalLeads + totalAccounts}</td>
                      {isPod && <td></td>}
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </section>
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
