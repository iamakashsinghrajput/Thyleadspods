import mongoose from "mongoose";

let migrationDone = false;

export async function migrateLegacyGlobalSheet(): Promise<void> {
  if (migrationDone) return;
  const coll = mongoose.connection.collection("accountssheets");
  const legacy = await coll.findOne({ key: "global" });
  if (legacy) {
    const existing = await coll.findOne({ projectId: "p2" });
    if (!existing) {
      await coll.updateOne(
        { _id: legacy._id },
        { $set: { projectId: "p2" }, $unset: { key: "" } },
      );
    } else {
      await coll.deleteOne({ _id: legacy._id });
    }
  }
  migrationDone = true;
}
