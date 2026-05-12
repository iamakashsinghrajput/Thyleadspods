import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import UserModel from "@/lib/models/user";
import DeletedSeedEmail from "@/lib/models/deleted-seed-email";
import bcrypt from "bcryptjs";
import { SEED_USERS, REMOVED_SEED_EMAILS, reconcileRoleFromSeed } from "@/lib/seed-users";

export async function POST() {
  await connectDB();
  let created = 0;
  let reconciled = 0;
  let skipped = 0;
  let tombstoned = 0;
  let purged = 0;

  let passwordsInstalled = 0;

  for (const rawEmail of REMOVED_SEED_EMAILS) {
    const email = rawEmail.toLowerCase().trim();
    if (!email) continue;
    const existed = await UserModel.findOneAndDelete({ email }).lean<{ email?: string }>();
    if (existed) purged++;
    await DeletedSeedEmail.updateOne(
      { email },
      { $set: { email, deletedAt: new Date(), deletedBy: "system:removed-seed" } },
      { upsert: true },
    );
  }

  const tombstoneDocs = await DeletedSeedEmail.find({}).select("email").lean<{ email: string }[]>();
  const tombstones = new Set(tombstoneDocs.map((d) => (d.email || "").toLowerCase()));

  let podsRestored = 0;
  for (const u of SEED_USERS) {
    if (tombstones.has(u.email.toLowerCase())) {
      tombstoned++;
      continue;
    }
    const exists = await UserModel.findOne({ email: u.email });
    if (exists) {
      // Backfill: a pod-role user with an empty podId is stuck on the admin
      // dashboard (home page falls through). Restore the seed's pod assignment
      // and clear the podIdOverridden flag so subsequent reconciles work.
      if (exists.role === "pod" && !exists.podId && u.podId) {
        exists.podId = u.podId;
        (exists as unknown as { podIdOverridden?: boolean }).podIdOverridden = false;
        await exists.save();
        podsRestored++;
      }
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

  return NextResponse.json({ created, reconciled, skipped, passwordsInstalled, tombstoned, purged, podsRestored });
}
