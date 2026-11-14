import { requireStaff } from "@/lib/auth";
import { eventFormData } from "@/lib/eventFormData";
import { parisParts } from "@/lib/format";
import { EventForm } from "@/components/EventForm";
import { Back, PageHeader } from "@/components/ui";
import { createEvent } from "../actions";

export const metadata = { title: "Nouvel événement" };

export default async function NewEvent({ searchParams }: { searchParams: Promise<{ date?: string; clientId?: string; dossierId?: string; type?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const data = await eventFormData(user);
  const day = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : parisParts(new Date()).key;
  return (
    <div className="max-w-3xl">
      <Back href="/agenda">Agenda</Back>
      <PageHeader title="Nouvel événement" />
      <EventForm action={createEvent} defaults={{ day, clientId: sp.clientId, dossierId: sp.dossierId, type: sp.type }} me={user.id} submit="Créer l'événement" {...data} />
    </div>
  );
}
