"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Building2,
  Search,
  Plus,
  Check,
  X,
  Download,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { usePods } from "@/lib/pod-context";
import type { PodInfo } from "@/lib/pod-context";
import { useData, type ClientProject } from "@/lib/data-context";
import { useAuth } from "@/lib/auth-context";
import { useNotifications } from "@/lib/notification-context";

type HealthStatus = "red" | "amber" | "green";

const clientLogos: Record<string, string> = {
  thyleads: "/clients/thyleads.png",
  clevertapin: "/clients/clevertap.png",
  bluedove: "/clients/bluedove.png",
  evality: "/clients/evality.png",
  onecap: "/clients/onecap.png",
  mynd: "/clients/mynd.png",
  actyv: "/clients/actyv.png",
  zigtal: "/clients/zigtal.png",
  vwo: "/clients/vwo.png",
  pazo: "/clients/pazo.png",
  venwiz: "/clients/venwiz.png",
  infeedo: "/clients/infeedo.png",
};

function getCompletionPercent(project: ClientProject): number {
  if (project.monthlyTargetInternal === 0) return 0;
  return Math.round(((project.meetingCompleted || 0) / project.monthlyTargetInternal) * 100);
}

function getHealthStatus(percent: number): HealthStatus {
  if (percent >= 75) return "green";
  if (percent >= 50) return "amber";
  return "red";
}

const healthConfig: Record<HealthStatus, { bg: string; text: string; border: string; label: string; icon: LucideIcon; iconColor: string }> = {
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", label: "At Risk", icon: AlertCircle, iconColor: "text-red-500" },
  amber: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Needs Attention", icon: AlertTriangle, iconColor: "text-amber-500" },
  green: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "On Track", icon: CheckCircle2, iconColor: "text-emerald-500" },
};

function PodDropdown({ value, onChange, pods, podMap, editable = true }: { value: string; onChange: (pod: string) => void; pods: PodInfo[]; podMap: Record<string, PodInfo>; editable?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number }>({ top: 0, left: 0, maxHeight: 320 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const current = podMap[value];

  const place = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const spaceBelow = vh - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const desired = Math.min(320, pods.length * 56 + 8);
    const openUp = spaceBelow < desired && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, openUp ? spaceAbove : spaceBelow);
    const top = openUp ? Math.max(8, rect.top - Math.min(desired, maxHeight) - 4) : rect.bottom + 4;
    setPos({ top, left: rect.left, maxHeight });
  }, [pods.length]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  if (!editable) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap ${current?.bgLight} ${current?.text}`}>
        <span className={`w-2 h-2 rounded-full shrink-0 ${current?.color}`} />
        {current?.name ?? value}
      </span>
    );
  }

  function toggle() {
    if (!open) place();
    setOpen(!open);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer transition-colors border border-transparent hover:border-slate-200 whitespace-nowrap ${current.bgLight} ${current.text}`}
      >
        <div className={`w-2 h-2 rounded-full shrink-0 ${current.color}`} />
        {current.name}
        <svg className={`h-4 w-4 ml-1 transition-transform ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="fixed z-50 w-56 bg-white rounded-lg border border-slate-200 shadow-lg py-1 overflow-y-auto"
            style={{ top: pos.top, left: pos.left, maxHeight: pos.maxHeight }}
          >
            {pods.map((pod) => (
              <button
                key={pod.id}
                type="button"
                onClick={() => { onChange(pod.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${pod.id === value ? "bg-slate-50" : ""}`}
              >
                <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pod.color}`} />
                <div>
                  <p className={`text-sm font-medium ${pod.id === value ? pod.text : "text-slate-900"}`}>{pod.name}</p>
                  <p className="text-xs text-slate-500">{pod.members.join(", ")}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

const columns = [
  { key: "client", label: "Client Name", short: "Client", breakpoint: 160, defaultWidth: 200, align: "left" as const },
  { key: "pod", label: "Assigned Pod", short: "Pod", breakpoint: 140, defaultWidth: 150, align: "left" as const },
  { key: "monthlyExt", label: "Monthly Target (Ext)", short: "MT (Ext)", breakpoint: 150, defaultWidth: 170, align: "right" as const },
  { key: "weeklyExt", label: "Weekly Target (Ext)", short: "WT (Ext)", breakpoint: 150, defaultWidth: 160, align: "right" as const },
  { key: "monthlyInt", label: "Monthly Target (Int)", short: "MT (Int)", breakpoint: 150, defaultWidth: 170, align: "right" as const },
  { key: "completion", label: "Completion %", short: "Comp %", breakpoint: 140, defaultWidth: 200, align: "left" as const },
  { key: "achieved", label: "Target Achieved", short: "Achieved", breakpoint: 150, defaultWidth: 180, align: "right" as const },
  { key: "health", label: "Health Status", short: "Health", breakpoint: 130, defaultWidth: 150, align: "center" as const },
];

function EditableTargetCell({ value, editable, onSave }: { value: number; editable: boolean; onSave: (v: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (!editable || !editing) {
    return (
      <td
        className={`px-6 py-4 text-right tabular-nums font-medium text-slate-900 overflow-hidden truncate ${editable ? "cursor-pointer hover:bg-[#6800FF]/5 transition-colors" : ""}`}
        onDoubleClick={() => { if (editable) { setDraft(String(value)); setEditing(true); } }}
        title={editable ? "Double-click to edit" : undefined}
      >
        {value}
      </td>
    );
  }

  return (
    <td className="px-2 py-2 overflow-hidden">
      <input
        type="number"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(Number(draft) || 0); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(Number(draft) || 0); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full px-3 py-2 text-right text-sm font-medium border-2 border-[#6800FF] rounded-lg bg-white focus:outline-none tabular-nums"
      />
    </td>
  );
}

interface ProjectTableProps {
  selectedMonth: string;
  selectedYear: number;
}

export default function ProjectTable({ selectedMonth, selectedYear }: ProjectTableProps) {
  const { pods, podMap } = usePods();
  const { projects, addProject, updateProject, details } = useData();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const { addNotification } = useNotifications();
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [projectRemarkCounts, setProjectRemarkCounts] = useState<Record<string, number>>({});

  const projectStats = useMemo(() => {
    if (selectedMonth === "all") return null;
    const stats: Record<string, { completed: number; booked: number }> = {};
    for (const [projectId, list] of Object.entries(details)) {
      const filtered = list.filter((d) => d.month === selectedMonth && d.year === selectedYear);
      stats[projectId] = {
        completed: filtered.filter((d) => d.meetingStatus === "done").length,
        booked: filtered.filter((d) => d.meetingStatus === "scheduled").length,
      };
    }
    return stats;
  }, [details, selectedMonth, selectedYear]);

  function getFilteredCompleted(project: ClientProject): number {
    if (!projectStats) return project.meetingCompleted || 0;
    return projectStats[project.id]?.completed || 0;
  }

  function getFilteredBooked(project: ClientProject): number {
    if (!projectStats) return project.meetingBooked || 0;
    return projectStats[project.id]?.booked || 0;
  }

  useEffect(() => {
    let ignore = false;
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(projects.map(async (p) => {
        try {
          const res = await fetch(`/api/portal/meetings?projectId=${p.id}`);
          const data = await res.json();
          const remarks = data.remarks || {};
          counts[p.id] = Object.values(remarks).filter((r) => (r as { remark: string }).remark).length;
        } catch {}
      }));
      if (!ignore) setProjectRemarkCounts(counts);
    })();
    return () => { ignore = true; };
  }, [projects]);
  const [newClient, setNewClient] = useState({ clientName: "", assignedPod: "pod1", monthlyTargetExternal: "", weeklyTargetExternal: "", monthlyTargetInternal: "" });
  const [colWidths, setColWidths] = useState<number[]>(columns.map((c) => c.defaultWidth));
  const dragRef = useRef<{ colIndex: number; startX: number; startWidth: number } | null>(null);

  const onMouseDown = useCallback((colIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { colIndex, startX: e.clientX, startWidth: colWidths[colIndex] };

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const diff = ev.clientX - dragRef.current.startX;
      const newWidth = Math.max(80, dragRef.current.startWidth + diff);
      setColWidths((prev) => {
        const next = [...prev];
        next[dragRef.current!.colIndex] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [colWidths]);

  function handlePodChange(projectId: string, newPodId: string) {
    const proj = projects.find((p) => p.id === projectId);
    const newPod = podMap[newPodId];
    updateProject(projectId, { assignedPod: newPodId });
    if (proj && newPod) {
      addNotification(`Admin assigned "${proj.clientName}" to your pod`, "pod", newPodId);
    }
  }

  const filteredProjects = projects.filter((p) =>
    p.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleAddClient() {
    if (!newClient.clientName.trim()) return;
    const nextNum = projects.length + 1;
    const project: ClientProject = {
      id: `p${Date.now()}`,
      clientId: `CLT-${1000 + nextNum}`,
      clientName: newClient.clientName.trim(),
      assignedPod: newClient.assignedPod,
      monthlyTargetExternal: Number(newClient.monthlyTargetExternal) || 0,
      weeklyTargetExternal: Number(newClient.weeklyTargetExternal) || 0,
      monthlyTargetInternal: Number(newClient.monthlyTargetInternal) || 0,
      targetsAchieved: 0,
      meetingCompleted: 0,
      meetingBooked: 0,
    };
    addProject(project);
    addNotification(`Admin assigned new client "${project.clientName}" to your pod`, "pod", project.assignedPod);
    setNewClient({ clientName: "", assignedPod: "pod1", monthlyTargetExternal: "", weeklyTargetExternal: "", monthlyTargetInternal: "" });
    setShowAddForm(false);
  }

  function exportProjects() {
    const headers = ["Client ID", "Client Name", "Pod", "Monthly Target (Ext)", "Weekly Target (Ext)", "Monthly Target (Int)", "Achieved", "Completion %", "Health"];
    const rows = filteredProjects.map((p) => {
      const completed = getFilteredCompleted(p);
      const booked = getFilteredBooked(p);
      const achieved = completed + booked;
      const pct = p.monthlyTargetInternal > 0 ? Math.round((completed / p.monthlyTargetInternal) * 100) : 0;
      const health = pct >= 75 ? "On Track" : pct >= 50 ? "Needs Attention" : "At Risk";
      const pod = podMap[p.assignedPod]?.name || p.assignedPod;
      return [p.clientId, p.clientName, pod, String(p.monthlyTargetExternal), String(p.weeklyTargetExternal), String(p.monthlyTargetInternal), String(achieved), `${pct}%`, health];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => v.includes(",") ? `"${v}"` : v).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "projects.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Client Projects</h2>
          <p className="text-xs text-slate-400 mt-0.5">{filteredProjects.length} of {projects.length} projects</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-9 pr-4 py-2 bg-white border border-slate-200/80 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF] transition-all shadow-sm"
            />
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white rounded-xl text-sm font-medium transition-colors shadow-sm"
            >
              {showAddForm ? <X size={15} /> : <Plus size={15} />}
              {showAddForm ? "Cancel" : "Add Client"}
            </button>
          )}
          <button onClick={exportProjects} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200/80 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm">
            <Download size={15} />
            Export CSV
          </button>
        </div>
      </div>

      {showAddForm && isAdmin && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">New Client</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <input
              placeholder="Client Name"
              value={newClient.clientName}
              onChange={(e) => setNewClient({ ...newClient, clientName: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
            />
            <select
              value={newClient.assignedPod}
              onChange={(e) => setNewClient({ ...newClient, assignedPod: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
            >
              {pods.map((pod) => (
                <option key={pod.id} value={pod.id}>{pod.name}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Monthly Target (Ext)"
              value={newClient.monthlyTargetExternal}
              onChange={(e) => setNewClient({ ...newClient, monthlyTargetExternal: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
            />
            <input
              type="number"
              placeholder="Weekly Target (Ext)"
              value={newClient.weeklyTargetExternal}
              onChange={(e) => setNewClient({ ...newClient, weeklyTargetExternal: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
            />
            <input
              type="number"
              placeholder="Monthly Target (Int)"
              value={newClient.monthlyTargetInternal}
              onChange={(e) => setNewClient({ ...newClient, monthlyTargetInternal: e.target.value })}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6800FF]/20 focus:border-[#6800FF]"
            />
          </div>
          <button onClick={handleAddClient} className="flex items-center gap-1.5 px-4 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-lg transition-colors">
            <Check size={14} /> Add Client
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="text-sm text-left" style={{ tableLayout: "fixed", width: colWidths.reduce((a, b) => a + b, 0) }}>
              <colgroup>
                {colWidths.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200">
                  {columns.map((col, i) => (
                    <th
                      key={col.key}
                      title={col.label}
                      className={`relative px-6 py-4 font-semibold text-slate-600 text-xs uppercase tracking-wider overflow-hidden text-ellipsis whitespace-nowrap ${
                        col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                      }`}
                    >
                      {colWidths[i] < col.breakpoint ? col.short : col.label}
                      <div
                        onMouseDown={(e) => onMouseDown(i, e)}
                        className="absolute right-0 top-2 bottom-2 w-0.75 cursor-col-resize rounded-full bg-slate-200 hover:bg-[#5800DD] active:bg-[#6800FF] transition-colors"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProjects.map((project) => {
                  const completed = getFilteredCompleted(project);
                  const booked = getFilteredBooked(project);
                  const percent = project.monthlyTargetInternal === 0 ? 0 : Math.round((completed / project.monthlyTargetInternal) * 100);
                  const health = getHealthStatus(percent);
                  const hc = healthConfig[health];
                  const StatusIcon = hc.icon;
                  return (
                    <tr
                      key={project.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-4 overflow-hidden">
                        <div className="flex items-center gap-3 min-w-0">
                          {clientLogos[project.clientName.toLowerCase().replace(/[^a-z]/g, "")] ? (
                            <img src={clientLogos[project.clientName.toLowerCase().replace(/[^a-z]/g, "")]} alt={project.clientName} className="w-8 h-8 rounded-md object-contain bg-white border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-[#f0e6ff] border border-[#e0ccff] flex items-center justify-center text-[#6800FF] shrink-0">
                              <Building2 size={16} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <Link href={`/client/${project.id}`} className="font-medium text-[#6800FF] hover:text-indigo-800 truncate transition-colors">{project.clientName}</Link>
                              {(projectRemarkCounts[project.id] || 0) > 0 && (
                                <span className="text-[9px] text-[#6800FF] bg-[#6800FF]/10 px-1.5 py-0.5 rounded-full font-semibold shrink-0">{projectRemarkCounts[project.id]} remark{projectRemarkCounts[project.id] > 1 ? "s" : ""}</span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono">{project.clientId}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 overflow-hidden">
                        <PodDropdown
                          value={project.assignedPod}
                          onChange={(newPod) => handlePodChange(project.id, newPod)}
                          pods={pods}
                          podMap={podMap}
                          editable={isAdmin}
                        />
                      </td>

                      <EditableTargetCell value={project.monthlyTargetExternal} editable={isAdmin} onSave={(v) => updateProject(project.id, { monthlyTargetExternal: v })} />
                      <EditableTargetCell value={project.weeklyTargetExternal} editable={isAdmin} onSave={(v) => updateProject(project.id, { weeklyTargetExternal: v })} />
                      <EditableTargetCell value={project.monthlyTargetInternal} editable={isAdmin} onSave={(v) => updateProject(project.id, { monthlyTargetInternal: v })} />

                      <td className="px-6 py-4 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ease-out ${
                                health === "green" ? "bg-emerald-500" : health === "amber" ? "bg-amber-400" : "bg-red-500"
                              }`}
                              style={{ width: `${Math.min(percent, 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-slate-700 shrink-0 tabular-nums">
                            {percent}%
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right overflow-hidden">
                        <span className="text-base font-semibold text-slate-900 tabular-nums">{completed}</span>
                        {booked > 0 && (
                          <span className="text-[10px] text-amber-500 font-medium ml-1.5">+{booked}</span>
                        )}
                      </td>

                      <td className="px-6 py-4 overflow-hidden">
                        <div className="flex justify-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border whitespace-nowrap ${hc.bg} ${hc.text} ${hc.border}`}>
                            <StatusIcon size={14} className={`shrink-0 ${hc.iconColor}`} />
                            <span className="truncate">{hc.label}</span>
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No projects found matching &ldquo;{searchTerm}&rdquo;
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}
