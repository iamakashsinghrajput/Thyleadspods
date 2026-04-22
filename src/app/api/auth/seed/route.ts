import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import bcrypt from "bcryptjs";

const SEED_USERS = [
  { name: "Akash", email: "akash@thyleads.com", password: "superadmin123", role: "superadmin", approverId: "sales" },
  { name: "Bharath", email: "bharath@thyleads.com", password: "admin123", role: "admin", approverId: "sales" },
  { name: "Sales", email: "sales@thyleads.com", password: "admin123", role: "admin", approverId: "" },
  { name: "Kunal", email: "kunal@thyleads.com", password: "pod123", role: "pod", podId: "pod1", approverId: "bharath" },
  { name: "Rajesh", email: "rajesh@thyleads.com", password: "pod123", role: "pod", podId: "pod1", approverId: "bharath" },
  { name: "Mansi", email: "mansi@thyleads.com", password: "pod123", role: "pod", podId: "pod2", approverId: "bharath" },
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

export async function POST() {
  await connectDB();
  let created = 0;
  let reconciled = 0;
  let skipped = 0;

  for (const u of SEED_USERS) {
    const exists = await UserModel.findOne({ email: u.email });
    if (exists) {
      const expectedPodId = u.podId || "";
      const expectedProjectId = u.projectId || "";
      const expectedApproverId = u.approverId || "";
      const drifted =
        exists.role !== u.role ||
        (exists.podId || "") !== expectedPodId ||
        (exists.projectId || "") !== expectedProjectId ||
        (exists.approverId || "") !== expectedApproverId;
      if (drifted) {
        exists.role = u.role as "superadmin" | "admin" | "pod" | "client";
        exists.podId = expectedPodId;
        exists.projectId = expectedProjectId;
        exists.approverId = expectedApproverId;
        await exists.save();
        reconciled++;
      } else {
        skipped++;
      }
      continue;
    }
    const hashed = await bcrypt.hash(u.password, 10);
    await UserModel.create({
      name: u.name,
      email: u.email,
      password: hashed,
      role: u.role,
      podId: u.podId || "",
      projectId: u.projectId || "",
      approverId: u.approverId || "",
      verified: true,
    });
    created++;
  }

  return NextResponse.json({ created, reconciled, skipped });
}
