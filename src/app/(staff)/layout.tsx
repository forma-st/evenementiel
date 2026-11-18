import { requireStaff } from "@/lib/auth";
import { isMailConfigured } from "@/lib/mail";
import { permsFor, roleLabel } from "@/lib/permissions";
import { badgesFor } from "@/lib/badges";
import { Sidebar } from "@/components/Sidebar";
import { ChatDock } from "@/components/ChatDock";
import { getCompany } from "@/lib/company";
import { Suspense } from "react";
import { ActivityBar } from "@/components/ActivityBar";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const [p, badges, c] = await Promise.all([permsFor(user), badgesFor(user.id), getCompany()]);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Suspense fallback={null}><ActivityBar /></Suspense>
      <Sidebar
        user={{ name: user.name, role: user.role, roleLabel: roleLabel(user.role) }}
        mail={isMailConfigured()}
        badges={badges}
        show={{ quotes: p.canViewQuotes, questionnaires: p.canManageQuestionnaires, signatures: p.canSendSignatures, accounting: user.role === "ADMIN" || user.role === "MANAGER", chat: c.teamChat }}
      />
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      {c.teamChat && <ChatDock />}
    </div>
  );
}
