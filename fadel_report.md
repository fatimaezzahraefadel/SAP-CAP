# Rapport d'implementation - Gestion des conges et certificats

## 1. Objectif

Ce rapport explique comment les deux taches principales du cahier des charges ont ete implementees dans le projet SAP CAP :

- Gestion des conges.
- Gestion des certificats.

Le projet existait deja avec une structure SAP CAP, un backend Node.js/CDS et une application frontend. Le travail a consiste a ajouter proprement ces deux modules metier en respectant les documents Markdown fournis dans `docs/`.

## 2. Documents utilises

Les deux fichiers Markdown utilises comme reference sont :

- `docs/Cahier_des_charges_Gestion_Conges_Certificats_CAP_v1.md`
- `docs/CAP_Architecture_Guide.md`

Le cahier des charges definit les besoins fonctionnels :

- Un consultant peut soumettre, suivre, modifier ou annuler ses demandes de conge.
- Un consultant peut declarer et consulter ses certificats.
- Un manager peut consulter les demandes de son equipe.
- Un manager peut approuver ou rejeter les demandes de conge.
- Un manager peut consulter les certificats de l'equipe.
- Le backend doit etre base sur SAP CAP, CDS et OData V4.

Le guide d'architecture recommande une structure backend par domaine, avec des fichiers CDS, des handlers JavaScript et une separation claire de la logique metier.

## 3. Implementation Backend SAP CAP

### 3.1 Modele CDS

Le modele de donnees a ete ajoute dans :

```text
cap-backend/db/gestion-conges-certificats.cds
```

Les entites principales implementees sont :

- `Employes`
- `TypesConge`
- `DemandesConge`
- `DomainesCertificat`
- `Certificats`

Ce modele couvre les besoins du cahier des charges :

- un employe peut etre consultant ou manager ;
- un consultant possede un solde de conges ;
- une demande de conge contient les dates, le type, le statut, le motif et la decision manager ;
- un certificat contient le domaine, l'intitule, l'organisme, l'identifiant, les dates et le score.

Les aspects standards CAP `cuid` et `managed` sont utilises pour les identifiants et les champs d'audit.

### 3.2 Donnees de test CSV

Des fichiers CSV ont ete ajoutes dans :

```text
cap-backend/db/data/
```

Fichiers ajoutes :

```text
sap.performance.dashboard.db-Employes.csv
sap.performance.dashboard.db-TypesConge.csv
sap.performance.dashboard.db-DemandesConge.csv
sap.performance.dashboard.db-DomainesCertificat.csv
sap.performance.dashboard.db-Certificats.csv
```

Ces donnees permettent de tester directement l'application avec :

- plusieurs consultants ;
- un manager ;
- plusieurs types de conges ;
- plusieurs demandes avec differents statuts ;
- plusieurs certificats dans des domaines SAP et cloud.

### 3.3 Services OData

Deux services CAP OData V4 ont ete ajoutes, comme demande par le cahier des charges :

```text
cap-backend/srv/consultant-service.cds
cap-backend/srv/manager-service.cds
```

Les definitions principales se trouvent dans :

```text
cap-backend/srv/gestion/consultant.service.cds
cap-backend/srv/gestion/manager.service.cds
```

Endpoints exposes :

```text
/odata/v4/consultant
/odata/v4/manager
```

Le service consultant expose :

- `MonProfil`
- `TypesConge`
- `DomainesCertificat`
- `MesDemandesConge`
- `MesCertificats`
- action `annulerDemande`

Le service manager expose :

- `Consultants`
- `DemandesCongeEquipe`
- `CertificatsEquipe`
- `TypesConge`
- `DomainesCertificat`
- action `approuverDemande`
- action `rejeterDemande`
- function `kpiConges`

### 3.4 Logique metier

La logique metier a ete ajoutee dans :

```text
cap-backend/srv/gestion/consultant.impl.js
cap-backend/srv/gestion/manager.impl.js
cap-backend/srv/gestion/gestion.util.js
```

Pour les conges, la logique implemente :

- calcul automatique des jours ouvrables ;
- controle date debut/date fin ;
- controle du solde disponible ;
- controle de chevauchement avec une autre demande ;
- creation d'une demande au statut `SOUMISE` ;
- approbation par le manager avec decrement du solde ;
- rejet avec commentaire obligatoire ;
- annulation par le consultant ;
- recrédit du solde si une demande approuvee non commencee est annulee.

Pour les certificats, la logique implemente :

- creation d'un certificat par le consultant ;
- association automatique du certificat au consultant connecte ;
- consultation des certificats par consultant ou par manager.

## 4. Implementation Frontend Fiori/UI5

Le frontend existant a ete etendu avec de vraies pages basees sur UI5 Web Components React.

Packages ajoutes :

```text
@ui5/webcomponents
@ui5/webcomponents-react
@ui5/webcomponents-icons
@ui5/webcomponents-fiori
```

Pages ajoutees :

```text
cap-backend/app/frontend/src/app/pages/gestion/GestionConsultantFiori.page.tsx
cap-backend/app/frontend/src/app/pages/gestion/GestionManagerFiori.page.tsx
```

Service frontend OData ajoute :

```text
cap-backend/app/frontend/src/app/services/odata/gestionCongesCertificatsApi.ts
```

Les routes frontend ont ete branchees pour afficher :

- une page consultant pour les demandes de conge et les certificats ;
- une page manager pour les demandes de l'equipe, les certificats et les KPI.

Les composants UI5 utilises incluent notamment :

- `DynamicPage`
- `DynamicPageTitle`
- `DynamicPageHeader`
- `Card`
- `CardHeader`
- `AnalyticalTable`
- `ObjectStatus`
- `Button`
- `Title`
- `Text`
- `Label`
- `FlexBox`

L'objectif etait de faire une interface Fiori/UI5 reelle, et pas seulement une page HTML simple.

## 5. Nettoyage du projet

Le projet a ete nettoye pour enlever les elements qui ne faisaient pas partie du besoin :

- suppression du dossier `.claude` ;
- suppression des anciens fichiers lies a l'ancien dispatch automatique ;
- suppression de fichiers de documentation non necessaires ;
- suppression des references aux anciens outils externes qui ne faisaient pas partie du besoin ;
- ajout d'un `.gitignore` pour eviter de pousser les dependances, bases SQLite locales et fichiers generes.

Une recherche a ete faite pour verifier que les traces d'anciens outils externes ne restent pas dans les fichiers sources utiles.

## 6. Dockerisation

Un fichier Docker a ete ajoute :

```text
cap-backend/Dockerfile
```

Un fichier `.dockerignore` a aussi ete ajoute :

```text
cap-backend/.dockerignore
```

Docker a ete ajoute pour plusieurs raisons :

- lancer le projet dans un environnement propre et reproductible ;
- eviter les problemes de versions Node.js/npm entre machines ;
- faciliter les tests par un autre membre de l'equipe ;
- verifier que le backend CAP, le frontend build et SQLite fonctionnent ensemble ;
- preparer une base simple pour un futur deploiement.

Le conteneur :

- installe les dependances backend ;
- installe les dependances frontend ;
- build le frontend ;
- synchronise les ressources frontend ;
- compile le projet CAP ;
- deploie SQLite au demarrage ;
- lance le serveur CAP.

## 7. Comment lancer le projet avec Docker

Depuis le dossier backend :

```powershell
cd "E:\FAZ pfa\Ticket-CAP\Ticket-CAP\Ticket-CAP\cap-backend"
docker build -t gestion-conges-certificats-cap:test .
docker run --rm -p 4016:4004 gestion-conges-certificats-cap:test
```

Ensuite, ouvrir :

```text
http://localhost:4016
```

Endpoints utiles pour verifier le backend :

```text
http://localhost:4016/odata/v4/consultant/$metadata
http://localhost:4016/odata/v4/manager/$metadata
http://localhost:4016/odata/v4/consultant/TypesConge
http://localhost:4016/odata/v4/manager/kpiConges()
```

## 8. Comment lancer sans Docker

Depuis le dossier backend :

```powershell
cd "E:\FAZ pfa\Ticket-CAP\Ticket-CAP\Ticket-CAP\cap-backend"
npm install
cd app/frontend
npm install
cd ../..
npx cds deploy
npm start
```

Pour le mode developpement CAP :

```powershell
npx cds watch
```

## 9. Tests effectues

Les tests suivants ont ete faits avec Docker :

- metadata consultant : OK ;
- metadata manager : OK ;
- lecture des types de conge : OK ;
- lecture des domaines de certificats : OK ;
- lecture des demandes de conge consultant : OK ;
- lecture des certificats consultant : OK ;
- lecture des demandes manager : OK ;
- lecture des certificats manager : OK ;
- creation d'une demande de conge : OK ;
- approbation manager : OK ;
- creation d'un certificat : OK ;
- KPI manager : OK.

Exemple de resultat obtenu :

```json
{
  "LeaveStatusAfterCreate": "SOUMISE",
  "LeaveDays": 2,
  "LeaveStatusAfterApprove": "APPROUVEE",
  "CertificateTitle": "SAP CAP Smoke Test"
}
```

## 10. Ce qui peut etre ameliore

Ameliorations backend :

- separer encore plus la logique en fichiers `domain.service.js` et `repo.js`, comme recommande par le guide d'architecture ;
- ajouter des tests automatises pour les actions `approuverDemande`, `rejeterDemande` et `annulerDemande` ;
- ajouter un controle serveur plus strict des roles consultant/manager ;
- ajouter une vraie gestion d'authentification avec XSUAA ou SAP BTP ;
- enrichir les KPI manager : repartition par type de conge, jours consommes par consultant, taux d'expiration des certificats.

Ameliorations frontend :

- ajouter des formulaires complets UI5 pour creer/modifier les demandes et certificats depuis l'interface ;
- ajouter plus de filtres : statut, consultant, periode, domaine ;
- ajouter une vue calendrier pour les absences de l'equipe ;
- ajouter une matrice de competences pour les certificats ;
- ajouter des indicateurs visuels pour les certificats expires ou expirant dans moins de 90 jours.

Ameliorations DevOps :

- ajouter un `docker-compose.yml` ;
- ajouter une pipeline GitHub Actions pour build/test automatiquement ;
- ajouter un profil HANA Cloud pour preparer un deploiement SAP BTP ;
- documenter les comptes de test dans le README.

## 11. Conclusion

Les deux taches principales demandees dans le cahier des charges ont ete implementees :

- gestion des conges ;
- gestion des certificats.

Elles sont exposees via SAP CAP/CDS/OData, utilisees par une interface Fiori/UI5, testees avec des donnees CSV et lanceables dans Docker.
