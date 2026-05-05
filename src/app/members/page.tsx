"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, UserMinus, Shield, AlertTriangle, Check, X, RefreshCcw, UserPlus, Clock, Send, Loader2, Copy } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { usePods } from "@/lib/pod-context";

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: string;
  podId: string;
  status: string;
  verified: boolean;
  createdAt: string;
}

interface PendingRow {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function MembersPage() {
  const { user, hydrated } = useAuth();
  const { pods, podMap, updatePodMembers } = usePods();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string>("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string>("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "pod" | "client">("pod");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteResult, setInviteResult] = useState<{ kind: "ok" | "err"; text: string; url?: string } | null>(null);

  const isSuperadmin = user?.role === "superadmin";

  async function fetchMembers() {
    if (!user?.email) return;
    setLoading(true);
    setErr("");
    try {
      const [usersRes, approvalsRes] = await Promise.all([
        fetch(`/api/users?actor=${encodeURIComponent(user.email)}`),
        fetch(`/api/auth/approvals?requester=${encodeURIComponent(user.email)}`),
      ]);
      const usersData = await usersRes.json();
      const approvalsData = await approvalsRes.json();
      if (!usersRes.ok) {
        setErr(usersData.error || "Failed to load members");
        setMembers([]);
      } else {
        setMembers(usersData.users || []);
      }
      if (approvalsRes.ok) {
        setPending(approvalsData.pending || []);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    }
    setLoading(false);
  }

  useEffect(() => { if (hydrated && isSuperadmin) fetchMembers(); }, [hydrated, isSuperadmin, user?.email]);

  async function sendInvite() {
    if (!user?.email) return;
    if (!inviteName.trim() || !inviteEmail.trim()) {
      setInviteResult({ kind: "err", text: "Name and email required" });
      return;
    }
    setInviteBusy(true);
    setInviteResult(null);
    try {
      const res = await fetch(`/api/users/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: user.email, name: inviteName.trim(), email: inviteEmail.trim().toLowerCase(), role: inviteRole, podId: "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteResult({ kind: "err", text: data.error || `Failed (${res.status})` });
      } else {
        const sent = data.invite?.sent;
        const provider = data.invite?.provider;
        const note = sent
          ? (provider === "mock" ? "Invite created (email mocked — SMTP_USER/SMTP_PASS not set; use the dev URL below)." : `Invite emailed via ${provider} to ${data.email}.`)
          : `Invite created but email failed: ${data.invite?.error || "unknown"}.`;
        setInviteResult({ kind: "ok", text: note, url: data.inviteUrl });
        setInviteName("");
        setInviteEmail("");
        fetchMembers();
      }
    } catch (e) {
      setInviteResult({ kind: "err", text: e instanceof Error ? e.message : "Network error" });
    }
    setInviteBusy(false);
  }

  async function decidePending(p: PendingRow, action: "approve" | "reject") {
    if (!user?.email) return;
    setBusyId(p.id);
    setErr("");
    try {
      const res = await fetch(`/api/auth/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requester: user.email, email: p.email, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || `Failed to ${action}`);
        setBusyId("");
        return;
      }
      setPending((prev) => prev.filter((x) => x.id !== p.id));
      fetchMembers();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    }
    setBusyId("");
  }

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter((m) =>
      m.name.toLowerCase().includes(s) ||
      m.email.toLowerCase().includes(s) ||
      m.role.toLowerCase().includes(s) ||
      (podMap[m.podId]?.name || "").toLowerCase().includes(s),
    );
  }, [members, q, podMap]);

  function stripFromPodLocal(member: MemberRow) {
    if (!member.podId) return;
    const pod = podMap[member.podId];
    if (!pod) return;
    const remaining = pod.members.filter((mn) => mn.toLowerCase() !== member.name.toLowerCase());
    if (remaining.length !== pod.members.length) updatePodMembers(pod.id, remaining);
  }

  async function removeFromPod(member: MemberRow) {
    if (!member.podId) return;
    setBusyId(member.id);
    setErr("");
    try {
      const res = await fetch(`/api/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: user?.email, id: member.id, podId: "" }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to remove from pod"); setBusyId(""); return; }
      stripFromPodLocal(member);
      setMembers((prev) => prev.map((m) => m.id === member.id ? { ...m, podId: "" } : m));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    }
    setBusyId("");
  }

  async function deletePermanently(member: MemberRow) {
    setBusyId(member.id);
    setErr("");
    try {
      const res = await fetch(`/api/users?actor=${encodeURIComponent(user?.email || "")}&id=${encodeURIComponent(member.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to delete user"); setBusyId(""); setConfirmDeleteId(""); return; }
      stripFromPodLocal(member);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Network error");
    }
    setBusyId("");
    setConfirmDeleteId("");
  }

  if (!hydrated) return <div className="p-6 text-sm text-slate-500">Loading…</div>;
  if (!isSuperadmin) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center max-w-md mx-auto">
          <Shield className="mx-auto text-slate-300 mb-2" size={28} />
          <p className="text-sm font-bold text-slate-700">Restricted</p>
          <p className="text-xs text-slate-500 mt-1">Only the superadmin can manage members.</p>
        </div>
      </div>
    );
  }

  const podCount = members.filter((m) => m.podId).length;

  return (
    <div className="p-6 space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Members</h1>
          <p className="text-xs text-slate-500 mt-0.5">{members.length} total · {podCount} assigned to pods</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, pod…"
              className="pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#6800FF] focus:ring-2 focus:ring-[#6800FF]/15 w-64"
            />
          </div>
          <button onClick={() => { setShowInvite((v) => !v); setInviteResult(null); }} className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#6800FF] hover:bg-[#5800DD] text-white text-xs font-semibold rounded-lg">
            <UserPlus size={13} /> Invite member
          </button>
          <button onClick={fetchMembers} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-50">
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {showInvite && (
        <div className="bg-white rounded-2xl border border-[#6800FF]/30 ring-1 ring-[#6800FF]/10 p-4 space-y-3 max-w-2xl">
          <p className="text-sm font-bold text-slate-900 inline-flex items-center gap-1.5">
            <UserPlus size={14} className="text-[#6800FF]" /> Invite a Thyleads employee
          </p>
          <p className="text-[11px] text-slate-500">Sends a one-time invitation email. They can sign in with their Google Workspace account or set a password from the link.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1">
              <label className="text-[11px] font-medium text-slate-600">Name</label>
              <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Riya Sharma" className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-[#6800FF]" />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[11px] font-medium text-slate-600">Google Workspace email</label>
              <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="riya@thyleads.com" className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded text-sm font-mono focus:outline-none focus:border-[#6800FF]" />
            </div>
            <div className="sm:col-span-1">
              <label className="text-[11px] font-medium text-slate-600">Role</label>
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "pod" | "client")} className="w-full mt-1 px-2.5 py-1.5 border border-slate-200 rounded text-sm focus:outline-none focus:border-[#6800FF]">
                <option value="pod">pod</option>
                <option value="admin">admin</option>
                <option value="client">client</option>
              </select>
            </div>
          </div>
          {inviteResult && (
            <div className={`text-[11px] rounded-lg px-3 py-2 inline-flex items-start gap-1.5 ${inviteResult.kind === "ok" ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {inviteResult.kind === "ok" ? <Check size={12} className="mt-0.5 shrink-0" /> : <AlertTriangle size={12} className="mt-0.5 shrink-0" />}
              <div>
                <p>{inviteResult.text}</p>
                {inviteResult.url && (
                  <p className="mt-1 inline-flex items-center gap-1.5 font-mono text-[10px] break-all">
                    <a href={inviteResult.url} target="_blank" rel="noreferrer" className="underline">{inviteResult.url}</a>
                    <button onClick={() => navigator.clipboard.writeText(inviteResult.url || "")} className="text-slate-500 hover:text-slate-800" title="Copy link"><Copy size={10} /></button>
                  </p>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button onClick={sendInvite} disabled={inviteBusy || !inviteName.trim() || !inviteEmail.trim()} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#6800FF] hover:bg-[#5800DD] disabled:opacity-50 text-white text-xs font-semibold rounded-md">
              {inviteBusy ? <><Loader2 size={12} className="animate-spin" /> Sending…</> : <><Send size={12} /> Send invite</>}
            </button>
            <button onClick={() => { setShowInvite(false); setInviteResult(null); }} className="text-xs font-medium text-slate-500 hover:text-slate-800">Cancel</button>
          </div>
        </div>
      )}

      {err && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 inline-flex items-center gap-1.5">
          <AlertTriangle size={13} /> {err}
        </div>
      )}

      <div className={`rounded-2xl border overflow-hidden ${pending.length > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
        <div className={`px-4 py-2.5 flex items-center justify-between gap-2 ${pending.length > 0 ? "bg-amber-100/50 border-b border-amber-200" : "bg-slate-50 border-b border-slate-200"}`}>
          <div className="inline-flex items-center gap-2">
            <UserPlus size={14} className={pending.length > 0 ? "text-amber-700" : "text-slate-400"} />
            <p className={`text-sm font-bold ${pending.length > 0 ? "text-amber-900" : "text-slate-700"}`}>
              Pending login requests
              <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${pending.length > 0 ? "bg-amber-600 text-white" : "bg-slate-200 text-slate-600"}`}>{pending.length}</span>
            </p>
          </div>
          {pending.length > 0 && <span className="text-[11px] text-amber-800">Approve verified Thyleads employees · reject anyone you don&apos;t recognize</span>}
        </div>
        {pending.length === 0 ? (
          <p className="px-4 py-6 text-xs text-slate-500 text-center">No pending requests. New signups will appear here for you to approve.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-amber-50 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
              <tr>
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Requested at</th>
                <th className="text-right px-4 py-2">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-200/60">
              {pending.map((p) => (
                <tr key={p.id} className="hover:bg-amber-100/30">
                  <td className="px-4 py-2.5 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-2.5 text-slate-700 font-mono text-xs">{p.email}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs inline-flex items-center gap-1">
                    <Clock size={11} className="text-slate-400" />
                    {new Date(p.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => decidePending(p, "approve")}
                        disabled={busyId === p.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[11px] font-semibold rounded"
                      >
                        <Check size={11} /> Approve
                      </button>
                      <button
                        onClick={() => decidePending(p, "reject")}
                        disabled={busyId === p.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-red-300 hover:bg-red-50 disabled:opacity-50 text-red-700 text-[11px] font-semibold rounded"
                      >
                        <X size={11} /> Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
            <tr>
              <th className="text-left px-3 py-2.5">Name</th>
              <th className="text-left px-3 py-2.5">Email</th>
              <th className="text-left px-3 py-2.5">Role</th>
              <th className="text-left px-3 py-2.5">Pod</th>
              <th className="text-left px-3 py-2.5">Status</th>
              <th className="text-right px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && members.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-xs text-slate-500 py-8">Loading…</td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-xs text-slate-500 py-8">No members found.</td></tr>
            ) : visible.map((m) => {
              const pod = m.podId ? podMap[m.podId] : null;
              const isMe = m.email.toLowerCase() === (user?.email || "").toLowerCase();
              const confirming = confirmDeleteId === m.id;
              return (
                <tr key={m.id} className={`hover:bg-slate-50 ${confirming ? "bg-red-50" : ""}`}>
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {m.name}
                    {isMe && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider text-[#6800FF]">you</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600 font-mono text-xs">{m.email}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      m.role === "superadmin" ? "bg-[#f0e6ff] text-[#6800FF]" :
                      m.role === "admin" ? "bg-amber-50 text-amber-700" :
                      m.role === "client" ? "bg-sky-50 text-sky-700" :
                      "bg-slate-100 text-slate-600"
                    }`}>{m.role}</span>
                  </td>
                  <td className="px-3 py-2">
                    {pod ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className={`w-2 h-2 rounded-full ${pod.color}`} />
                        {pod.name}
                      </span>
                    ) : <span className="text-xs text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      m.status === "approved" ? "bg-emerald-50 text-emerald-700" :
                      m.status === "pending" ? "bg-amber-50 text-amber-700" :
                      "bg-red-50 text-red-700"
                    }`}>{m.status}</span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {confirming ? (
                      <div className="inline-flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-red-700">Delete permanently?</span>
                        <button
                          onClick={() => deletePermanently(m)}
                          disabled={busyId === m.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold rounded disabled:opacity-50"
                        >
                          <Check size={11} /> Yes
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId("")}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded"
                        >
                          <X size={11} /> No
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5">
                        {m.podId && (
                          <button
                            onClick={() => removeFromPod(m)}
                            disabled={busyId === m.id || isMe}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 text-[11px] font-semibold rounded disabled:opacity-40"
                            title={isMe ? "You can't remove yourself" : "Remove from pod"}
                          >
                            <UserMinus size={11} /> Remove from pod
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmDeleteId(m.id)}
                          disabled={busyId === m.id || isMe}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-red-300 text-red-700 hover:bg-red-50 text-[11px] font-semibold rounded disabled:opacity-40"
                          title={isMe ? "You can't delete yourself" : "Delete user permanently"}
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-800 inline-flex items-start gap-1.5 max-w-2xl">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        <span>
          <strong>Remove from pod</strong> clears the user's pod assignment and strips their name from the pod's member list — they can still log in.
          <strong> Delete</strong> permanently removes the account from the database; the email becomes free to re-register.
        </span>
      </div>
    </div>
  );
}
