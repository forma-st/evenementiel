import { ConfirmButton } from "./ConfirmButton";

/** Suppression d'un dossier avec récapitulatif de ce qui est supprimé / conservé. */
export function DeleteDossierButton({ action, title, counts, compact }: {
  action: () => Promise<void>;
  title: string;
  counts: { tasks: number; activities: number; quotes: number; events: number; signatures: number; assignments: number };
  compact?: boolean;
}) {
  const kept = [
    counts.quotes && `${counts.quotes} devis`,
    counts.events && `${counts.events} événement(s)`,
    counts.signatures && `${counts.signatures} signature(s)`,
    counts.assignments && `${counts.assignments} questionnaire(s)`,
  ].filter(Boolean);
  return (
    <ConfirmButton
      action={action}
      label={compact ? "Supprimer" : "🗑 Supprimer"}
      className={compact ? "rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-brand-50 hover:text-brand-600" : "btn border border-brand-100 bg-white text-brand-600 hover:bg-brand-50"}
      title={`Supprimer la prestation « ${title} » ?`}
      message={
        <div className="space-y-2">
          <p>Seront supprimés : le journal du dossier{counts.tasks ? <> et <b>{counts.tasks} tâche(s)</b></> : ""}.</p>
          {kept.length > 0 && <p>Seront conservés, mais détachés de la prestation : {kept.join(", ")}.</p>}
          <p className="text-slate-500">Cette action est définitive.</p>
        </div>
      }
    />
  );
}
