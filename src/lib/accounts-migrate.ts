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

  try {
    const indexes = await coll.indexes();
    if (indexes.some((idx) => idx.name === "key_1")) {
      await coll.dropIndex("key_1");
    }
  } catch {}

  await coll.updateMany({ key: null }, { $unset: { key: "" } });

  migrationDone = true;
}
