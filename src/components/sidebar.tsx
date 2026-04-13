"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard,
  FolderKanban,
  Plus,
  ChevronDown,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Check,
  Clock,
} from "lucide-react";
import { usePods } from "@/lib/pod-context";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import ConfirmDelete from "@/components/confirm-delete";

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { pods, addPod, deletePod, updatePodMembers } = usePods();
  const [editingPodId, setEditingPodId] = useState<string | null>(null);
  const [editMembers, setEditMembers] = useState("");
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const { collapsed, toggle } = useSidebar();
  const [podsOpen, setPodsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [podName, setPodName] = useState("");
  const [podMembers, setPodMembers] = useState("");

  function handleAddPod() {
    const name = podName.trim();
    const members = podMembers.split(",").map((m) => m.trim()).filter(Boolean);
    if (!name || members.length === 0) return;
    addPod(name, members);
    setPodName("");
    setPodMembers("");
    setShowForm(false);
  }

  const navItems = [
    { href: "/", icon: isAdmin ? LayoutDashboard : FolderKanban, label: isAdmin ? "Dashboard" : "My Projects", exact: true },
    { href: "/attendance", icon: Clock, label: "Attendance", exact: false },
  ];

  if (collapsed) {
    return (
      <aside className="w-16 bg-white text-slate-600 h-screen flex flex-col items-center border-r border-slate-200 py-3 shrink-0 z-10 transition-all duration-200">
        <Image src="/logo.png" alt="Thyleads" width={36} height={36} className="rounded-lg mb-2" />

        <button onClick={toggle} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors mb-2" title="Expand sidebar">
          <PanelLeftOpen size={18} />
        </button>

        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isActive ? "bg-[#f0e6ff] text-[#6800FF]" : "text-slate-400 hover:text-slate-700 hover:bg-slate-100"}`} title={item.label}>
                <Icon size={20} />
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        <div className="space-y-2 flex flex-col items-center">
          <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-semibold text-white" title={user?.name}>
            {user?.name?.[0] ?? "?"}
          </div>
          <button onClick={logout} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-white text-slate-600 h-screen flex flex-col border-r border-slate-200 font-sans z-10 transition-all duration-200">
      <div className="p-4 flex items-center gap-3 border-b border-slate-100 shrink-0">
        <Image src="/logo.png" alt="Thyleads" width={32} height={32} className="rounded-lg shadow-lg shadow-[#6800FF]/20" />
        <div className="flex-1">
          <h1 className="text-base font-bold text-slate-900 tracking-wide">Thyleads</h1>
          <p className="text-[11px] text-slate-400">{user?.role === "superadmin" ? "Super Admin" : isAdmin ? "Admin" : user?.name}</p>
        </div>
        <button onClick={toggle} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Collapse sidebar">
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <nav className="p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
                  isActive ? "text-[#6800FF] bg-[#f0e6ff] font-medium" : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[#6800FF] rounded-r-full" />}
                <Icon size={18} />
                <span className="text-sm flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {isAdmin && (
          <div className="p-3 pt-1">
            <button onClick={() => setPodsOpen(!podsOpen)} className="flex items-center justify-between w-full px-3 py-2 group cursor-pointer">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider group-hover:text-slate-600 transition-colors">Pods ({pods.length})</span>
              <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${podsOpen ? "rotate-180" : ""}`} />
            </button>

            {podsOpen && (
              <div className="space-y-1 mt-1">
                {pods.map((pod) => (
                  <div key={pod.id}>
                    {editingPodId === pod.id ? (
                      <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-500">{pod.name} — Edit Members</p>
                        <input
                          type="text"
                          value={editMembers}
                          onChange={(e) => setEditMembers(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#6800FF]"
                          placeholder="Members (comma separated)"
                        />
                        <div className="flex gap-1.5">
                          <button onClick={() => { updatePodMembers(pod.id, editMembers.split(",").map((m) => m.trim()).filter(Boolean)); setEditingPodId(null); }} className="flex items-center gap-1 px-2 py-1 bg-[#6800FF] hover:bg-[#5800DD] text-white text-xs font-medium rounded transition-colors"><Check size={11} /> Save</button>
                          <button onClick={() => setEditingPodId(null)} className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs rounded transition-colors">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-2 rounded-lg hover:bg-slate-50 transition-all group/pod flex items-start gap-2.5">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pod.color}`} />
                        <div className="flex-1 min-w-0">
                          <Link href={`/pod/${pod.id}`} className="text-sm font-medium text-slate-700 group-hover/pod:text-[#6800FF] transition-colors hover:underline">{pod.name}</Link>
                          <p className="text-[11px] text-slate-400 line-clamp-1">{pod.members.join(", ")}</p>
                        </div>
                        <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/pod:opacity-100 transition-all" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => { setEditingPodId(pod.id); setEditMembers(pod.members.join(", ")); }} className="p-1 rounded text-slate-400 hover:text-[#6800FF] hover:bg-[#f0e6ff] transition-colors"><Pencil size={11} /></button>
                          <ConfirmDelete onConfirm={() => deletePod(pod.id)} size={11} />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {showForm ? (
                  <div className="mx-1 mt-1 p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                    <input type="text" placeholder="Pod name" value={podName} onChange={(e) => setPodName(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#6800FF]" />
                    <input type="text" placeholder="Members (comma separated)" value={podMembers} onChange={(e) => setPodMembers(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#6800FF]" />
                    <div className="flex gap-2">
                      <button onClick={handleAddPod} className="flex-1 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] text-white text-sm font-medium rounded-md transition-colors">Add</button>
                      <button onClick={() => { setShowForm(false); setPodName(""); setPodMembers(""); }} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm rounded-md transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowForm(true)} className="flex items-center gap-2 w-full px-3 py-2 text-xs text-slate-400 hover:text-[#6800FF] hover:bg-slate-50 rounded-lg transition-colors">
                    <Plus size={13} /> Add pod
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {!isAdmin && user?.podId && (
          <div className="p-3 pt-1">
            <p className="px-3 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Pod</p>
            {pods.filter((p) => p.id === user.podId).map((pod) => (
              <div key={pod.id} className="px-3 py-2 rounded-lg bg-slate-50 flex items-center gap-2.5 mt-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${pod.color}`} />
                <div>
                  <p className="text-sm font-medium text-slate-700">{pod.name}</p>
                  <p className="text-[11px] text-slate-400">{pod.members.join(", ")}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-slate-100 shrink-0">
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-linear-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
            {user?.name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
          <button onClick={logout} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="Sign out">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
