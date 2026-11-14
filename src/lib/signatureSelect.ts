/** Champs légers d'une demande de signature (sans les PDF, volumineux). */
export const SIGNATURE_LIGHT = {
  id: true, title: true, status: true, fileName: true, createdAt: true, completedAt: true, expiresAt: true, winOnSign: true, message: true,
  originalHash: true, signedHash: true, kind: true, clientId: true, dossierId: true, quoteId: true,
  client: { select: { name: true } },
  dossier: { select: { id: true, reference: true, title: true } },
  quote: { select: { id: true, label: true, number: true } },
  createdBy: { select: { name: true } },
  signers: { select: { id: true, name: true, email: true, token: true, status: true, viewedAt: true, signedAt: true, ip: true, declineReason: true } },
} as const;
