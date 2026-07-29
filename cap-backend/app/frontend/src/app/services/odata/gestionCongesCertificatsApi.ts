import { createEntity, odataFetch, updateEntity, type ODataResponse } from './core';

export type StatutDemandeConge = 'SOUMISE' | 'APPROUVEE' | 'REJETEE' | 'ANNULEE';

export interface EmployeGcc {
  ID: string;
  matricule: string;
  nom: string;
  prenom: string;
  email: string;
  poste?: string;
  role: 'CONSULTANT' | 'MANAGER';
  soldeConges: number;
}

export interface TypeConge {
  ID: string;
  code: string;
  libelle: string;
  deduitDuSolde: boolean;
}

export interface DomaineCertificat {
  ID: string;
  code: string;
  libelle: string;
}

export interface DemandeConge {
  ID: string;
  consultant_ID: string;
  typeConge_ID: string;
  dateDebut: string;
  dateFin: string;
  nbJours: number;
  motif?: string;
  statut: StatutDemandeConge;
  commentaireManager?: string;
  dateDecision?: string;
}

export interface CreateDemandeCongeInput {
  typeConge_ID: string;
  dateDebut: string;
  dateFin: string;
  motif?: string;
}

export interface CertificatGcc {
  ID: string;
  consultant_ID: string;
  domaine_ID: string;
  intitule: string;
  organisme?: string;
  identifiantCertificat?: string;
  dateObtention: string;
  dateExpiration?: string;
  score?: string;
}

export interface CreateCertificatInput {
  domaine_ID: string;
  intitule: string;
  organisme?: string;
  identifiantCertificat?: string;
  dateObtention: string;
  dateExpiration?: string;
  score?: string;
}

export interface KPIConge {
  demandesEnAttente: number;
  absencesEnCours: number;
  joursApprouves: number;
  tauxApprobation: number;
  totalCertificats: number;
  certificatsExpires: number;
  certificatsA90Jours: number;
  consultantsSansCertificat: number;
}

const list = async <T>(service: 'consultant' | 'manager', entity: string): Promise<T[]> => {
  const data = await odataFetch<ODataResponse<T>>(service, `/${entity}`);
  return data?.value ?? [];
};

const postAction = async <T>(
  service: 'consultant' | 'manager',
  action: string,
  body: Record<string, unknown>
): Promise<T> => {
  const data = await odataFetch<T>(service, `/${action}`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data as T;
};

export const GestionCongesCertificatsAPI = {
  consultant: {
    profil: () => list<EmployeGcc>('consultant', 'MonProfil'),
    typesConge: () => list<TypeConge>('consultant', 'TypesConge'),
    domaines: () => list<DomaineCertificat>('consultant', 'DomainesCertificat'),
    demandes: () => list<DemandeConge>('consultant', 'MesDemandesConge'),
    certificats: () => list<CertificatGcc>('consultant', 'MesCertificats'),
    creerDemande: (payload: CreateDemandeCongeInput) =>
      createEntity<DemandeConge>('consultant', 'MesDemandesConge', payload),
    creerCertificat: (payload: CreateCertificatInput) =>
      createEntity<CertificatGcc>('consultant', 'MesCertificats', payload),
    modifierDemande: (id: string, payload: CreateDemandeCongeInput) =>
      updateEntity<DemandeConge>('consultant', 'MesDemandesConge', id, payload),
    modifierCertificat: (id: string, payload: CreateCertificatInput) =>
      updateEntity<CertificatGcc>('consultant', 'MesCertificats', id, payload),
    supprimerCertificat: (certificatId: string) =>
      postAction<boolean>('consultant', 'supprimerCertificat', { certificatId }),
    annulerDemande: (demandeId: string) =>
      postAction<DemandeConge>('consultant', 'annulerDemande', { demandeId }),
  },
  manager: {
    consultants: () => list<EmployeGcc>('manager', 'Consultants'),
    typesConge: () => list<TypeConge>('manager', 'TypesConge'),
    domaines: () => list<DomaineCertificat>('manager', 'DomainesCertificat'),
    demandes: () => list<DemandeConge>('manager', 'DemandesCongeEquipe'),
    certificats: () => list<CertificatGcc>('manager', 'CertificatsEquipe'),
    kpiConges: () => odataFetch<KPIConge>('manager', '/kpiConges()') as Promise<KPIConge>,
    approuverDemande: (demandeId: string, commentaire = '') =>
      postAction<DemandeConge>('manager', 'approuverDemande', { demandeId, commentaire }),
    rejeterDemande: (demandeId: string, commentaire: string) =>
      postAction<DemandeConge>('manager', 'rejeterDemande', { demandeId, commentaire }),
  },
};
