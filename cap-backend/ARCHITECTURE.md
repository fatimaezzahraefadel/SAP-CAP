# Architecture — PFA-GCC-CAP
## Plateforme de Gestion des Congés et Certificats — Inetum Morocco

---

## 1. Vue globale

```
                    ┌──────────────────────────────────────────┐
                    │              NAVIGATEUR                    │
                    │  React SPA (Vite + TypeScript)             │
                    │  TanStack Query · React Router 7           │
                    │  Radix UI + Tailwind · FullCalendar        │
                    │  i18next (FR/EN) · Couleurs Inetum         │
                    └─────────────────────┬────────────────────┘
                                          │ HTTPS / OData v4
                                          ▼
    ┌────────────────────────────────────────────────────────────────┐
    │              APPLICATION ROUTER (xs-app.json)                   │
    │  • /odata/v4/*  → srv-api (auth XSUAA)                         │
    │  • /assets /locales → statique (cache, no auth)                │
    │  • /index.html  /*  → SPA fallback (auth XSUAA)                │
    └───────────────┬──────────────────────────────┬────────────────┘
                    │                               │ session
                    ▼                               ▼
   ┌──────────────────────────────────┐    ┌──────────────────┐
   │      SERVICE CAP — Node.js        │◄──►│      XSUAA       │
   │         (@sap/cds v8)             │    │  auth & rôles    │
   │                                   │    └──────────────────┘
   │  Services OData v4                │
   │   ConsultantService               │
   │   ManagerService                  │
   │   UserService                     │
   │   CoreService                     │
   │                                   │
   │  Domaines srv/<domaine>/          │
   │  ┌────────────────────────────┐   │
   │  │ gestion/consultant.impl.js  │   │
   │  │ gestion/manager.impl.js     │   │
   │  │ gestion/gestion.util.js     │   │
   │  │ user/user.domain.service.js │   │
   │  │ auth/auth.domain.service.js │   │
   │  └────────────────────────────┘   │
   └──────────────────┬────────────────┘
                      │ CQL
                      ▼
    ┌────────────────────────────────────────────┐
    │              PERSISTANCE                    │
    │  db/schema.cds                              │
    │  db/gestion-conges-certificats.cds          │
    │  ┌──────────────────────────────────────┐   │
    │  │ HANA Cloud (prod BTP)                 │   │
    │  │ SQLite      (développement local)     │   │
    │  └──────────────────────────────────────┘   │
    │  Entités :                                   │
    │  Employes · DemandesConge · TypesConge       │
    │  Certificats · DomainesCertificat            │
    │  Users · Notifications                       │
    └──────────────────────────────────────────────┘
```

---

## 2. Rôles et fonctionnalités

| Rôle | Sections | Fonctionnalités |
|---|---|---|
| **MANAGER** | Congés, Calendrier équipe, Certificats, Consultants, Administration | Approuver/rejeter congés, voir calendrier, gérer consultants |
| **CONSULTANT_TECHNIQUE** | Mes congés, Mes certificats | Soumettre congés, calendrier personnel, gérer certifications PDF |

---

## 3. Organisation Frontend

```
app/frontend/src/app/
├── pages/
│   ├── gestion/
│   │   ├── GestionConsultantFiori.page.tsx   ← Espace consultant (congés + calendrier)
│   │   └── GestionManagerFiori.page.tsx      ← Espace manager (congés + certificats)
│   ├── consultant-tech/
│   │   └── MyCertifications.page.tsx         ← Certifications + upload PDF
│   ├── manager/
│   │   └── ManagerAdmin.page.tsx             ← Administration des comptes
│   └── Login.page.tsx
├── services/odata/
│   ├── gestionCongesCertificatsApi.ts        ← API congés & certificats
│   └── usersApi.ts
├── locales/fr/ · locales/en/                 ← Traductions FR/EN
└── styles/theme.css                          ← Couleurs Inetum (#1e2a3a + #3eb8a0)
```

---

## 4. Modèle de données principal

```
Employes ──────────────────┐
  ID, nom, prenom, email    │
  poste, role, soldeConges  │
  manager (→ Employes)      │
         │                  │
         ▼                  ▼
DemandesConge          Certificats
  typeConge_ID           domaine_ID
  dateDebut/Fin          intitule
  nbJours                organisme
  statut                 documentUrl (PDF base64)
  commentaireManager     dateObtention/Expiration
```

---

## 5. Déploiement BTP

```
mbt build
    ↓
pfa-gcc-cap_1.0.0.mtar
    ↓
cf deploy
    ↓
BTP Cloud Foundry (us10-001)
    ├── pfa-gcc-cap-approuter   (public, OAuth2 via XSUAA)
    ├── pfa-gcc-cap-srv         (backend CAP, Node.js)
    ├── pfa-gcc-cap-db-deployer (déploiement schéma HANA)
    ├── pfa-gcc-cap-uaa         (service XSUAA)
    └── pfa-gcc-cap-db          (HDI container HANA)
```

---

## 6. Commandes utiles

```powershell
# Développement local
npm run watch                    # backend
cd app/frontend && npm run dev   # frontend → http://localhost:5174

# Déploiement BTP
mbt build
cf login -a https://api.cf.us10-001.hana.ondemand.com
cf deploy mta_archives/pfa-gcc-cap_1.0.0.mtar
```
