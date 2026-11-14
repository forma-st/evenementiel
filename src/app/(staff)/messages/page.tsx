import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { conversationsFor } from "@/lib/chat";
import { Empty } from "@/components/ui";

export default async function MessagesHome() {
  const u = await requireStaff();
  const list = await conversationsFor(u.id);
  if (list.length) redirect(`/messages/${(list.find((c) => c.name === "# Général") ?? list[0]).id}`);
  return <div className="card"><Empty>Aucune conversation pour le moment.</Empty></div>;
}
