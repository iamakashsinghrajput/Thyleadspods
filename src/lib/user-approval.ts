import Notification from "@/lib/models/notification";
import { getSeedUser } from "./seed-users";

export const SUPERADMIN_EMAIL = "akash@thyleads.com";

export function expectedStatusForEmail(email: string): "approved" | "pending" {
  const e = email.toLowerCase();
  if (e === SUPERADMIN_EMAIL) return "approved";
  if (getSeedUser(e)) return "approved";
  return "pending";
}

export async function notifySuperadminOfPendingUser(name: string, email: string) {
  await Notification.create({
    forRole: "superadmin",
    forUserEmail: SUPERADMIN_EMAIL,
    message: `New signup pending approval: ${name} (${email})`,
  });
}
