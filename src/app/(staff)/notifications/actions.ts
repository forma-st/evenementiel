"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";

export async function markAllRead() {
  const u = await requireStaff();
  await db.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function clearRead() {
  const u = await requireStaff();
  await db.notification.deleteMany({ where: { userId: u.id, NOT: { readAt: null } } });
  revalidatePath("/notifications");
}
