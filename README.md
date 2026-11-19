# Studio Événements — DJ, sonorisation, photographie

Outil de gestion tout-en-un pour prestataires événementiels (Next.js + Prisma + PostgreSQL), construit à partir du CRM FORMAST.

## Fonctionnalités

**Ventes**
- **Formulaire de demande en ligne** (`/demande`, à mettre sur votre site) : crée le client et la prestation, vérifie la disponibilité de la date, déclenche les automatisations.
- **Prestations** : type d'événement, date et horaires, lieu, invités, services (DJ, sono, lumière, photo, vidéo, photobooth), vue « À venir », pipeline glisser-déposer, détection des conflits de date.
- **Catalogue** de formules et options, **devis** composés en quelques clics (remise, acompte, conditions), PDF à vos couleurs, **lien d'acceptation en ligne** (vous êtes prévenu à l'ouverture et à la réponse).
- **Contrats** : modèles préétablis (DJ/sono, photographe, location) remplis automatiquement (client, date, lieu, prix, acompte…), devis joint en annexe, **signature électronique** avec dossier de preuve.

**Paiement en ligne et location**
- **Lien de paiement** par échéance (acompte, solde) : carte, Apple Pay, Google Pay via Stripe, ou virement ; encaissement, facture et automatisations mis à jour seuls (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
- **Location de matériel sans technicien** : dates de retrait et de retour, devis calculé avec le tarif journalier du parc, caution, état des lieux de départ et de retour, facture des dommages à la valeur de remplacement.

**Organisation**
- **Agenda** synchronisé avec les prestations (abonnement Google Agenda), rendez-vous, visites techniques.
- **Échéancier** acompte + solde, suivi des encaissements.
- **Parc matériel** et réservation par prestation, alerte de stock insuffisant le même jour.
- **Questionnaires de préparation** (déroulé de soirée, playlist, interdits, planning photo, satisfaction) dans l'espace client.
- Tâches, messagerie d'équipe, notifications, droits par rôle.

**Livraison**
- **Galeries photo privées** : envoi direct depuis le navigateur (sans limite de taille avec Vercel Blob), code d'accès, date d'expiration, sélection des favorites par le client, téléchargement photo par photo ou ZIP complet, statistiques.
- **Transferts de fichiers** (vidéos, RAW, ZIP…), type WeTransfer.
- Lien vers une galerie hébergée ailleurs (Jingoo…).
- **Espace client** : compte à rebours, documents à signer, paiements, questionnaires, galeries, factures.

**Facturation et comptabilité (micro-entreprise)**
- **Factures** d'acompte et de solde générées depuis l'échéancier (acomptes déduits), factures libres, **avoirs** ; numérotation continue attribuée à l'émission ; mentions obligatoires (franchise de TVA art. 293 B, pénalités, catégorie d'opération, SIREN du client pro…).
- **Factur-X** (PDF + XML CII profil EN 16931, validé contre le schéma officiel) pour la facturation électronique, suivi « à déposer / déposée » sur la plateforme agréée (Indy par défaut).
- **Comptabilité** : chiffre d'affaires encaissé, cotisations URSSAF calculées (taux 2026, CFP, versement libératoire, ACRE), plafond micro et seuils de TVA, **déclarations trimestrielles ou mensuelles** avec dates limites et rappels, case de la 2042-C-PRO, dépenses avec justificatifs.
- **Exports** : livre des recettes (obligatoire), registre des factures, ZIP des Factur-X, dépenses (CSV pour Indy ou l'expert-comptable).

**Automatisations** (modifiables dans Paramètres › Automatisations)
Déclencheurs : changement de statut, J-x / J+x autour de l'événement, devis sans réponse, devis accepté, contrat signé, paiement en retard, galerie publiée. Actions : e-mail au client (modèles avec variables), tâche, notification, questionnaire, changement de statut, échéancier, message à l'équipe. Règles fournies :
accusé de réception → relance devis à J+7 → contrat à l'acceptation → confirmation + échéancier à la signature → préparation à J-45 → rappel du solde à J-14 → calage et check-list matériel à J-7 → infos pratiques à J-3 → remerciements + avis à J+2 → envoi de la galerie → relance des paiements en retard. Les devis expirés et prestations passées sont mis à jour chaque matin.

## Limites à connaître
- **Indy** est plateforme agréée mais ne propose pas d'API permettant à un logiciel tiers de lui transmettre des factures (réponse de son support, 2026) : l'échange se fait par fichiers (Factur-X, CSV). L'envoi automatique pourra être branché dans `src/lib/einvoice.ts` si une API est ouverte.
- **URSSAF** : pas de dépôt automatique de la déclaration (réservé aux tiers déclarants habilités) ; l'outil calcule, rappelle et ouvre le portail.
- Le PDF Factur-X contient le XML conforme EN 16931, mais n'est pas certifié PDF/A-3 (polices standard non incorporées) : à faire valider par votre plateforme lors du premier dépôt.
- Taux, plafonds, seuils et cases fiscales sont préremplis pour 2026 et modifiables : vérifiez-les chaque année. Les modèles de contrats sont des bases à faire relire par un juriste.

## Mise en ligne (GitHub + Vercel)
1. Importez le dépôt dans Vercel (« Add New… › Project »).
2. Variables : `SESSION_SECRET`, `CRON_SECRET` (chaînes aléatoires longues).
3. Storage › Create › **Neon** (base Postgres) puis **Blob** (photos), connectés au projet.
4. Déployez puis ouvrez le site : la première visite crée le compte administrateur.
5. Paramètres › **Entreprise** (logo, SIRET, IBAN, lien d'avis), › **Comptabilité** (activité, périodicité, ACRE), › **Intégrations** (e-mails Resend).

## En local
```bash
npm install
cp .env.example .env
npm run db:push && npm run db:migrate-data
npm run db:seed        # démo : admin@exemple.fr / admin1234 · client julie.martin@exemple.fr / client1234
npm run db:migrate-data
npm run dev
```

## Organisation du code
- `prisma/schema.prisma` : modèle de données · `prisma/migrate.ts` : contenu de départ (modèles, catalogue, automatisations)
- `src/lib/automations.ts` moteur d'automatisations · `merge.ts` variables · `pdf.ts` devis/contrats/factures · `invoices.ts` Factur-X · `urssaf.ts` micro-entreprise · `storage.ts` + `zip.ts` galeries
- `src/app/(staff)/` écrans de l'équipe · `src/app/d`, `g`, `demande`, `signer`, `portail` : pages publiques et clients
