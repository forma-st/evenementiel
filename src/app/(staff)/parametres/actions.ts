"use server";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { DEFAULT_PERMS, PERM_DEFS, requirePerm, type Perms } from "@/lib/permissions";
import { TAG_COLORS } from "@/lib/tags";
import { notify } from "@/lib/notify";

type Res = { ok?: string; error?: string; password?: string; email?: string } | null;
const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const tempPassword = () => randomBytes(6).toString("base64url");

/* ---------- Mon compte ---------- */

export async function updateProfile(_: Res, f: FormData): Promise<Res> {
  const u = await requireStaff();
  const name = s(f, "name");
  if (!name) return { error: "Le nom est obligatoire." };
  await db.user.update({ where: { id: u.id }, data: { name, phone: s(f, "phone") || null, jobTitle: s(f, "jobTitle") || null } });
  revalidatePath("/", "layout");
  return { ok: "Profil enregistré." };
}

export async function changePassword(_: Res, f: FormData): Promise<Res> {
  const u = await requireStaff();
  if (!(await bcrypt.compare(s(f, "current"), u.passwordHash))) return { error: "Mot de passe actuel incorrect." };
  const next = s(f, "next");
  if (next.length < 8) return { error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  if (next !== s(f, "confirm")) return { error: "Les deux mots de passe ne correspondent pas." };
  await db.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "Mot de passe modifié." };
}

/* ---------- Équipe (administrateur) ---------- */

export async function createUser(_: Res, f: FormData): Promise<Res> {
  const admin = await requireAdmin();
  const email = s(f, "email").toLowerCase();
  const name = s(f, "name") || email;
  const role = ["ADMIN", "MANAGER", "MEMBER"].includes(s(f, "role")) ? s(f, "role") : "MEMBER";
  if (!email) return { error: "E-mail requis." };
  if (await db.user.findUnique({ where: { email } })) return { error: "Cet e-mail est déjà utilisé." };
  const password = tempPassword();
  const u = await db.user.create({ data: { email, name, role, jobTitle: s(f, "jobTitle") || null, passwordHash: await bcrypt.hash(password, 10) } });
  // ajout au canal d'équipe
  const general = await db.conversation.findFirst({ where: { kind: "CHANNEL", name: "Général" } });
  if (general) await db.conversationMember.create({ data: { conversationId: general.id, userId: u.id } });
  await notify([u.id], { type: "SYSTEM", title: `Bienvenue ${name.split(" ")[0]} !`, body: "Pensez à changer votre mot de passe dans Paramètres › Mon compte.", link: "/parametres/compte" }, admin.id);
  revalidatePath("/parametres/equipe");
  return { email, password };
}

export async function setUserRole(id: string, role: string) {
  const me = await requireAdmin();
  if (id === me.id) return; // évite de se retirer ses propres droits
  if (!["ADMIN", "MANAGER", "MEMBER"].includes(role)) return;
  await db.user.update({ where: { id }, data: { role } });
  revalidatePath("/parametres/equipe");
}

export async function setUserActive(id: string, active: boolean) {
  const me = await requireAdmin();
  if (id === me.id) return;
  await db.user.update({ where: { id }, data: { active } });
  revalidatePath("/parametres/equipe");
}

export async function resetUserPassword(id: string): Promise<Res> {
  await requireAdmin();
  const password = tempPassword();
  const u = await db.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  return { email: u.email, password };
}

export async function deleteUser(id: string) {
  const me = await requireAdmin();
  if (id === me.id) return;
  await db.user.delete({ where: { id } });
  revalidatePath("/parametres/equipe");
}

/* ---------- Droits ---------- */

export async function savePermissions(_: Res, f: FormData): Promise<Res> {
  await requireAdmin();
  const out = {} as Record<"MANAGER" | "MEMBER", Perms>;
  for (const role of ["MANAGER", "MEMBER"] as const) {
    const p = { ...DEFAULT_PERMS[role] } as Record<string, unknown>;
    for (const d of PERM_DEFS) {
      const v = f.get(`${role}.${d.key}`);
      p[d.key] = d.kind === "scope" ? (v === "own" ? "own" : "all") : v === "on";
    }
    out[role] = p as Perms;
  }
  await db.setting.upsert({
    where: { key: "permissions" },
    create: { key: "permissions", value: JSON.stringify(out) },
    update: { value: JSON.stringify(out) },
  });
  revalidatePath("/", "layout");
  return { ok: "Droits enregistrés. Ils s'appliquent immédiatement." };
}

/* ---------- Étiquettes ---------- */

export async function createTag(_: Res, f: FormData): Promise<Res> {
  const u = await requireStaff();
  await requirePerm(u, "canManageTags", "gérer les étiquettes");
  const name = s(f, "name");
  const color = TAG_COLORS[s(f, "color")] ? s(f, "color") : "slate";
  if (!name) return { error: "Nom requis." };
  if (await db.tag.findFirst({ where: { name: { equals: name, mode: "insensitive" } } })) return { error: "Cette étiquette existe déjà." };
  await db.tag.create({ data: { name, color } });
  revalidatePath("/parametres/etiquettes");
  return { ok: `Étiquette « ${name} » créée.` };
}

export async function updateTag(id: string, f: FormData) {
  const u = await requireStaff();
  await requirePerm(u, "canManageTags", "gérer les étiquettes");
  const name = s(f, "name");
  const color = TAG_COLORS[s(f, "color")] ? s(f, "color") : "slate";
  if (!name) return;
  await db.tag.update({ where: { id }, data: { name, color } });
  revalidatePath("/parametres/etiquettes");
}

export async function deleteTag(id: string) {
  const u = await requireStaff();
  await requirePerm(u, "canManageTags", "gérer les étiquettes");
  await db.tag.delete({ where: { id } });
  revalidatePath("/parametres/etiquettes");
}

/** Création rapide depuis la fiche client. */
export async function quickCreateTag(name: string): Promise<{ id: string; name: string; color: string } | { error: string }> {
  const u = await requireStaff();
  const p = await (await import("@/lib/permissions")).permsFor(u);
  if (!p.canManageTags) return { error: "Vous n'avez pas le droit de créer des étiquettes." };
  const clean = name.trim();
  if (!clean) return { error: "Nom vide." };
  const existing = await db.tag.findFirst({ where: { name: { equals: clean, mode: "insensitive" } } });
  if (existing) return existing;
  const colors = Object.keys(TAG_COLORS).filter((c) => c !== "slate");
  return db.tag.create({ data: { name: clean, color: colors[Math.floor(Math.random() * colors.length)] } });
}
