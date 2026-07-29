using { sap.performance.dashboard.db as db } from '../../db/gestion-conges-certificats';

@path: '/odata/v4/manager'
@impl: 'srv/gestion/manager.impl'
service ManagerService {
  @readonly entity Consultants as projection on db.Employes;
  entity DemandesCongeEquipe as projection on db.DemandesConge;
  @readonly entity CertificatsEquipe as projection on db.Certificats;
  @readonly entity TypesConge as projection on db.TypesConge;
  @readonly entity DomainesCertificat as projection on db.DomainesCertificat;

  type KPIConge {
    demandesEnAttente : Integer;
    absencesEnCours   : Integer;
    joursApprouves    : Integer;
    tauxApprobation   : Decimal(5,2);
    totalCertificats   : Integer;
    certificatsExpires : Integer;
    certificatsA90Jours: Integer;
    consultantsSansCertificat : Integer;
  }

  action approuverDemande(demandeId: String, commentaire: String) returns DemandesCongeEquipe;
  action rejeterDemande(demandeId: String, commentaire: String) returns DemandesCongeEquipe;
  function kpiConges() returns KPIConge;
}
