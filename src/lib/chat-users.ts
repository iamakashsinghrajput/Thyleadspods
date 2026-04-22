export interface ChatUser {
  id: string;
  name: string;
  role: "superadmin" | "admin" | "pod";
  podId?: string;
  avatarUrl?: string;
}

export const allChatUsers: ChatUser[] = [
  { id: "akash", name: "Akash", role: "superadmin" },
  { id: "bharath", name: "Bharath", role: "admin" },
  { id: "sales", name: "Rahul Dev", role: "admin" },
  { id: "kunal", name: "Kunal", role: "pod", podId: "pod1" },
  { id: "rajesh", name: "Rajesh", role: "pod", podId: "pod1" },
  { id: "manshi", name: "Manshi", role: "pod", podId: "pod2" },
  { id: "naman", name: "Naman", role: "pod", podId: "pod2" },
  { id: "krishna", name: "Krishna", role: "pod", podId: "pod3" },
  { id: "mridul", name: "Mridul", role: "pod", podId: "pod3" },
  { id: "sandeep", name: "Sandeep", role: "pod", podId: "pod4" },
  { id: "rashi", name: "Rashi", role: "pod", podId: "pod4" },
];

export const allChatUserIds = allChatUsers.map((u) => u.id);

export function getUserId(name: string): string {
  const clean = name.toLowerCase().replace(/\s/g, "");
  const exact = allChatUsers.find((u) => u.id === clean);
  if (exact) return exact.id;
  const startsWith = allChatUsers.find((u) => clean.startsWith(u.id));
  if (startsWith) return startsWith.id;
  const firstName = name.toLowerCase().split(/\s/)[0];
  const firstMatch = allChatUsers.find((u) => u.id === firstName);
  if (firstMatch) return firstMatch.id;
  return clean;
}
