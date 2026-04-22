export type SeedRole = "superadmin" | "admin" | "pod" | "client";

export interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: SeedRole;
  podId?: string;
  projectId?: string;
  approverId?: string;
}

export const SEED_USERS: SeedUser[] = [
  { name: "Akash", email: "akash@thyleads.com", password: "superadmin123", role: "superadmin", approverId: "sales" },
  { name: "Bharath", email: "bharath@thyleads.com", password: "admin123", role: "admin", approverId: "sales" },
  { name: "Sales", email: "sales@thyleads.com", password: "admin123", role: "admin", approverId: "" },
  { name: "Kunal", email: "kunal@thyleads.com", password: "pod123", role: "pod", podId: "pod1", approverId: "bharath" },
  { name: "Rajesh", email: "rajesh@thyleads.com", password: "pod123", role: "pod", podId: "pod1", approverId: "bharath" },
  { name: "Manshi", email: "manshi@thyleads.com", password: "pod123", role: "pod", podId: "pod2", approverId: "bharath" },
  { name: "Naman", email: "naman@thyleads.com", password: "pod123", role: "pod", podId: "pod2", approverId: "bharath" },
  { name: "Krishna", email: "krishna@thyleads.com", password: "pod123", role: "pod", podId: "pod3", approverId: "bharath" },
  { name: "Mridul", email: "mridul@thyleads.com", password: "pod123", role: "pod", podId: "pod3", approverId: "bharath" },
  { name: "Sandeep", email: "sandeep@thyleads.com", password: "pod123", role: "pod", podId: "pod4", approverId: "bharath" },
  { name: "Rashi", email: "rashi@thyleads.com", password: "pod123", role: "pod", podId: "pod4", approverId: "bharath" },
  { name: "Thyleads", email: "portal-thyleads@thyleads.com", password: "client123", role: "client", projectId: "p1" },
  { name: "CleverTap", email: "portal-clevertap@thyleads.com", password: "client123", role: "client", projectId: "p2" },
  { name: "BlueDove", email: "portal-bluedove@thyleads.com", password: "client123", role: "client", projectId: "p3" },
  { name: "Evality", email: "portal-evality@thyleads.com", password: "client123", role: "client", projectId: "p4" },
  { name: "Onecap", email: "portal-onecap@thyleads.com", password: "client123", role: "client", projectId: "p5" },
  { name: "Mynd", email: "portal-mynd@thyleads.com", password: "client123", role: "client", projectId: "p6" },
  { name: "Actyv", email: "portal-actyv@thyleads.com", password: "client123", role: "client", projectId: "p7" },
  { name: "Zigtal", email: "portal-zigtal@thyleads.com", password: "client123", role: "client", projectId: "p8" },
  { name: "VWO", email: "portal-vwo@thyleads.com", password: "client123", role: "client", projectId: "p9" },
  { name: "Pazo", email: "portal-pazo@thyleads.com", password: "client123", role: "client", projectId: "p10" },
  { name: "Venwiz", email: "portal-venwiz@thyleads.com", password: "client123", role: "client", projectId: "p11" },
  { name: "InFeedo", email: "portal-infeedo@thyleads.com", password: "client123", role: "client", projectId: "p12" },
];

const seedByEmail = new Map(SEED_USERS.map((u) => [u.email.toLowerCase(), u]));

export function getSeedUser(email: string): SeedUser | undefined {
  return seedByEmail.get(email.toLowerCase());
}

interface ReconcilableUser {
  email: string;
  role: SeedRole | string;
  podId?: string;
  projectId?: string;
  approverId?: string;
  save: () => Promise<unknown>;
}

export async function reconcileRoleFromSeed(user: ReconcilableUser): Promise<boolean> {
  const spec = getSeedUser(user.email);
  if (!spec) return false;
  const expectedPodId = spec.podId || "";
  const expectedProjectId = spec.projectId || "";
  const expectedApproverId = spec.approverId || "";
  const drifted =
    user.role !== spec.role ||
    (user.podId || "") !== expectedPodId ||
    (user.projectId || "") !== expectedProjectId ||
    (user.approverId || "") !== expectedApproverId;
  if (!drifted) return false;
  user.role = spec.role;
  user.podId = expectedPodId;
  user.projectId = expectedProjectId;
  user.approverId = expectedApproverId;
  await user.save();
  return true;
}
