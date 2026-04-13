"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { useData } from "@/lib/data-context";
import { LogOut, Calendar, CheckCircle2, Clock, MessageSquare, X, Mail, Phone, User, Building2, Globe, Video, Loader2, Search } from "lucide-react";
import Image from "next/image";
import type { ClientDetail } from "@/lib/client-data";

interface RemarkData {
  remark: string;
  updatedAt: string;
  updatedBy: string;
}

function fmtDate(d: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function fmtRelative(d: string) {
  if (!d) return "";
  const now = Date.now();
  const then = new Date(d).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const statusStyle: Record<string, { bg: string; text: string; label: string }> = {
  done: { bg: "bg-emerald-50", text: "text-emerald-700", label: "Completed" },
  scheduled: { bg: "bg-blue-50", text: "text-blue-700", label: "Scheduled" },
  pipeline: { bg: "bg-amber-50", text: "text-amber-700", label: "Pipeline" },
};

export default function ClientPortal() {
  const { user, logout } = useAuth();
  const { details } = useData();
  const [remarks, setRemarks] = useState<Record<string, RemarkData>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientDetail | null>(null);
  const [editingRemark, setEditingRemark] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");

  const projectId = user?.projectId || "";
  const meetings: ClientDetail[] = details[projectId] ?? [];

  const fetchRemarks = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(`/api/portal/meetings?projectId=${projectId}`);
      const data = await res.json();
      setRemarks(data.remarks || {});
    } catch {}
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    let ignore = false;
    (async () => { if (!ignore) await fetchRemarks(); })();
    return () => { ignore = true; };
  }, [fetchRemarks]);

  async function saveRemark() {
    if (!selected || !user) return;
    setSavingRemark(true);
    try {
      const res = await fetch("/api/portal/remark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          meetingId: selected.meetingId,
          remark: editingRemark,
          updatedBy: user.name,
        }),
      });
      const data = await res.json();
      setRemarks((prev) => ({
        ...prev,
        [selected.meetingId]: { remark: data.remark, updatedAt: data.updatedAt, updatedBy: data.updatedBy },
      }));
    } catch {}
    setSavingRemark(false);
  }

  function openMeeting(m: ClientDetail) {
    setSelected(m);
    setEditingRemark(remarks[m.meetingId]?.remark || "");
  }

  if (!user) return null;

  const months = [...new Set(meetings.map((m) => `${m.month} ${m.year}`))];
  const now = new Date();
  const currentMonth = now.toLocaleDateString("en-US", { month: "long" });
  const currentYear = now.getFullYear();
  const thisMonthMeetings = meetings.filter((m) => m.month === currentMonth && m.year === currentYear);

  const filtered = meetings.filter((m) => {
    if (statusFilter !== "all" && m.meetingStatus !== statusFilter) return false;
    if (monthFilter !== "all" && `${m.month} ${m.year}` !== monthFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.companyName.toLowerCase().includes(q) || m.contactName.toLowerCase().includes(q) || m.meetingId.toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    const numA = parseInt(a.meetingId.replace(/\D/g, ""), 10) || 0;
    const numB = parseInt(b.meetingId.replace(/\D/g, ""), 10) || 0;
    return numA - numB;
  });

  const meetingsWithRemarks = filtered.filter((m) => remarks[m.meetingId]?.remark);

  return (
    <div className="min-h-screen bg-[#F8F9FA] font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="w-full px-6 lg:px-10 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Thyleads" width={32} height={32} className="rounded-lg" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">{user.name}</h1>
              <p className="text-[11px] text-slate-400">Client Portal</p>
            </div>
          </div>
          <button onClick={logout} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-500 hover:text-red-500 bg-slate-50 hover:bg-red-50 rounded-xl transition-colors">
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </header>

      <div className="w-full px-6 lg:px-10 py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#6800FF]/10 flex items-center justify-center">
                <Calendar size={20} className="text-[#6800FF]" />
              </div>
              <p className="text-sm font-semibold text-slate-500">This Month</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{thisMonthMeetings.length}</p>
            <p className="text-xs text-slate-400 mt-1">{currentMonth} {currentYear}</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Completed</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{meetings.filter((m) => m.meetingStatus === "done").length}</p>
            <p className="text-xs text-slate-400 mt-1">All time</p>
          </div>
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                <Clock size={20} className="text-blue-500" />
              </div>
              <p className="text-sm font-semibold text-slate-500">Total Meetings</p>
            </div>
            <p className="text-3xl font-bold text-slate-900">{meetings.length}</p>
            <p className="text-xs text-slate-400 mt-1">Overall</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <h2 className="text-lg font-bold text-slate-900 shrink-0">All Meetings</h2>
              <div className="flex-1 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-48">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input type="text" placeholder="Search company, contact, or ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF]" />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF]">
                  <option value="all">All Status</option>
                  <option value="done">Completed</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="pipeline">Pipeline</option>
                </select>
                <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF]">
                  <option value="all">All Months</option>
                  {months.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-[#6800FF] animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Calendar size={40} className="text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">No meetings found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((m) => {
                const st = statusStyle[m.meetingStatus] || statusStyle.pipeline;
                const rm = remarks[m.meetingId];
                const hasRemark = !!rm?.remark;
                return (
                  <button key={m.id} onClick={() => openMeeting(m)} className="w-full px-6 py-4 flex items-center gap-4 text-left hover:bg-slate-50 transition-colors group">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-500 shrink-0 group-hover:bg-[#6800FF]/10 group-hover:text-[#6800FF] transition-colors">
                      {m.meetingId.split("-")[1]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{m.companyName}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.bg} ${st.text}`}>{st.label}</span>
                        {hasRemark && (
                          <span className="flex items-center gap-1 text-[10px] text-[#6800FF] bg-[#6800FF]/5 px-2 py-0.5 rounded-full shrink-0">
                            <MessageSquare size={9} /> Remark
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {m.contactName} · {m.contactTitle}
                      </p>
                    </div>
                    <div className="text-right shrink-0 hidden sm:block">
                      <p className="text-sm font-medium text-slate-700">{fmtDate(m.meetingDate)}</p>
                      <p className="text-xs text-slate-400">{m.meetingTime}</p>
                    </div>
                    {hasRemark && rm && (
                      <div className="text-right shrink-0 hidden md:block">
                        <p className="text-[10px] text-slate-400">{fmtRelative(rm.updatedAt)}</p>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {meetingsWithRemarks.length > 0 && (
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-400">
              {meetingsWithRemarks.length} meeting{meetingsWithRemarks.length !== 1 ? "s" : ""} with remarks
            </div>
          )}
        </div>
      </div>

      {selected && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{selected.companyName}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${(statusStyle[selected.meetingStatus] || statusStyle.pipeline).bg} ${(statusStyle[selected.meetingStatus] || statusStyle.pipeline).text}`}>
                    {(statusStyle[selected.meetingStatus] || statusStyle.pipeline).label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{selected.meetingId} · {fmtDate(selected.meetingDate)}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Meeting Details</p>
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Calendar size={13} className="text-slate-400" />
                    {fmtDate(selected.meetingDate)} at {selected.meetingTime}
                  </div>
                  {selected.geo && (
                    <div className="flex items-center gap-2 text-sm text-slate-700">
                      <Globe size={13} className="text-slate-400" />
                      {selected.geo}
                    </div>
                  )}
                  {selected.meetingLink && (
                    <a href={selected.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#6800FF] hover:text-[#5800DD]">
                      <Video size={13} /> Join Meeting
                    </a>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Contact</p>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <User size={13} className="text-slate-400" />
                    {selected.contactName}
                  </div>
                  {selected.contactTitle && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Building2 size={13} className="text-slate-400" />
                      {selected.contactTitle}
                    </div>
                  )}
                  {selected.contactEmail && (
                    <a href={`mailto:${selected.contactEmail}`} className="flex items-center gap-2 text-sm text-[#6800FF] hover:text-[#5800DD]">
                      <Mail size={13} /> {selected.contactEmail}
                    </a>
                  )}
                  {selected.contactNumber && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone size={13} className="text-slate-400" />
                      {selected.contactNumber}
                    </div>
                  )}
                </div>
              </div>

              {(selected.salesRep || selected.accountManager) && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Assigned Team</p>
                  <div className="flex items-center gap-6">
                    {selected.salesRep && <div className="text-sm"><span className="text-slate-400">Campaign Owner:</span> <span className="font-medium text-slate-800">{selected.salesRep}</span></div>}
                    {selected.accountManager && <div className="text-sm"><span className="text-slate-400">AM:</span> <span className="font-medium text-slate-800">{selected.accountManager}</span></div>}
                  </div>
                </div>
              )}

              {selected.meetingSummary && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2">Meeting Summary</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{selected.meetingSummary}</p>
                </div>
              )}

              <div className="bg-[#6800FF]/5 rounded-xl p-4 border border-[#6800FF]/10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-semibold text-[#6800FF] uppercase flex items-center gap-1.5">
                    <MessageSquare size={11} /> Remarks
                  </p>
                  {remarks[selected.meetingId]?.updatedAt && (
                    <p className="text-[10px] text-slate-400">
                      Last updated {fmtRelative(remarks[selected.meetingId].updatedAt)}
                      {remarks[selected.meetingId].updatedBy && ` by ${remarks[selected.meetingId].updatedBy}`}
                    </p>
                  )}
                </div>
                <textarea
                  value={editingRemark}
                  onChange={(e) => setEditingRemark(e.target.value)}
                  placeholder="Add your remarks about this meeting..."
                  rows={4}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-[#6800FF] focus:ring-1 focus:ring-[#6800FF]/20 resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-slate-400">
                    {editingRemark !== (remarks[selected.meetingId]?.remark || "") ? "Unsaved changes" : ""}
                  </p>
                  <button
                    onClick={saveRemark}
                    disabled={savingRemark || editingRemark === (remarks[selected.meetingId]?.remark || "")}
                    className="px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    {savingRemark ? <><Loader2 size={12} className="animate-spin" /> Saving...</> : "Save Remark"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
