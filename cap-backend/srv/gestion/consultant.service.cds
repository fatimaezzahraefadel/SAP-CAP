using { sap.performance.dashboard.db as db } from '../../db/gestion-conges-certificats';

@path: '/odata/v4/consultant'
@impl: 'srv/gestion/consultant.impl'
service ConsultantService {
  @readonly entity MonProfil as projection on db.Employes;
  @readonly entity TypesConge as projection on db.TypesConge;
  @readonly entity DomainesCertificat as projection on db.DomainesCertificat;

  entity MesDemandesConge as projection on db.DemandesConge;
  entity MesCertificats as projection on db.Certificats;

  action annulerDemande(demandeId: String) returns MesDemandesConge;
  action supprimerCertificat(certificatId: String) returns Boolean;
}
