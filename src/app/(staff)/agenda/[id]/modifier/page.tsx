import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/lib/auth";
import { eventWhere, permsFor } from "@/lib/permissions";
import { eventFormData } from "@/lib/eventFormData";
import { parisParts, time } from "@/lib/format";
import { EventForm } from "@/components/EventForm";
import { Back, PageHeader } from "@/components/ui";
import { updateEvent } from "../../actions";

export const metadata = { title: "Modifier l'événement" };

export default async function EditEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireStaff();
  const e = await db.event.findFirst({ where: { id, ...eventWhere(user, await permsFor(user)) }, include: { attendees: true } });
  if (!e) notFound();
  const data = await eventFormData(user);
  return (
    <div className="max-w-3xl">
      <Back href={`/agenda/${id}`}>{e.title}</Back>
      <PageHeader title="Modifier l'événement" />
      <EventForm
        action={updateEvent.bind(null, id)}
        me={user.id}
        submit="Enregistrer"
        defaults={{
          title: e.title, type: e.type, allDay: e.allDay,
          day: parisParts(e.start).key, endDay: parisParts(new Date(e.end.getTime() - 1)).key,
          startTime: time(e.start), endTime: time(e.end),
          location: e.location ?? "", description: e.description ?? "",
          clientId: e.clientId ?? "", dossierId: e.dossierId ?? "",
          attendees: e.attendees.map((a) => a.userId),
        }}
        {...data}
      />
    </div>
  );
}
