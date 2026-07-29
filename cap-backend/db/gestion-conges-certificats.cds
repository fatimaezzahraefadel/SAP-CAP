namespace sap.performance.dashboard.db;

using { cuid, managed } from '@sap/cds/common';

type RoleCongesCertificats : String(20) enum {
  CONSULTANT;
  MANAGER;
}

type StatutDemandeConge : String(20) enum {
  SOUMISE;
  APPROUVEE;
  REJETEE;
  ANNULEE;
}

entity Employes : cuid, managed {
  matricule    : String(30)  not null;
  nom          : String(80)  not null;
  prenom       : String(80)  not null;
  email        : String(150) not null;
  poste        : String(100);
  role         : RoleCongesCertificats not null;
  dateEmbauche : Date;
  soldeConges  : Integer default 22;
  manager      : Association to Employes;
  demandes     : Composition of many DemandesConge on demandes.consultant = $self;
  certificats  : Composition of many Certificats on certificats.consultant = $self;
}

entity TypesConge : cuid, managed {
  code          : String(30) not null;
  libelle       : String(100) not null;
  deduitDuSolde : Boolean default true;
  dureeMaxJours : Integer;
  actif         : Boolean default true;
}

entity DemandesConge : cuid, managed {
  consultant         : Association to Employes not null;
  typeConge          : Association to TypesConge not null;
  dateDebut          : Date not null;
  dateFin            : Date not null;
  nbJours            : Integer default 0;
  motif              : String(500);
  statut             : StatutDemandeConge default 'SOUMISE';
  commentaireManager : String(500);
  dateDecision       : DateTime;
}

entity DomainesCertificat : cuid, managed {
  code    : String(30) not null;
  libelle : String(100) not null;
  actif   : Boolean default true;
}

entity Certificats : cuid, managed {
  consultant            : Association to Employes not null;
  domaine               : Association to DomainesCertificat not null;
  intitule              : String(200) not null;
  organisme             : String(150);
  identifiantCertificat : String(120);
  dateObtention         : Date not null;
  dateExpiration        : Date;
  score                 : String(50);
}
