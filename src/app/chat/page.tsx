"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Send, Search, MessageSquare, Users, Star, Archive, Trash2, MoreVertical, X, StarOff, ArchiveRestore, Reply, Smile } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useChat } from "@/lib/chat-context";
import { usePresence } from "@/lib/presence-context";
import { allChatUsers, getUserId, type ChatUser } from "@/lib/chat-users";
interface Reaction { emoji: string; userId: string; userName: string; }
interface ReplyInfo { messageId: string; senderName: string; text: string; }
interface Message { _id: string; chatId: string; sender: string; senderName: string; text: string; replyInfo?: ReplyInfo | null; reactions: Reaction[]; createdAt: string; }
interface LastMsg { text: string; senderName: string; sender: string; createdAt: string; }

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const allUsers = allChatUsers;

function getChatId(a: string, b: string) { return [a, b].sort().join("_"); }
const ac = ["bg-[#6800FF]", "bg-emerald-500", "bg-purple-500", "bg-orange-500", "bg-sky-500", "bg-rose-500", "bg-teal-500", "bg-amber-500", "bg-cyan-500"];

type Tab = "all" | "favourites" | "archived";

export default function ChatPage() {
  const { user } = useAuth();
  const { unreadMap, markRead } = useChat();
  const { isOnline } = usePresence();
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [lastMessages, setLastMessages] = useState<Record<string, LastMsg>>({});
  const [tab, setTab] = useState<Tab>("all");
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [chatMenu, setChatMenu] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [emojiPicker, setEmojiPicker] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastFetchRef = useRef<string | null>(null);

  if (!user) return null;
  const myId = getUserId(user.name);
  const chatUsers = allUsers.filter((u) => u.id !== myId);

  useEffect(() => {
    const f = localStorage.getItem(`thyleads_favs_${myId}`);
    const a = localStorage.getItem(`thyleads_arch_${myId}`);
    if (f) try { setFavourites(new Set(JSON.parse(f))); } catch {}
    if (a) try { setArchived(new Set(JSON.parse(a))); } catch {}
  }, [myId]);

  function saveFavs(s: Set<string>) { setFavourites(s); localStorage.setItem(`thyleads_favs_${myId}`, JSON.stringify([...s])); }
  function saveArch(s: Set<string>) { setArchived(s); localStorage.setItem(`thyleads_arch_${myId}`, JSON.stringify([...s])); }

  function toggleFav(uid: string) { const n = new Set(favourites); if (n.has(uid)) n.delete(uid); else n.add(uid); saveFavs(n); }
  function toggleArchive(uid: string) { const n = new Set(archived); if (n.has(uid)) n.delete(uid); else n.add(uid); saveArch(n); if (selectedUser?.id === uid && !n.has(uid)) {} setChatMenu(null); }

  let filteredUsers = chatUsers;
  if (tab === "favourites") filteredUsers = chatUsers.filter((u) => favourites.has(u.id));
  else if (tab === "archived") filteredUsers = chatUsers.filter((u) => archived.has(u.id));
  else filteredUsers = chatUsers.filter((u) => !archived.has(u.id));
  if (searchTerm) filteredUsers = filteredUsers.filter((u) => u.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const chatId = selectedUser ? getChatId(myId, selectedUser.id) : null;

  const fetchLatest = useCallback(async () => {
    if (!myId) return;
    try { const r = await fetch(`/api/messages/latest?userId=${myId}`); const d = await r.json(); setLastMessages(d.conversations); } catch {}
  }, [myId]);

  useEffect(() => { fetchLatest(); const i = setInterval(fetchLatest, 4000); return () => clearInterval(i); }, [fetchLatest]);

  const fetchMessages = useCallback(async (full = false) => {
    if (!chatId) return;
    const p = new URLSearchParams({ chatId, userId: myId });
    if (!full && lastFetchRef.current) p.set("after", lastFetchRef.current);
    const r = await fetch(`/api/messages?${p}`);
    const d = await r.json();
    const incoming: Message[] = d.messages.map((m: Message) => ({ ...m, reactions: m.reactions ?? [] }));
    if (full) {
      setMessages(incoming);
    } else if (incoming.length > 0) {
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m._id));
        const newMsgs = incoming.filter((m) => !ids.has(m._id));
        return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
      });
    }
    if (incoming.length > 0) lastFetchRef.current = incoming[incoming.length - 1].createdAt;
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;
    const refreshReactions = async () => {
      const r = await fetch(`/api/messages?${new URLSearchParams({ chatId, userId: myId })}`);
      const d = await r.json();
      const all: Message[] = d.messages.map((m: Message) => ({ ...m, reactions: m.reactions ?? [] }));
      setMessages(all);
    };
    const i = setInterval(refreshReactions, 5000);
    return () => clearInterval(i);
  }, [chatId]);

  useEffect(() => { if (!chatId) return; lastFetchRef.current = null; fetchMessages(true); }, [chatId, fetchMessages]);
  useEffect(() => { if (!chatId) return; const i = setInterval(() => fetchMessages(false), 1500); return () => clearInterval(i); }, [chatId, fetchMessages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function handleSend() {
    if (!text.trim() || !chatId) return;
    setSending(true);
    const ri = replyTo ? { messageId: replyTo._id, senderName: replyTo.senderName, text: replyTo.text } : null;
    await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId, sender: myId, senderName: user!.name, text: text.trim(), replyInfo: ri }) });
    setText(""); setSending(false); setReplyTo(null); fetchMessages(false); fetchLatest();
  }

  async function reactToMsg(msgId: string, emoji: string) {
    const res = await fetch("/api/messages/react", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, emoji, userId: myId, userName: user!.name }) });
    const data = await res.json();
    setMessages((prev) => prev.map((m) => m._id === msgId ? { ...m, reactions: data.reactions } : m));
    setEmojiPicker(null);
  }

  async function deleteMessage(msgId: string) {
    await fetch("/api/messages/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: msgId, userId: myId }) });
    setMessages((prev) => prev.filter((m) => m._id !== msgId));
    setDeleteConfirm(null);
  }

  async function deleteChat(uid: string) {
    const cid = getChatId(myId, uid);
    await fetch("/api/messages/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chatId: cid, userId: myId }) });
    if (selectedUser?.id === uid) { setSelectedUser(null); setMessages([]); }
    setChatMenu(null);
    fetchLatest();
  }

  function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: false }); }
  function fmtTimeFull(d: string) { return new Date(d).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }); }
  function fmtDateSep(d: string) {
    const dt = new Date(d); const t = new Date();
    if (dt.toDateString() === t.toDateString()) return "Today";
    if (dt.toDateString() === new Date(t.getTime() - 86400000).toDateString()) return "Yesterday";
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function selectUser(u: ChatUser) { setSelectedUser(u); setMessages([]); lastFetchRef.current = null; markRead(u.id); setChatMenu(null); }

  let lastDateSep = "";
  const archivedCount = archived.size;
  const favCount = favourites.size;

  return (
    <div className="flex h-full min-h-[calc(100vh-0px)] bg-white">

      <div className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 text-slate-600">
        <div className="px-4 pt-5 pb-3">
          <p className="text-sm font-bold text-slate-900">Inbox</p>
        </div>
        <div className="px-3 space-y-0.5 text-[13px]">
          <button onClick={() => setTab("all")} className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded transition-colors ${tab === "all" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"}`}>
            <div className="flex items-center gap-2"><MessageSquare size={14} /> All</div>
            <span className="text-[11px] text-slate-500">{chatUsers.filter((u) => !archived.has(u.id)).length}</span>
          </button>
          <button onClick={() => setTab("favourites")} className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded transition-colors ${tab === "favourites" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"}`}>
            <div className="flex items-center gap-2"><Star size={14} /> Favourites</div>
            {favCount > 0 && <span className="text-[11px] text-slate-500">{favCount}</span>}
          </button>
          <button onClick={() => setTab("archived")} className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded transition-colors ${tab === "archived" ? "bg-slate-100 text-slate-900" : "text-slate-400 hover:bg-slate-100 hover:text-slate-900"}`}>
            <div className="flex items-center gap-2"><Archive size={14} /> Archived</div>
            {archivedCount > 0 && <span className="text-[11px] text-slate-500">{archivedCount}</span>}
          </button>
        </div>
        <div className="flex-1" />
      </div>

      <div className="w-72 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        <div className="px-4 pt-5 pb-3 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-900 capitalize">{tab === "all" ? "All Chats" : tab}</span>
        </div>
        <div className="px-3 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6800FF]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 && (
            <div className="px-4 py-8 text-center text-slate-600 text-sm">
              {tab === "favourites" ? "No favourites yet" : tab === "archived" ? "No archived chats" : "No chats found"}
            </div>
          )}
          {filteredUsers.map((u, i) => {
            const last = lastMessages[u.id];
            const unread = unreadMap[u.id] ?? 0;
            const isActive = selectedUser?.id === u.id;
            const isFav = favourites.has(u.id);
            return (
              <div key={u.id} className={`relative group/chat border-l-[3px] ${isActive ? "bg-slate-100 border-emerald-400" : "border-transparent hover:bg-white"}`}>
                <button onClick={() => selectUser(u)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                  <div className="relative shrink-0">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${ac[i % ac.length]} flex items-center justify-center text-white text-xs font-bold`}>{u.name[0]}</div>
                    )}
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-100 ${isOnline(u.id) ? "bg-emerald-400" : "bg-slate-300"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
                        {isFav && <Star size={11} className="text-amber-400 fill-amber-400 shrink-0" />}
                      </div>
                      {last && <span className="text-[11px] text-slate-500 shrink-0">{fmtTime(last.createdAt)}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-xs text-slate-500 truncate">{last ? (last.sender === myId ? "sent" : last.text) : "Start a conversation"}</p>
                      {unread > 0 && <span className="min-w-5 h-5 flex items-center justify-center px-1.5 bg-emerald-500 text-slate-900 text-[10px] font-bold rounded-full shrink-0 ml-2">{unread}</span>}
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setChatMenu(chatMenu === u.id ? null : u.id); }}
                  className="absolute top-3 right-2 p-1 rounded text-slate-600 hover:text-slate-900 opacity-0 group-hover/chat:opacity-100 transition-all"
                >
                  <MoreVertical size={14} />
                </button>
                {chatMenu === u.id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setChatMenu(null)} />
                    <div className="absolute right-2 top-10 z-50 w-44 bg-slate-100 border border-slate-200 rounded-lg shadow-xl py-1 text-sm">
                      <button onClick={() => { toggleFav(u.id); setChatMenu(null); }} className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">
                        {isFav ? <><StarOff size={14} /> Remove favourite</> : <><Star size={14} /> Add to favourites</>}
                      </button>
                      <button onClick={() => { toggleArchive(u.id); setChatMenu(null); }} className="w-full px-3 py-2 text-left flex items-center gap-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 transition-colors">
                        {archived.has(u.id) ? <><ArchiveRestore size={14} /> Unarchive</> : <><Archive size={14} /> Archive chat</>}
                      </button>
                      <button onClick={() => deleteChat(u.id)} className="w-full px-3 py-2 text-left flex items-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} /> Delete chat
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-slate-50/50">
        {!selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Users size={48} className="mb-3 text-slate-700" />
            <p className="text-lg font-medium text-slate-400">Select a conversation</p>
            <p className="text-sm mt-1 text-slate-600">Choose someone from the left to start chatting</p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className={`w-9 h-9 rounded-full ${ac[chatUsers.indexOf(selectedUser) % ac.length]} flex items-center justify-center text-white text-xs font-bold`}>{selectedUser.name[0]}</div>
                  )}
                  <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${isOnline(selectedUser.id) ? "bg-emerald-400" : "bg-slate-300"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{selectedUser.name}</p>
                  <p className={`text-[11px] ${isOnline(selectedUser.id) ? "text-emerald-400" : "text-slate-400"}`}>{isOnline(selectedUser.id) ? "Online" : "Offline"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleFav(selectedUser.id)} className={`p-2 rounded-lg transition-colors ${favourites.has(selectedUser.id) ? "text-amber-400" : "text-slate-500 hover:text-amber-400"}`} title={favourites.has(selectedUser.id) ? "Remove favourite" : "Add to favourites"}>
                  <Star size={16} className={favourites.has(selectedUser.id) ? "fill-amber-400" : ""} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-slate-600">
                  <MessageSquare size={32} className="mb-2 text-slate-700" />
                  <p className="text-sm">No messages yet. Say hello!</p>
                </div>
              )}
              {messages.map((m) => {
                const isMe = m.sender === myId;
                const ds = fmtDateSep(m.createdAt);
                let showDs = false;
                if (ds !== lastDateSep) { lastDateSep = ds; showDs = true; }
                return (
                  <div key={m._id}>
                    {showDs && (
                      <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-slate-100" />
                        <span className="text-[11px] font-medium text-slate-500">{ds}</span>
                        <div className="flex-1 h-px bg-slate-100" />
                      </div>
                    )}
                    <div className={`flex mb-4 group/msg ${isMe ? "justify-end" : "justify-start"}`}>
                      {!isMe && (() => {
                        const senderUser = allUsers.find((u) => u.id === m.sender);
                        const idx = chatUsers.findIndex((u) => u.id === m.sender);
                        return senderUser?.avatarUrl ? (
                          <img src={senderUser.avatarUrl} alt={m.senderName} className="w-8 h-8 rounded-full object-cover shrink-0 mr-2.5 mt-5" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full ${ac[idx % ac.length]} flex items-center justify-center text-white text-[10px] font-bold shrink-0 mr-2.5 mt-5`}>{m.senderName[0]}</div>
                        );
                      })()}
                      <div className="max-w-[60%] relative">
                        {!isMe && (
                          <p className="text-xs font-semibold text-slate-600 mb-1">{m.senderName}<span className="font-normal text-slate-600 ml-2">{fmtTime(m.createdAt)}</span></p>
                        )}

                        <div className={`overflow-hidden text-sm leading-relaxed ${isMe ? "bg-emerald-50 border border-emerald-200 rounded-2xl rounded-br-sm" : "bg-white border border-slate-200 rounded-2xl rounded-bl-sm"}`}>
                          {m.replyInfo && (
                            <div className={`mx-2 mt-2 px-3 py-2 rounded-lg border-l-3 text-xs cursor-pointer hover:opacity-80 transition-opacity ${isMe ? "bg-emerald-100/70 border-emerald-500" : "bg-slate-50 border-[#6800FF]"}`}>
                              <p className={`font-bold text-[11px] ${isMe ? "text-emerald-700" : "text-[#6800FF]"}`}>{m.replyInfo.senderName}</p>
                              <p className={`truncate mt-0.5 ${isMe ? "text-emerald-600/70" : "text-slate-500"}`}>{m.replyInfo.text}</p>
                            </div>
                          )}
                          <div className={`px-4 ${m.replyInfo ? "pt-1.5" : "pt-3"} pb-3 ${isMe ? "text-emerald-800" : "text-slate-700"}`}>
                            {m.text}
                          </div>
                        </div>

                        {m.reactions && m.reactions.length > 0 && (
                          <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                            {Object.entries(
                              m.reactions.reduce<Record<string, { count: number; users: string[]; hasMe: boolean }>>((acc, r) => {
                                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasMe: false };
                                acc[r.emoji].count++;
                                acc[r.emoji].users.push(r.userName);
                                if (r.userId === myId) acc[r.emoji].hasMe = true;
                                return acc;
                              }, {})
                            ).map(([emoji, data]) => (
                              <button
                                key={emoji}
                                onClick={() => reactToMsg(m._id, emoji)}
                                title={data.users.join(", ")}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs transition-colors ${
                                  data.hasMe
                                    ? "bg-[#6800FF]/20 border border-[#6800FF]/40"
                                    : "bg-slate-100 border border-slate-200 hover:bg-slate-200"
                                }`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px] text-slate-400">{data.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <p className={`text-[10px] mt-1 ${isMe ? "text-right" : ""} text-slate-600`}>
                          {isMe ? `Sent ${fmtTimeFull(m.createdAt)}` : `Received ${fmtTimeFull(m.createdAt)}`}
                        </p>

                        <div className={`absolute ${isMe ? "-left-24" : "-right-24"} top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-all`}>
                          <button onClick={() => { setReplyTo(m); inputRef.current?.focus(); }} className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-[#6800FF] hover:border-[#6800FF]/30 transition-all" title="Reply">
                            <Reply size={13} />
                          </button>
                          <button onClick={() => setEmojiPicker(emojiPicker === m._id ? null : m._id)} className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-amber-400 hover:border-amber-500/30 transition-all" title="React">
                            <Smile size={13} />
                          </button>
                          <button onClick={() => setDeleteConfirm(m._id)} className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        </div>

                        {emojiPicker === m._id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setEmojiPicker(null)} />
                            <div className={`absolute z-50 ${isMe ? "right-0" : "left-0"} -top-10 flex items-center gap-1 px-2 py-1.5 bg-slate-100 border border-slate-200 rounded-full shadow-xl`}>
                              {REACTIONS.map((emoji) => (
                                <button key={emoji} onClick={() => reactToMsg(m._id, emoji)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-lg transition-colors hover:scale-125">
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t border-slate-200">
              {replyTo && (
                <div className="px-6 pt-3 flex items-center gap-3">
                  <div className="flex-1 px-3 py-2 bg-slate-100 rounded-lg border-l-2 border-[#6800FF]">
                    <p className="text-[11px] font-semibold text-[#6800FF]">{replyTo.senderName}</p>
                    <p className="text-xs text-slate-400 truncate">{replyTo.text}</p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="p-1 rounded text-slate-500 hover:text-slate-900 transition-colors">
                    <X size={16} />
                  </button>
                </div>
              )}
              <div className="px-6 py-4 flex items-center gap-3">
                <input ref={inputRef} type="text" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} placeholder={replyTo ? `Reply to ${replyTo.senderName}...` : "Type your message..."} className="flex-1 px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#6800FF] transition-all" />
                <button onClick={handleSend} disabled={!text.trim() || sending} className="w-11 h-11 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl transition-colors flex items-center justify-center shrink-0">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {deleteConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Delete message?</h3>
                <p className="text-sm text-slate-400 mt-0.5">This can&apos;t be undone.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteConfirm && deleteMessage(deleteConfirm)} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors">
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
