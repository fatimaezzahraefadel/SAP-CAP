# Rapport Technique — Plateforme de Gestion des Congés et Certificats
## Projet de Fin d'Année — Inetum Morocco

---

## 1. Présentation du Projet

Ce rapport décrit la réalisation d'une plateforme web de gestion RH destinée à Inetum Morocco. L'application permet la gestion des congés et des certifications professionnelles pour les consultants techniques, supervisée par un manager.

La plateforme est construite sur la stack SAP CAP (Cloud Application Programming Model) avec un frontend React/TypeScript, déployable via Docker.

---

## 2. Architecture Générale

```
┌─────────────────────────────────────────────────────────┐
│                    Navigateur Web                        │
│              React + TypeScript + Vite                   │
│           http://localhost:5174 (dev)                    │
└──────────────────────┬──────────────────────────────────┘
                       │ OData v4 / REST
                       ▼
┌─────────────────────────────────────────────────────────┐
│              SAP CAP Backend (Node.js)                   │
│              http://localhost:4004                       │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ UserService  │  │ CoreService  │  │ GestionService│  │
│  │ /odata/v4   │  │ /odata/v4   │  │ /odata/v4     │  │
│  │ /user       │  │ /core        │  │ /consultant   │  │
│  └─────────────┘  └──────────────┘  │ /manager      │  │
│                                      └───────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ SQLite (dev)
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Base de Données SQLite                      │
│              db/performance.db                           │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Structure du Projet

```
SAP-CAP-FAZ-/
├── cap-backend/                    # Racine du projet SAP CAP
│   ├── db/                         # Modèle de données
│   │   ├── schema.cds              # Schéma principal (Users, Projects, Tickets...)
│   │   ├── gestion-conges-         # Modèle congés et certificats
│   │   │   certificats.cds
│   │   └── data/                   # Données initiales CSV
│   │       ├── ...db-Users.csv
│   │       ├── ...db-Employes.csv
│   │       ├── ...db-DemandesConge.csv
│   │       ├── ...db-Certificats.csv
│   │       ├── ...db-TypesConge.csv
│   │       └── ...db-DomainesCertificat.csv
│   ├── srv/                        # Services OData et logique métier
│   │   ├── gestion/                # Module congés & certificats
│   │   │   ├── consultant.service.cds
│   │   │   ├── consultant.impl.js
│   │   │   ├── manager.service.cds
│   │   │   ├── manager.impl.js
│   │   │   └── gestion.util.js
│   │   ├── user/                   # Gestion des utilisateurs
│   │   ├── auth/                   # Authentification
│   │   ├── notification/           # Notifications
│   │   ├── audit/                  # Journal d'audit
│   │   ├── _shared/                # Utilitaires partagés
│   │   │   ├── seed/               # Données de démarrage
│   │   │   ├── auth/               # Contexte requête
│   │   │   └── logging/            # Logger
│   │   ├── core-service.cds        # Service principal
│   │   ├── user-service.cds        # Service utilisateurs
│   │   ├── consultant-service.cds  # Service consultant
│   │   └── manager-service.cds     # Service manager
│   ├── app/
│   │   └── frontend/               # Application React
│   │       ├── src/
│   │       │   ├── app/
│   │       │   │   ├── pages/      # Pages par rôle
│   │       │   │   │   ├── gestion/        # Pages congés/certificats
│   │       │   │   │   ├── consultant-tech/ # Pages consultant
│   │       │   │   │   ├── manager/        # Pages manager
│   │       │   │   │   └── Login.page.tsx
│   │       │   │   ├── components/ # Composants réutilisables
│   │       │   │   ├── routing/    # Registre des routes
│   │       │   │   ├── services/   # APIs OData
│   │       │   │   ├── context/    # Contextes React
│   │       │   │   └── types/      # Types TypeScript
│   │       │   ├── locales/        # Traductions FR/EN
│   │       │   └── styles/         # Thème CSS (couleurs Inetum)
│   ├── Dockerfile                  # Image Docker de production
│   ├── mta.yaml                    # Descriptor BTP/MTA
│   ├── package.json
│   └── server.js                   # Point d'entrée serveur
└── report.md                       # Ce rapport
```

---

## 4. Modèle de Données

### 4.1 Entités principales

| Entité | Description |
|---|---|
| `Users` | Comptes utilisateurs (Manager, Consultant Technique) |
| `Employes` | Profils RH des consultants (solde congés, poste, manager) |
| `TypesConge` | Types de congés (annuel, maladie, exceptionnel, sans solde) |
| `DemandesConge` | Demandes de congé (statut, dates, jours, motif) |
| `DomainesCertificat` | Domaines SAP (ABAP, CAP, Fiori, CPI, Cloud) |
| `Certificats` | Certifications professionnelles des consultants |
| `Notifications` | Notifications temps réel (congés, certificats) |

### 4.2 Rôles utilisateurs

| Rôle | Accès |
|---|---|
| `MANAGER` | Congés équipe, Calendrier, Certificats équipe, Consultants, Administration |
| `CONSULTANT_TECHNIQUE` | Mes congés, Mes certificats |

---

## 5. Utilisateurs de la Plateforme

### Manager
| Champ | Valeur |
|---|---|
| Nom | Zakaria EZ-ZAYTTE |
| Email | zakaria.ezzaytte@inetum.com |
| Rôle | Manager |

### Consultants Techniques
| Nom | Email |
|---|---|
| Fatima-Ezzahrae FADEL | fatima.fadel@inetum.com |
| Youssef BENALI | youssef.benali@inetum.com |
| Hamza TAZI | hamza.tazi@inetum.com |
| Sanaa EL AMRANI | sanaa.elamrani@inetum.com |
| Omar LAHLOU | omar.lahlou@inetum.com |
| Imane CHERKAOUI | imane.cherkaoui@inetum.com |

---

## 6. Services OData

### 6.1 Service Consultant (`/odata/v4/consultant`)

| Endpoint | Opérations |
|---|---|
| `MonProfil` | GET (solde, poste, informations) |
| `MesDemandesConge` | GET, POST, PATCH |
| `MesCertificats` | GET, POST, PATCH, DELETE |
| `TypesConge` | GET |
| `DomainesCertificat` | GET |
| `annulerDemande` | Action POST |
| `supprimerCertificat` | Action POST |

### 6.2 Service Manager (`/odata/v4/manager`)

| Endpoint | Opérations |
|---|---|
| `DemandesCongeEquipe` | GET |
| `CertificatsEquipe` | GET |
| `ConsultantsEquipe` | GET |
| `approuverDemande` | Action POST |
| `rejeterDemande` | Action POST |
| `kpiConges` | Fonction GET |

### 6.3 Service Utilisateurs (`/odata/v4/user`)

| Endpoint | Opérations |
|---|---|
| `Users` | GET, POST, PATCH, DELETE |
| `currentUser` | Action POST |
| `Notifications` | GET, PATCH |

---

## 7. Frontend React

### 7.1 Pages Manager

| Page | Route | Description |
|---|---|---|
| Congés équipe | `/manager/leave` | Liste des demandes, approbation/rejet |
| Calendrier équipe | `/manager/calendar` | FullCalendar avec congés colorés par statut |
| Certificats équipe | `/manager/certificates` | Certifications groupées par consultant |
| Consultants | `/manager/consultants` | Fiche individuelle consultant |
| Administration | `/manager/admin` | Gestion des comptes consultants |

### 7.2 Pages Consultant Technique

| Page | Route | Description |
|---|---|---|
| Mes congés | `/consultant-tech/leave` | Soumettre, modifier, annuler des demandes + calendrier personnel |
| Mes certificats | `/consultant-tech/certificates` | Ajouter/supprimer certificats avec upload PDF |

### 7.3 Composants clés

| Composant | Rôle |
|---|---|
| `GestionManagerFiori` | Interface manager (onglets, calendrier, certificats) |
| `GestionConsultantFiori` | Interface consultant (congés + calendrier personnel) |
| `MyCertifications` | Portefeuille de certifications avec upload PDF |
| `ManagerAdmin` | Administration des comptes consultants |
| `TopBar` | Barre supérieure (notifications filtrées, profil) |
| `Sidebar` | Navigation latérale par rôle |

---

## 8. Fonctionnalités Implémentées

### 8.1 Gestion des Congés (Consultant)

- Soumission d'une demande de congé avec type, dates et motif
- Calcul automatique des jours ouvrables
- Vérification du solde disponible
- Détection des chevauchements
- Modification d'une demande en statut SOUMISE
- Annulation avec recredit automatique si approuvée
- Calendrier personnel coloré (Approuvé = teal, En attente = teal clair, Rejeté = rouge)
- Historique filtrable

### 8.2 Gestion des Certifications (Consultant)

- Ajout de certification avec nom, organisme, dates, statut
- Upload de document PDF (stocké en base64, aperçu intégré, téléchargement)
- Indicateur de validité (Valide / Expire bientôt / Expiré)
- Suppression de certification

### 8.3 Supervision (Manager)

- Tableau des demandes de l'équipe avec filtres (statut, consultant, type, période)
- Approbation avec commentaire optionnel
- Rejet avec commentaire obligatoire (decrements solde)
- Calendrier annuel de l'équipe (FullCalendar, vue mois/semaine)
- Certifications de l'équipe avec statut d'expiration
- Fiche individuelle consultant (solde, congés, certificats)

### 8.4 Administration (Manager)

- Liste des comptes consultants techniques
- Création de compte avec génération automatique de mot de passe
- Modification du nom et de la disponibilité
- Activation/désactivation d'un compte
- Suppression de compte
- Affichage du mot de passe (masqué par défaut)

### 8.5 Système

- Interface bilingue Français/Anglais (langue par défaut : Français)
- Thème Inetum : bleu marine `#1e2a3a` + teal `#3eb8a0`
- Sidebar bleu marine avec accents teal
- Notifications filtrées par rôle (congés et certificats uniquement)
- Mode sombre supporté

---

## 9. Stack Technique

### Backend
| Technologie | Version | Rôle |
|---|---|---|
| SAP CAP (`@sap/cds`) | ^8 | Framework OData v4 |
| Node.js | 22.x | Runtime |
| SQLite (`@cap-js/sqlite`) | ^1 | Base de données développement |
| `better-sqlite3` | ^12 | Driver SQLite |
| `node-cron` | ^3 | Jobs planifiés |
| `passport` | ^0.7 | Middleware auth |

### Frontend
| Technologie | Version | Rôle |
|---|---|---|
| React | 18.3.1 | UI Framework |
| TypeScript | ^5.9 | Typage statique |
| Vite | 6.3.5 | Build tool |
| TailwindCSS | 4.1.12 | Styles utilitaires |
| `@tanstack/react-query` | ^5 | Gestion état serveur |
| `@fullcalendar/react` | ^6 | Calendrier interactif |
| `react-router` | 7.13.0 | Routage |
| `i18next` | ^26 | Internationalisation |
| `sonner` | 2.0.3 | Notifications toast |
| Radix UI | divers | Composants accessibles |

---

## 10. Déploiement

### Avec Docker (Recommandé)

```powershell
cd cap-backend
docker build -t cap-backend .
docker run -d --name cap-backend -p 4004:4004 cap-backend
```

Accès : **http://localhost:4004**

### En Local (Développement)

**Terminal 1 — Backend :**
```powershell
cd cap-backend
npx cds deploy --to sqlite:db/performance.db
npm run watch
```

**Terminal 2 — Frontend :**
```powershell
cd cap-backend/app/frontend
npm install
npm run dev
```

Accès : **http://localhost:5174**

---

## 11. Identité Visuelle

La plateforme utilise les couleurs officielles du logo Inetum :

| Élément | Couleur | Hex |
|---|---|---|
| Sidebar / fond sombre | Bleu marine | `#1e2a3a` |
| Accents / boutons / badges | Teal | `#3eb8a0` |
| Fond principal | Blanc cassé | `#f8fafc` |
| Texte principal | Bleu sombre | `#1e2a3a` |

---

## 12. Améliorations Futures

- Authentification réelle avec mots de passe hashés (bcrypt + JWT)
- Envoi d'email de notification lors d'une décision de congé
- Export PDF des demandes de congé
- Tableau de bord analytique avec statistiques avancées
- Déploiement SAP BTP avec XSUAA et HANA Cloud
- Tests automatisés Jest pour les handlers métier
- Pipeline CI/CD GitHub Actions

---

## 13. Conclusion

La plateforme couvre l'ensemble des besoins RH définis pour Inetum Morocco :

- Les consultants techniques gèrent leurs congés et certifications de façon autonome
- Le manager supervise l'équipe, valide les demandes et administre les comptes
- L'interface est professionnelle, bilingue, et fidèle à l'identité visuelle Inetum
- L'architecture SAP CAP garantit une compatibilité future avec SAP BTP et HANA

---

*Rapport généré le 26 août 2026 — Projet PFA GCC CAP — Inetum Morocco*
