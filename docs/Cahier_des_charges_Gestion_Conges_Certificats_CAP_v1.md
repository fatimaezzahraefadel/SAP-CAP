# CAHIER DES CHARGES
Projet de développement applicatif

Application de gestion des congés et des certificats
des consultants techniques – Inetum

Technologie : SAP Cloud Application Programming Model (CAP)

Durée : 2 semaines
Version 1 – Juillet 2026

<!-- Page 2 -->

## 1. Contexte du projet
Inetum est une entreprise de services du numérique (ESN) dont les consultants techniques doivent
régulièrement soumettre des demandes de congés (annuels, exceptionnels, maladie, etc.) et
obtiennent, tout au long de leur carrière, des certificats professionnels dans différents domaines
technologiques (SAP ABAP, SAP CPI, SAP Fiori, cloud, etc.). Aujourd'hui, les demandes de congés sont
traitées par e-mails ou formulaires papier, sans traçabilité ni visibilité sur les soldes et les statuts, et
les certificats des consultants ne sont recensés nulle part, ce qui empêche le manager d'avoir une vue
claire sur les compétences certifiées de son équipe. Le présent projet consiste donc à développer, avec
le SAP Cloud Application Programming Model (CAP), une application web interne mettant en relation
deux acteurs : le consultant technique, qui soumet et suit ses demandes de congés et déclare ses
certificats obtenus, et le manager, qui approuve ou rejette les demandes de congés, pilote les
absences de son équipe grâce à un calendrier global et des indicateurs de supervision (KPI), et visualise
l'ensemble des certificats de ses consultants.

## 2. Objectifs du projet

### 2.1 Objectifs métier
- Digitaliser et centraliser le processus complet de demande et d'approbation des congés.
- Centraliser le référentiel des certificats professionnels des consultants (SAP ABAP, SAP CPI, SAP
Fiori, cloud, etc.).
- Offrir au consultant une visibilité en temps réel sur son solde de congés, le statut de ses
demandes et son portefeuille de certificats.
- Offrir au manager une vue globale des absences de son équipe (calendrier), des indicateurs de
supervision (KPI) et des compétences certifiées de ses consultants.
- Assurer la traçabilité complète des demandes de congés et des certificats (dates, statuts,
décisions, expirations).

### 2.2 Objectifs pédagogiques (pour l'étudiant)
- Découvrir le développement d'une application complète : modèle de données, services,
interface utilisateur.
- Apprendre les fondamentaux de SAP CAP : CDS (Core Data Services), services OData, logique
métier en Node.js, gestion des rôles et autorisations.
- Mettre en œuvre un workflow simple d'approbation (soumission → approbation / rejet).
- Développer une interface web en HTML, CSS, Bootstrap et JavaScript consommant une API
OData, et appliquer les bonnes pratiques de développement (Git, tests, documentation).

## 3. Acteurs et périmètre

### 3.1 Les deux acteurs de l'application
Acteur                         Rôle dans l'application

<!-- Page 3 -->

Consultant technique           Soumet ses demandes de congés, consulte son solde et son historique, modifie
ou annule ses demandes tant qu'elles ne sont pas traitées, et déclare ses
certificats obtenus (SAP ABAP, CPI, Fiori, etc.) avec leurs dates d'obtention et
d'expiration.
Manager                        Supervise l'équipe : consulte, approuve ou rejette les demandes de congés,
visualise les absences sur un calendrier d'équipe, suit des KPI de supervision, et
visualise l'ensemble des certificats des consultants (par domaine, par consultant,
expirations à venir).

Chaque acteur dispose de son propre espace dans l'application, avec des droits d'accès distincts : un
consultant ne voit que ses propres demandes et certificats ; le manager voit les demandes et certificats
de tous les consultants de son équipe.

### 3.2 Dans le périmètre
- Cycle de vie complet des demandes de congés : soumission par le consultant, approbation ou
rejet par le manager.
- Gestion des certificats professionnels : déclaration par le consultant, visualisation et suivi par le
manager.
- Calcul automatique du solde de congés et de la durée des demandes.
- Calendrier d'équipe et indicateurs (KPI) côté manager.
- Gestion des rôles et autorisations (consultant / manager).

## 4. Besoins fonctionnels

### 4.1 Espace Consultant – Gestion de ses congés
Réf.          Fonctionnalité                     Description
CG-01         Consulter le solde                 Le consultant visualise son solde de congés restant (droit
annuel de 22 jours, moins les jours consommés sur les
demandes approuvées).
CG-02         Soumettre une demande              Saisie du type de congé, de la date de début, de la date de fin
et d'un motif. La durée en jours ouvrés est calculée
automatiquement. La demande est créée au statut « Soumise
».
CG-03         Contrôles automatiques             Rejet à la saisie si : date de fin antérieure à la date de début,
solde insuffisant, chevauchement avec une demande
existante non rejetée / non annulée.
CG-04         Modifier une demande               Possible uniquement tant que la demande est au statut «
Soumise » (non encore traitée par le manager).
CG-05         Annuler une demande                Possible au statut « Soumise » ; si la demande était «
Approuvée » et non commencée, l'annulation recrédite le
solde.
CG-06         Suivre ses demandes                Liste filtrable et triable de ses demandes avec statut
(Soumise, Approuvée, Rejetée, Annulée) et commentaire
éventuel du manager.

<!-- Page 4 -->

Types de congés à gérer au minimum : congé annuel payé, congé maladie, congé exceptionnel
(mariage, naissance, décès), congé sans solde.

### 4.2 Espace Consultant – Mes certificats
Réf.         Fonctionnalité                  Description
CT-01        Ajouter un certificat           Déclaration d'un certificat obtenu : intitulé, domaine (SAP
ABAP, SAP CPI, SAP Fiori, cloud, etc.), organisme certificateur,
identifiant du certificat, date d'obtention, date d'expiration
éventuelle, score obtenu.
CT-02        Modifier / supprimer un         Le consultant peut corriger les informations d'un certificat
certificat                      déclaré ou le supprimer.
CT-03        Consulter mon portefeuille      Liste de tous ses certificats, filtrable par domaine et triable
par date d'obtention ; les certificats expirés ou proches de
l'expiration (moins de 90 jours) sont mis en évidence.
CT-04        Alerte d'expiration             Un indicateur visuel signale au consultant les certificats à
renouveler.

Domaines de certificats à gérer au minimum : SAP ABAP, SAP CPI (Integration Suite), SAP Fiori / UI5,
SAP CAP / BTP, Cloud (AWS, Azure, GCP), Autre.

### 4.3 Espace Manager – Gestion des demandes de congés
Réf.         Fonctionnalité                  Description
MG-01        Consulter les demandes de       Liste de toutes les demandes de congés des consultants,
l'équipe                        filtrable par statut, consultant, type et période. Les demandes
« Soumises » (en attente) sont mises en évidence.
MG-02        Approuver une demande           Le manager approuve une demande « Soumise » ; le solde du
consultant est alors décrémenté. Un commentaire optionnel
peut être ajouté.
MG-03        Rejeter une demande             Le manager rejette une demande « Soumise » avec un
commentaire obligatoire expliquant le motif du rejet.
MG-04        Calendrier d'équipe             Vue calendrier des absences approuvées et en attente de
tous les consultants, pour visualiser les chevauchements et la
couverture de l'équipe.
MG-05        KPI de supervision              Tableau de bord avec indicateurs : nombre de demandes en
attente, absences en cours, jours consommés par consultant,
répartition par type de congé, taux d'approbation.
MG-06        Consulter la fiche d'un         Détail d'un consultant : solde, historique des demandes, jours
consultant                      consommés.

### 4.4 Espace Manager – Visualisation des certificats
Réf.         Fonctionnalité                  Description
MC-01        Visualiser les certificats de   Liste de tous les certificats des consultants, filtrable par
l'équipe                        domaine, consultant, organisme et validité (valide / expiré /
expire bientôt).

<!-- Page 5 -->

MC-02            Matrice de compétences                Vue synthétique croisant consultants et domaines : nombre
de certificats par consultant et par domaine, pour identifier
rapidement qui est certifié sur quoi.
MC-03            Suivi des expirations                 Liste des certificats expirant dans les 90 prochains jours, pour
anticiper les renouvellements.
MC-04            KPI certificats                       Indicateurs : nombre total de certificats de l'équipe,
répartition par domaine, consultants sans aucun certificat,
certificats expirés.

### 4.5 Fonctionnalités transverses
- Page d'accueil adaptée au rôle : solde, dernières demandes et certificats à renouveler pour le
consultant ; demandes en attente et KPI pour le manager.
- Recherche et filtres sur toutes les listes (par type, statut, domaine, consultant, période).
- Contrôle des autorisations : un consultant ne peut jamais accéder aux demandes ou certificats
des autres, ni approuver une demande.
- Messages d'erreur clairs et en français lors des contrôles.

## 5. Architecture et choix techniques

### 5.1 Stack technique
Couche                                   Technologie
Modèle de données                        CDS (Core Data Services) – fichiers .cds dans le dossier db/
Services / API                           SAP CAP Node.js – services OData V4 générés à partir des définitions CDS
(dossier srv/). Deux services distincts : ConsultantService et
ManagerService, protégés par rôle.
Logique métier                           Handlers JavaScript (Node.js) : before/on/after sur les événements CREATE
et UPDATE, actions personnalisées (approuver, rejeter, annuler) et calculs
(validité / expiration des certificats).
Authentification / rôles                 Authentification simulée (mocked users) de CAP en développement, avec
les rôles « consultant » et « manager ».
Base de données                          SQLite en développement local (option : SAP HANA Cloud si un compte BTP
trial est disponible).
Interface utilisateur                    Pages web en HTML, CSS et JavaScript avec le framework Bootstrap 5,
servies depuis le dossier app/ du projet CAP. Les écrans consomment l'API
OData via fetch (JavaScript). Graphiques des KPI avec Chart.js et calendrier
d'équipe avec FullCalendar (bibliothèques JavaScript gratuites).
Outils                                   Visual Studio Code, Node.js LTS, @sap/cds-dk, Git

### 5.2 Modèle de données proposé
Le modèle de données minimal comprend les entités suivantes :

Entité                             Attributs principaux

<!-- Page 6 -->

Employe                      ID, matricule, nom, prénom, email, poste, rôle (Consultant / Manager),
dateEmbauche, soldeConges, manager (association vers Employe)
TypeConge                    code, libellé, déduitDuSolde (booléen), duréeMaxJours
DemandeConge                 ID, consultant (association), typeConge (association), dateDebut, dateFin,
nbJours (calculé), motif, statut (Soumise / Approuvée / Rejetée / Annulée),
commentaireManager, dateDecision, dateCreation
Domaine                      code, libellé (SAP ABAP, SAP CPI, SAP Fiori / UI5, SAP CAP / BTP, Cloud, Autre)
Certificat                   ID, consultant (association), domaine (association), intitulé, organisme,
identifiantCertificat, dateObtention, dateExpiration, score, dateCreation

Les listes de valeurs (statuts, types) seront modélisées avec des entités de codes ou des types
énumérés CDS. Les entités utiliseront les aspects standards CAP (cuid, managed) pour les identifiants
et les champs d'audit (createdAt, modifiedAt). Le manager est lui-même un Employe, ce qui permet
l'auto-association manager → consultants.

## 6. Workflow d'approbation des congés
Le schéma ci-dessous présente le cycle de vie d'une demande de congé, de sa soumission par le
consultant jusqu'à sa décision par le manager :

À la soumission, la demande passe les contrôles automatiques (dates cohérentes, solde suffisant,
absence de chevauchement) puis attend la décision du manager. L'approbation décrémente le solde
du consultant et enregistre la date de décision ; le rejet exige un commentaire et laisse le solde
inchangé. Le consultant peut annuler une demande « Soumise » à tout moment, ou une demande «
Approuvée » tant que la date de début n'est pas passée — le solde est alors recrédité.

## 7. Démarche et planning prévisionnel
Le projet est prévu sur 2 semaines (10 jours ouvrés). Compte tenu de cette durée courte, l'étudiant
devra avoir effectué en amont une mise à niveau rapide sur les bases de JavaScript/Node.js et le
tutoriel officiel CAP « Getting Started » (cap.cloud.sap). Le planning est le suivant :

<!-- Page 7 -->

Période                    Activités
Jour 1                     Installation de l'environnement (Node.js LTS, VS Code, @sap/cds-dk, Git), prise en
main de « cds init » et « cds watch », lecture du cahier des charges.
Jour 2                     Analyse et conception : cas d'utilisation par acteur, maquettes rapides des écrans,
schéma du modèle de données (entités-associations), définition des statuts et
transitions.
Jours 3–4                  Développement du modèle CDS (db/), des deux services OData (srv/) avec rôles et
autorisations, données de test (fichiers CSV), tests des API avec des requêtes .http
et les utilisateurs simulés.
Jours 5–7                  Logique métier : calcul de la durée et du solde, contrôles de validation, actions
d'approbation / rejet / annulation avec transitions de statut, gestion des certificats
(déclaration, calcul de validité / expiration).
Jours 8–9                  Interface web (HTML, CSS, Bootstrap, JavaScript) : espace consultant (listes,
formulaires), espace manager (demandes en attente, actions, KPI avec Chart.js).
Calendrier d'équipe avec FullCalendar (fonctionnalité bonus si le temps le permet).
Jour 10                    Tests de bout en bout sur les deux rôles, corrections, documentation (README,
captures d'écran) et démonstration finale.

Un point d'encadrement quotidien de 15 à 30 minutes est prévu pour lever rapidement les blocages,
indispensable sur un délai aussi court avec un développeur débutant. Priorisation en cas de retard : le
workflow congés (CG + MG-01 à MG-03) est prioritaire ; le calendrier (MG-04) et les KPI avancés (MG-
05) sont des fonctionnalités de second niveau.

## 8. Livrables attendus
- Le code source complet de l'application sur un dépôt Git, avec un fichier README expliquant
l'installation, le lancement et les comptes de test (un consultant, un manager).
- Le schéma du modèle de données (diagramme entités-associations) et le diagramme du
workflow d'approbation.
- Un jeu de données de test (fichiers CSV) : plusieurs consultants, un manager, des demandes de
congés dans différents statuts et des certificats dans plusieurs domaines (dont certains proches
de l'expiration).
- Une courte documentation utilisateur (captures d'écran des parcours consultant et manager).
- Un rapport de projet et une démonstration finale de l'application avec les deux rôles.

## 9. Critères d'acceptation
- Le consultant peut soumettre une demande de congé valide ; elle apparaît au statut « Soumise
» dans la liste du manager.
- Une demande invalide (dates incohérentes, solde insuffisant, chevauchement) est rejetée à la
saisie avec un message d'erreur explicite.
- Le manager peut approuver une demande (le solde du consultant est décrémenté) ou la rejeter
avec commentaire (le solde est inchangé).
- Le consultant voit le nouveau statut et le commentaire du manager sur sa demande.

<!-- Page 8 -->

- L'annulation d'une demande approuvée non commencée recrédite correctement le solde.
- Le consultant peut ajouter, modifier et supprimer ses certificats ; le manager les visualise avec
les filtres par domaine et la mise en évidence des expirations.
- Le tableau de bord manager affiche au minimum : nombre de demandes en attente, absences
en cours, jours consommés par consultant.
- Un utilisateur avec le rôle consultant ne peut ni voir les demandes des autres, ni exécuter les
actions d'approbation (contrôle serveur).
- L'application se lance localement avec la commande « cds watch » sans erreur.

## 10. Glossaire
Terme                          Définition
SAP CAP                        Cloud Application Programming Model : framework de SAP pour développer
des services et applications d'entreprise (Node.js ou Java).
CDS                            Core Data Services : langage déclaratif pour définir le modèle de données et
les services.
OData                          Protocole standard basé sur HTTP/REST pour exposer et consommer des
données (API).
Bootstrap                      Framework CSS/JavaScript open source qui fournit des composants
d'interface prêts à l'emploi (tableaux, formulaires, boutons, badges,
navigation).
Certificat                     Certification professionnelle obtenue par un consultant dans un domaine
technologique (ex. SAP ABAP, SAP CPI), avec une date d’obtention et
éventuellement une date d’expiration.
KPI                            Key Performance Indicator : indicateur chiffré de suivi (ex. nombre de
demandes en attente).
Workflow                       Enchaînement des étapes et statuts d'une demande, de sa soumission à sa
décision.
SAP BTP                        Business Technology Platform : plateforme cloud de SAP sur laquelle les
applications CAP peuvent être déployées.
ESN                            Entreprise de Services du Numérique.

<!-- Page 9 -->

