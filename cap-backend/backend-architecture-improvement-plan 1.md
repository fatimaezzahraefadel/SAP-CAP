# Plan d'amélioration de l'architecture backend

## Resume executif

Le backend SAP CAP est deja organise par domaines, avec des fichiers `service.cds`, `impl.js`, `domain.service.js` et `repo.js`. Cette base est saine, mais elle reste inegale selon les modules : certaines autorisations sont centralisees, d'autres sont codees localement, et plusieurs operations exposees par OData ne sont pas protegees de maniere explicite.

La priorite est de securiser les actions metier, puis d'harmoniser progressivement l'architecture sans refonte brutale. Les gains rapides sont :

- centraliser les roles, permissions et contextes utilisateur;
- corriger les `CREATE`, `UPDATE`, `DELETE` non couverts par des policies;
- aligner la suppression des tickets avec la regle metier : manager ou consultant fonctionnel autorise;
- creer une vraie gestion des pieces jointes de bout en bout;
- normaliser les domaines autour du pattern `handlers`, `domain`, `repo`, `policy`, `validation`.

## Comparaison architecture actuelle vs cible

| Zone | Architecture actuelle | Probleme | Architecture cible |
| --- | --- | --- | --- |
| Organisation backend | `srv/<domain>/<domain>.impl.js`, `domain.service.js`, `repo.js` | Pattern utile mais applique de facon incomplete | Domaines homogenes avec `handlers`, `domain`, `repo`, `policy`, `validation` |
| Services CAP | Services regroupes par grands endpoints : `core`, `ticket`, `time`, `user` | Les projections et extensions sont dispersees | Conserver les endpoints, mais clarifier les bounded contexts internes |
| Authentification | `base-service.js` verifie le token et remplit `req._authClaims` | Les modules lisent directement `_authClaims` | `request-context.js` unique pour extraire `userId`, `role`, `email` |
| Autorisations | `requireRole`, `requireOwnerOrRole`, sets locaux | Regles dupliquees et oublis possibles | Moteur de permissions central par action metier |
| Tickets | Logique metier dans `ticket.domain.service.js` | Suppression limitee aux managers, non conforme a la regle demandee | Policy `ticket:delete` : manager ou consultant fonctionnel proprietaire sous conditions |
| Documents | `DocumentationObjects` et `DocAttachedFiles` | Pas de vrai cycle upload/download/delete securise | Domaine `attachments` central rattache aux objets parents |
| Livrables | `url` et `fileRef` simples | Stockage et securite fichier non modelises | Livrables lies a `Attachments` |
| Audit | Audit global des CUD | Actions custom non auditees; lecture trop large | Audit actions metier et lecture reservee admin |
| Validations | Helpers partages + validations locales | Regles similaires codees plusieurs fois | Validations par domaine + helpers communs |
| Tests securite | Bonne base Jest integration | Certains chemins de permission restent non testes | Tests par role, action et entite exposee |

## Architecture cible

### Structure recommandee

Conserver l'organisation existante : ne pas recommander une refonte globale ni une migration massive des dossiers. L'approche privilégiée est incrémentale et ciblée — appliquer les changements structurels uniquement aux domaines où le gain métier est clair et planifié.

Note: la structure de fichiers détaillée ci-dessous s'applique uniquement au domaine `tickets` dans un premier temps — elle ne doit pas être imposée automatiquement à tous les autres domaines. Les autres domaines conservent l'organisation existante jusqu'à migration progressive si et quand cela devient nécessaire.

Pour le domaine `tickets`, suivre la structure suivante :

```text
domains/tickets/
  tickets.service.cds
  tickets.handlers.js
  tickets.domain.js
  tickets.repo.js
  tickets.policy.js
  tickets.validation.js
  tickets.mapper.js
```

### Responsabilites

- `*.handlers.js` : branchement CAP uniquement (`before`, `on`, `after`), extraction du contexte, appel policy, validation et domain.
- `*.domain.js` : workflows, transitions d'etat, orchestration transactionnelle.
- `*.repo.js` : requetes DB uniquement, sans role ni logique metier.
- `*.policy.js` : decisions d'autorisation par action metier.
- `*.validation.js` : payload, existence, enums, contraintes simples.
- `*.mapper.js` : conversion entre formes OData, DB et API si necessaire.

Decision pragmatique : ne pas deplacer tous les fichiers d'un coup. Les premiers domaines a traiter sont `tickets`, `documents` et `attachments`, car ils portent le plus de risque metier.

## Strategie securite, roles et permissions

### Modules partages a creer

```text
srv/_shared/auth/request-context.js
srv/_shared/security/roles.js
srv/_shared/security/actions.js
srv/_shared/security/policies.js
srv/_shared/security/permission-engine.js
```

`request-context.js` devient la seule source autorisee pour lire le contexte utilisateur :

```js
const ctx = getRequestContext(req);
// ctx.userId, ctx.role, ctx.email, ctx.isAuthenticated
```

Les domaines ne doivent plus lire directement `req._authClaims`, `req.user` ou `req.headers['x-user-id']`.

### Roles centralises

```js
const Roles = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  PROJECT_MANAGER: 'PROJECT_MANAGER',
  DEV_COORDINATOR: 'DEV_COORDINATOR',
  CONSULTANT_TECHNIQUE: 'CONSULTANT_TECHNIQUE',
  CONSULTANT_FONCTIONNEL: 'CONSULTANT_FONCTIONNEL',
};
```

### Actions metier centralisees

```js
const Actions = {
  TICKET_CREATE: 'ticket:create',
  TICKET_READ: 'ticket:read',
  TICKET_UPDATE: 'ticket:update',
  TICKET_DELETE: 'ticket:delete',
  TICKET_APPROVE: 'ticket:approve',
  TICKET_REJECT: 'ticket:reject',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
  ATTACHMENT_UPLOAD: 'attachment:upload',
  ATTACHMENT_DOWNLOAD: 'attachment:download',
  ATTACHMENT_DELETE: 'attachment:delete',
  AUDIT_READ: 'audit:read',
};
```

Chaque handler appelle :

```js
await policies.require(ctx, Actions.TICKET_DELETE, ticket);
```

### Regles prioritaires

#### Tickets

- Creation :
  - `MANAGER`, `PROJECT_MANAGER`, `DEV_COORDINATOR`;
  - `CONSULTANT_FONCTIONNEL` uniquement pour ses propres demandes, avec statut force a `PENDING_APPROVAL`.
- Lecture :
  - staff : tous les tickets;
  - consultant technique : tickets assignes a lui ou a son role;
  - consultant fonctionnel : tickets crees par lui ou ou il est testeur fonctionnel.
- Modification :
  - staff : selon workflow;
  - consultant technique : champs d'execution limites sur tickets assignes;
  - consultant fonctionnel : commentaires, tests et details fonctionnels autorises selon statut.
- Suppression :
  - `MANAGER` autorise;
  - `CONSULTANT_FONCTIONNEL` autorise si le ticket est cree par lui, non approuve, sans temps impute, sans livrable valide et sans piece jointe verrouillee;
  - autres roles interdits.
- Validation/rejet :
  - `MANAGER` ou `PROJECT_MANAGER`, selon le workflow retenu.

#### Documents

- Creation : utilisateur authentifie; `authorId` force a `ctx.userId`.
- Lecture : autorisee si l'utilisateur peut lire le projet ou ticket parent.
- Modification : auteur ou role staff.
- Suppression : auteur si document non verrouille; sinon `MANAGER` ou `ADMIN`.
- Interdiction : modification directe de `authorId`.

#### Pieces jointes

- Upload : autorise si l'utilisateur peut modifier l'objet parent.
- Download : autorise si l'utilisateur peut lire l'objet parent.
- Delete : autorise si l'utilisateur peut modifier l'objet parent et si le fichier n'est pas verrouille.
- Admin : suppression technique possible, toujours auditee.

#### Audit logs

- Lecture reservee a `ADMIN`.
- Masquer les champs sensibles dans `details` : `password`, `token`, `authorization`, `secret`.

### Corrections immediates

- Ajouter les hooks `before DELETE` manquants pour `ReferenceData`, `Allocations`, `Evaluations`, `DocumentationObjects`, `Deliverables`, `ProjectFeedback`.
- Ajouter ou completer les hooks `before UPDATE` pour `Evaluations` et `ProjectFeedback`.
- Restreindre `AuditLogs` a `ADMIN`.
- Supprimer les acces demo et conserver uniquement l'authentification XSUAA.
- Corriger la suppression ticket selon la regle metier.

## Plan pieces jointes

### Probleme actuel

Le modele actuel contient plusieurs formes de fichiers :

- `DocumentationObjects.attachedFiles` via `DocAttachedFiles`;
- `Deliverables.fileRef`;
- `Deliverables.url`;
- `fileUrl` cote documentation.

Ces champs stockent des references, mais ne definissent pas un vrai cycle de vie fichier : upload, download, securite, suppression, reconciliation et nettoyage.

### Modele cible

Ajouter une entite centrale :

```cds
entity Attachments : cuid, managed {
  parentType      : String(40) not null;
  parentId        : String(50) not null;
  fileName        : String(255) not null;
  originalName    : String(255) not null;
  @Core.MediaType : mimeType;
  content         : LargeBinary;
  mimeType        : String(120) not null;
  sizeBytes       : Integer not null;
  storageKey      : String(500) not null;
  checksumSha256  : String(64);
  uploadedBy      : String(50) not null;
  status          : String(20) default 'ACTIVE';
  deletedAt       : DateTime;
  deletedBy       : String(50);
}
```

Le champ `content` porte le binaire du fichier, et `@Core.MediaType : mimeType` indique le type MIME associe au contenu.

Valeurs autorisees :

- `parentType` : `TICKET`, `DOCUMENT`, `DELIVERABLE`, `COMMENT`;
- `status` : `ACTIVE`, `DELETED`, `ORPHANED`.

### Stockage

Decision v1 :

- ne pas stocker les binaires dans SQLite;
- utiliser un storage local configurable;
- creer une interface compatible S3/Azure Blob pour evolution future.

Variables :

```text
ATTACHMENT_STORAGE_DRIVER=local
ATTACHMENT_STORAGE_ROOT=./storage/attachments
ATTACHMENT_MAX_SIZE_MB=25
ATTACHMENT_ALLOWED_MIME_TYPES=pdf,png,jpg,jpeg,docx,xlsx,txt
ATTACHMENT_RETENTION_DAYS=30
```

### API backend

Creer le domaine `attachments` avec actions CAP :

- `uploadAttachment(parentType, parentId, fileName, mimeType, contentBase64)` retourne `Attachment`;
- `downloadAttachment(ID)` retourne un flux ou une URL de telechargement controlee;
- `deleteAttachment(ID)` passe le statut a `DELETED`;
- `listAttachments(parentType, parentId)` retourne les metadonnees autorisees.

Decision v1 : utiliser `contentBase64` via CAP pour eviter une introduction immediate du multipart. Decision v2 : ajouter un endpoint Express multipart si les fichiers deviennent volumineux.

### Securite fichiers

- Generer un `storageKey` non devinable : `${parentType}/${parentId}/${uuid}-${safeFileName}`.
- Nettoyer les noms avec `sanitizeFileName`.
- Refuser les extensions dangereuses et MIME types non autorises.
- Calculer `checksumSha256`.
- Verifier la permission sur le parent avant chaque upload/download/delete.
- Ne jamais retourner le chemin disque reel.
- Auditer upload, download sensible et suppression.

### Nettoyage

Ajouter trois jobs :

- `cleanupOrphanAttachments` : marque `ORPHANED` si le parent n'existe plus.
- `purgeDeletedAttachments` : supprime physiquement les fichiers `DELETED` au-dela de la retention.
- `reconcileStorage` : detecte les fichiers presents sur disque sans metadonnees DB.

## Dette technique et normalisation

### Dette identifiee

- Regles de roles dispersees entre plusieurs fichiers.
- Acces direct a `req._authClaims` dans de nombreux domaines.
- Certaines entites exposent `DELETE` sans policy explicite.
- Actions custom non auditees.
- Pieces jointes modelisees comme simples URLs/references.
- Duplications de validations d'existence, dates, transitions et proprietaire.
- Root `npm run lint` casse sur les fichiers `.mjs` frontend.

### Normalisations a appliquer

- Remplacer les sets locaux de roles par `roles.js`.
- Remplacer `requireRole` et `requireOwnerOrRole` directs par des policies metier.
- Creer `assertTransition(current, next, transitionMap, entityName)`.
- Centraliser `assertExists(entity, id, field)`.
- Standardiser les erreurs avec `badRequest`, `forbidden`, `notFound`, `conflict`.
- Etendre l'audit aux actions custom : approbation ticket, rejet ticket, upload, download, suppression fichier.
- Documenter la matrice de securite dans `docs/security-matrix.md`.

## Roadmap

### Court terme

Objectifs :

- Securiser rapidement les chemins critiques.
- Corriger les incoherences visibles.
- Eviter une refonte globale prematuree.

Changements techniques :

- Creer `request-context`, `roles`, `actions`, `policies`.
- Ajouter les policies pour tickets, documents, audit logs.
- Corriger les hooks `DELETE` manquants.
- Restreindre `AuditLogs` a `ADMIN`.
- Modifier la suppression ticket selon la regle manager ou consultant fonctionnel autorise.
- Desactiver quick access/demo credentials hors local.
- Corriger la configuration ESLint root.

Risques :

- Certains ecrans frontend peuvent dependre de permissions trop larges.
- Les tests existants peuvent devoir etre ajustes car certaines operations deviendront correctement interdites.

Tests :

- Tests integration par role sur tickets, documents, reference data, allocations, evaluations.
- Tests `403` pour chaque operation sensible.
- Test suppression ticket : manager OK, consultant fonctionnel proprietaire OK sous conditions, autres roles KO.
- Executer `npm test`, `npm run build`, `npm run lint`, frontend `npm run check`.

### Moyen terme

Objectifs :

- Installer l'architecture par domaines.
- Ajouter la gestion complete des pieces jointes.
- Reduire les duplications.

Changements techniques :

- Creer le domaine `attachments`.
- Ajouter l'entite `Attachments`.
- Migrer progressivement `DocAttachedFiles`, `Deliverables.fileRef`, `Deliverables.url`.
- Refactorer `tickets`, `documents`, `time` vers `handlers/domain/repo/policy/validation`.
- Ajouter audit des actions custom.
- Ajouter les jobs de nettoyage.

Risques :

- Migration des anciennes references fichier.
- Incoherence temporaire entre ancien modele `attachedFiles` et nouveau `Attachments`.
- Gestion des erreurs entre ecriture fichier et transaction DB.

Tests :

- Upload/download/delete bout en bout.
- Test rollback si l'ecriture fichier echoue.
- Test rollback si la DB echoue apres ecriture fichier.
- Test download interdit sur parent non autorise.
- Test migration des anciennes pieces jointes.

### Long terme

Objectifs :

- Preparer l'exploitation et la montee en charge.
- Clarifier les bounded contexts metier.
- Industrialiser observabilite et securite.

Changements techniques :

- Remplacer le stockage local par S3/Azure Blob via `storage-driver`.
- Ajouter des URLs signees a duree courte.
- Remplacer l'auth demo par une authentification externe.
- Ajouter logs structures et traces pour actions metier.
- Extraire les workflows complexes en state machines declaratives.
- Ajouter des vues read-only dediees par role si les filtres dynamiques deviennent trop complexes.

Risques :

- Migration storage.
- Coordination frontend/backend sur les nouvelles APIs.
- Complexite accrue si les workflows ne sont pas documentes.

Tests :

- Tests de charge basiques sur listes, upload et download.
- Tests compatibilite local storage/S3.
- Tests URL signee expiree.
- Tests de reprise apres fichier manquant.

## Conventions de structure et nommage

### Dossiers

- Domaines : pluriel metier en kebab-case, ex. `tickets`, `reference-data`.
- Partage : `_shared`.
- Securite : `_shared/security`.
- Auth context : `_shared/auth`.
- Stockage : `_shared/storage`.

### Fichiers

- `tickets.service.cds`
- `tickets.handlers.js`
- `tickets.domain.js`
- `tickets.repo.js`
- `tickets.policy.js`
- `tickets.validation.js`
- `tickets.mapper.js`

### Regles de code

- Aucun acces direct a `req._authClaims` hors `_shared/auth`.
- Aucun acces DB dans les handlers.
- Aucune logique de role dans les repositories.
- Toute entite mutable doit avoir une policy explicite pour `CREATE`, `UPDATE`, `DELETE`.
- Toute action custom doit etre auditee.
- Toute transition d'etat doit passer par une map declarative.
- Aucun chemin fichier disque ne doit etre expose au frontend.

## Checklist d'execution

1. Creer `_shared/auth/request-context.js`.
2. Creer `_shared/security/roles.js`.
3. Creer `_shared/security/actions.js`.
4. Creer `_shared/security/permission-engine.js`.
5. Creer les premieres policies : tickets, documents, audit.
6. Corriger les permissions critiques sur `Tickets`.
7. Ajouter les hooks `DELETE` manquants sur les entites exposees.
8. Restreindre la lecture des `AuditLogs`.
9. Desactiver quick access et credentials demo hors local.
10. Corriger `npm run lint` a la racine.
11. Ajouter les tests d'integration securite par role.
12. Creer l'entite `Attachments`.
13. Implementer le storage driver local.
14. Ajouter les actions CAP `upload`, `download`, `delete`, `list`.
15. Brancher les attachments sur documents.
16. Brancher les attachments sur tickets et livrables.
17. Ajouter les jobs de nettoyage.
18. Migrer les anciennes references `DocAttachedFiles`, `fileRef`, `fileUrl`.
19. Refactorer `tickets` vers `handlers/domain/repo/policy/validation`.
20. Refactorer `documents` et `time` avec le meme pattern.
21. Etendre l'audit aux actions custom.
22. Ajouter `docs/security-matrix.md`.

## Hypotheses

- SAP CAP et OData restent l'interface backend principale.
- CommonJS est conserve a court terme.
- SQLite et stockage local restent acceptables en developpement.
- La priorite est la securisation et la clarte avant une refonte structurelle complete.
- La premiere version des pieces jointes peut utiliser `base64` via action CAP.
- Le multipart et le stockage objet arrivent en phase ulterieure.
