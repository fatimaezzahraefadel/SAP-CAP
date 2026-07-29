# Rapport d'implementation - Gestion des conges et certificats

## 1. Objectif

Ce rapport detaille la realisation des deux modules demandes dans le cahier des charges :

- gestion des conges des consultants techniques ;
- gestion des certificats professionnels.

Le developpement a ete fait dans le projet SAP CAP existant, avec un backend CDS/OData V4, une logique metier Node.js, une base SQLite de developpement, une interface web professionnelle et une execution Docker.

## 2. Documents de reference

Les exigences ont ete reprises depuis :

- `docs/Cahier_des_charges_Gestion_Conges_Certificats_CAP_v1.md`
- `docs/CAP_Architecture_Guide.md`

Le cahier des charges demande deux espaces distincts :

- un espace consultant pour soumettre, suivre, modifier et annuler ses demandes de conge, puis declarer et maintenir ses certificats ;
- un espace manager pour superviser les demandes, approuver ou rejeter, suivre les absences, les KPI et les competences certifiees.

Le guide d'architecture recommande une separation par domaine : modele dans `db/`, services OData dans `srv/`, handlers metier dans `srv/gestion/`, donnees CSV dans `db/data/`.

## 3. Backend SAP CAP

### 3.1 Modele CDS

Le modele est defini dans :

```text
cap-backend/db/gestion-conges-certificats.cds
```

Entites implementees :

- `Employes` : consultant/manager, email, poste, solde de conges, relation manager.
- `TypesConge` : conge annuel, maladie, exceptionnel, sans solde, deduction du solde, duree maximale.
- `DemandesConge` : consultant, type, dates, nombre de jours, motif, statut, commentaire manager, date de decision.
- `DomainesCertificat` : SAP ABAP, SAP CPI, SAP Fiori/UI5, SAP CAP/BTP, Cloud, Autre.
- `Certificats` : consultant, domaine, intitule, organisme, identifiant, date d'obtention, expiration, score.

Les entites utilisent `cuid` et `managed` pour les identifiants et les champs d'audit.

### 3.2 Donnees de test

Les CSV sont dans :

```text
cap-backend/db/data/
```

Ils couvrent plusieurs consultants, un manager, les types de conges minimum, les domaines de certificats minimum, des demandes dans plusieurs statuts et des certificats valides/proches expiration/expires.

### 3.3 Services OData

Services exposes :

```text
/odata/v4/consultant
/odata/v4/manager
```

Definitions :

```text
cap-backend/srv/gestion/consultant.service.cds
cap-backend/srv/gestion/manager.service.cds
```

Le service consultant expose `MonProfil`, `MesDemandesConge`, `MesCertificats`, les listes de valeurs, l'action `annulerDemande` et l'action `supprimerCertificat`.

Le service manager expose les demandes de l'equipe, les certificats de l'equipe, les consultants, les listes de valeurs, les actions `approuverDemande` et `rejeterDemande`, plus la fonction `kpiConges`.

### 3.4 Logique metier

Handlers :

```text
cap-backend/srv/gestion/consultant.impl.js
cap-backend/srv/gestion/manager.impl.js
cap-backend/srv/gestion/gestion.util.js
```

Regles de conges implementees :

- calcul automatique des jours ouvrables ;
- refus si la date de fin est avant la date de debut ;
- refus si le solde est insuffisant pour un type deduit du solde ;
- refus si la demande chevauche une autre demande active ;
- creation au statut `SOUMISE` ;
- modification autorisee uniquement au statut `SOUMISE` ;
- annulation autorisee au statut `SOUMISE` ou `APPROUVEE` non commencee ;
- recredit du solde si une demande approuvee future est annulee ;
- approbation manager avec decrement du solde ;
- rejet manager avec commentaire obligatoire.

Regles de certificats implementees :

- creation d'un certificat par le consultant ;
- association automatique au consultant courant ;
- modification d'un certificat par son proprietaire ;
- suppression d'un certificat par son proprietaire ;
- consultation du portefeuille consultant ;
- consultation globale par le manager ;
- calcul cote UI de la validite : valide, expire bientot, expire, sans expiration.

Autorisation :

- le service consultant filtre les lectures sur le consultant courant ;
- le service manager verifie le role manager pour les lectures/actions ;
- les actions manager sont bloquees pour un role consultant dans le mode utilisateur de test.

## 4. Frontend

Fichiers principaux :

```text
cap-backend/app/frontend/src/app/pages/gestion/GestionConsultantFiori.page.tsx
cap-backend/app/frontend/src/app/pages/gestion/GestionManagerFiori.page.tsx
cap-backend/app/frontend/src/app/services/odata/gestionCongesCertificatsApi.ts
```

L'interface consomme les services SAP CAP/OData V4 avec `fetch` via le client OData existant. Les ecrans utilisent le design system React deja present dans l'application, avec les dependances SAP UI5 installees dans le projet pour rester compatible avec l'environnement Fiori/SAP du livrable.

Bibliotheques ajoutees pour respecter explicitement la stack du cahier des charges :

- `@fullcalendar/react`
- `@fullcalendar/daygrid`
- `@fullcalendar/interaction`
- `chart.js`
- `react-chartjs-2`

### 4.1 Espace consultant

Fonctionnalites livrees :

- affichage du solde restant ;
- affichage du nombre de demandes soumises ;
- formulaire de soumission d'une demande ;
- modification d'une demande tant qu'elle est `SOUMISE` ;
- annulation d'une demande `SOUMISE` ou `APPROUVEE` non commencee ;
- historique avec statut et commentaire manager ;
- filtres par statut, type et recherche texte ;
- formulaire d'ajout de certificat ;
- modification et suppression d'un certificat ;
- portefeuille de certificats trie par date d'obtention ;
- filtres par domaine, validite et recherche texte ;
- indicateurs visuels pour certificats expires ou expirant dans les 90 jours.

### 4.2 Espace manager

Fonctionnalites livrees :

- liste des demandes de l'equipe ;
- filtres par statut, consultant, type, periode et recherche texte ;
- mise en evidence des demandes `SOUMISE` ;
- approbation avec commentaire optionnel ;
- rejet avec commentaire obligatoire ;
- KPI : demandes en attente, absences en cours, jours consommes, taux d'approbation, total certificats, certificats a 90 jours, consultants sans certificat ;
- graphiques Chart.js : jours consommes par consultant, repartition par type de conge, decisions manager, certificats par domaine et validite ;
- calendrier d'equipe avec FullCalendar pour visualiser les absences approuvees et soumises ;
- liste des certificats de l'equipe ;
- filtres certificats par consultant, domaine, validite et recherche texte ;
- matrice de competences consultants x domaines ;
- fiche consultant : solde, email, jours consommes, certificats et historique.

## 5. Correspondance avec les exigences

### 5.1 Conges consultant

| Ref | Exigence | Statut | Implementation |
| --- | --- | --- | --- |
| CG-01 | Consulter le solde | Fait | KPI `Solde restant` depuis `MonProfil`. |
| CG-02 | Soumettre une demande | Fait | Formulaire consultant + `CREATE MesDemandesConge`. |
| CG-03 | Controles automatiques | Fait | Handler CAP : dates, solde, chevauchement. |
| CG-04 | Modifier une demande soumise | Fait | Bouton `Modifier` + `PATCH MesDemandesConge`, bloque cote serveur si statut different. |
| CG-05 | Annuler une demande | Fait | Action `annulerDemande`, avec recredit si approuvee future. |
| CG-06 | Suivre ses demandes | Fait | Historique filtre avec statut et commentaire manager. |

### 5.2 Certificats consultant

| Ref | Exigence | Statut | Implementation |
| --- | --- | --- | --- |
| CT-01 | Ajouter un certificat | Fait | Formulaire + `CREATE MesCertificats`. |
| CT-02 | Modifier / supprimer | Fait | Boutons `Modifier` et `Supprimer`, action `supprimerCertificat`. |
| CT-03 | Consulter portefeuille | Fait | Liste filtrable par domaine et validite, triee par obtention. |
| CT-04 | Alerte expiration | Fait | KPI `A renouveler` et badge de validite. |

### 5.3 Conges manager

| Ref | Exigence | Statut | Implementation |
| --- | --- | --- | --- |
| MG-01 | Consulter demandes equipe avec filtres | Fait | Table manager avec filtres statut, consultant, type, periode, recherche. |
| MG-02 | Approuver | Fait | Action `approuverDemande`, solde decremente. |
| MG-03 | Rejeter avec commentaire | Fait | Action `rejeterDemande`, commentaire obligatoire. |
| MG-04 | Calendrier equipe | Fait | Onglet `Calendrier` avec FullCalendar. |
| MG-05 | KPI supervision | Fait | Fonction `kpiConges`, cartes KPI et graphiques Chart.js. |
| MG-06 | Fiche consultant | Fait | Onglet `Fiche consultant`. |

### 5.4 Certificats manager

| Ref | Exigence | Statut | Implementation |
| --- | --- | --- | --- |
| MC-01 | Visualiser certificats equipe avec filtres | Fait | Table avec filtres consultant, domaine, validite, recherche. |
| MC-02 | Matrice competences | Fait | Onglet `Matrice`. |
| MC-03 | Suivi expirations | Fait | Validite `EXPIRE_BIENTOT` / `EXPIRE` et KPI. |
| MC-04 | KPI certificats | Fait | Total certificats, a 90 jours, expires, consultants sans certificat. |

### 5.5 Transverse

| Exigence | Statut | Implementation |
| --- | --- | --- |
| Pages adaptees au role | Fait | Routes consultant et manager separees. |
| Recherche et filtres | Fait | Filtres sur demandes et certificats. |
| Controle autorisations | Fait en mode developpement | Controle par role/test user dans les handlers CAP. |
| Messages d'erreur en francais | Fait | `req.reject` avec messages metier en francais. |

## 6. Dockerisation

Fichiers :

```text
cap-backend/Dockerfile
cap-backend/.dockerignore
```

Docker a ete ajoute pour :

- garantir un environnement reproductible ;
- compiler le frontend et le backend dans une image propre ;
- tester CAP + OData + SQLite ensemble ;
- faciliter la demonstration sur une autre machine.

## 7. Execution

Avec Docker :

```powershell
cd cap-backend
docker build -t gestion-conges-certificats-cap:test .
docker run --rm -p 4016:4004 gestion-conges-certificats-cap:test
```

Ouvrir :

```text
http://localhost:4016/manager/leave
http://localhost:4016/consultant-tech/leave
```

Sans Docker :

```powershell
cd cap-backend
npm install
cd app/frontend
npm install
cd ../..
npx cds deploy
npm start
```

Mode developpement :

```powershell
cd cap-backend
npx cds watch
```

Endpoints utiles :

```text
http://localhost:4016/odata/v4/consultant/$metadata
http://localhost:4016/odata/v4/manager/$metadata
http://localhost:4016/odata/v4/manager/kpiConges()
```

## 8. Verification effectuee

Commandes executees :

```powershell
cd cap-backend/app/frontend
npx tsc --noEmit --noUnusedLocals false --noUnusedParameters false

cd ../..
npm run build
```

Resultat :

- verification TypeScript : OK ;
- build frontend Vite : OK ;
- build CAP : OK ;
- generation OData/metadata : OK.

## 9. Ameliorations possibles

- Ajouter des tests automatises Jest pour les actions de conge et certificats.
- Brancher une vraie authentification XSUAA/BTP au lieu du mode test/dummy.
- Ajouter un `docker-compose.yml` avec profils SQLite et HANA.
- Ajouter des captures d'ecran dans une documentation utilisateur.
- Ajouter une pipeline GitHub Actions pour build/test automatique.

## 10. Conclusion

Les deux modules demandes par le cahier des charges sont maintenant couverts :

- le consultant gere ses conges et son portefeuille de certificats ;
- le manager pilote les demandes, absences, KPI, certificats, matrice de competences et fiches consultants ;
- le tout fonctionne avec SAP CAP, CDS, OData V4, SQLite local, frontend web et Docker.
