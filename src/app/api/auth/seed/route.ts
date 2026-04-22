import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import bcrypt from "bcryptjs";
import { SEED_USERS, reconcileRoleFromSeed } from "@/lib/seed-users";

export async function POST() {
  await connectDB();
  let created = 0;
  let reconciled = 0;
  let skipped = 0;

  let passwordsInstalled = 0;

  for (const u of SEED_USERS) {
    const exists = await UserModel.findOne({ email: u.email });
    if (exists) {
      const didReconcile = await reconcileRoleFromSeed(exists);
      if (!exists.password) {
        exists.password = await bcrypt.hash(u.password, 10);
        exists.verified = true;
        await exists.save();
        passwordsInstalled++;
      }
      if (didReconcile) reconciled++;
      else skipped++;
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

  return NextResponse.json({ created, reconciled, skipped, passwordsInstalled });
}
