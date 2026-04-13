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
];

export async function POST() {
  await connectDB();
  let created = 0;
  let skipped = 0;

  for (const u of SEED_USERS) {
    const exists = await UserModel.findOne({ email: u.email });
    if (exists) { skipped++; continue; }
    const hashed = await bcrypt.hash(u.password, 10);
    await UserModel.create({
      name: u.name,
      email: u.email,
      password: hashed,
      role: u.role,
      podId: u.podId || "",
      approverId: u.approverId || "",
      verified: true,
    });
    created++;
  }

  return NextResponse.json({ created, skipped });
}
