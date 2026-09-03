'use strict';

const cds = require('@sap/cds');
const { countWorkingDays, isoDate, todayIso } = require('./gestion.util');

const getEmployeeForRequest = async (req, tx) => {
  const email = req.user?.attr?.email || req.headers['x-test-user-email'];
  const userId = req.user?.id || req.headers['x-test-user-id'];
  const { Employes } = cds.entities('sap.performance.dashboard.db');

  let employe = email && await tx.run(SELECT.one.from(Employes).where({ email }));
  if (!employe && userId) employe = await tx.run(SELECT.one.from(Employes).where({ matricule: userId }));
  if (!employe && userId) employe = await tx.run(SELECT.one.from(Employes).where({ ID: userId }));
  if (!employe) employe = await tx.run(SELECT.one.from(Employes).where({ role: 'CONSULTANT' }));

  // Si pas trouvé dans Employes, créer un employé virtuel depuis Users
  if (!employe && userId) {
    const { Users } = cds.entities('sap.performance.dashboard.db');
    const user = await tx.run(SELECT.one.from(Users).where({ ID: userId }));
    if (user && user.role === 'CONSULTANT_TECHNIQUE') {
      // Insérer l'employé manquant
      const newEmploye = {
        ID: userId,
        matricule: userId.toUpperCase(),
        nom: user.name?.split(' ').slice(1).join(' ') || user.name,
        prenom: user.name?.split(' ')[0] || user.name,
        email: user.email,
        poste: 'Consultant Technique SAP',
        role: 'CONSULTANT',
        dateEmbauche: '2024-01-01',
        soldeConges: 18,
        manager_ID: 'mgr-001',
      };
      await tx.run(INSERT.into(Employes).entries(newEmploye));
      employe = newEmploye;
    }
  }

  if (!employe) req.reject(403, 'Aucun consultant de test ne correspond a cet utilisateur.');
  if (!['CONSULTANT', 'CONSULTANT_TECHNIQUE'].includes(employe.role)) {
    req.reject(403, 'Acces reserve au role consultant.');
  }
  return employe;
};

const addOwnFilter = async (req) => {
  if (!req.query?.SELECT) return;
  const tx = cds.transaction(req);
  const employe = await getEmployeeForRequest(req, tx);
  const entity = req.target?.name?.split('.').pop();
  req.query.where(entity === 'MonProfil' ? { ID: employe.ID } : { consultant_ID: employe.ID });
};

const validateLeaveRequest = async (req, tx, employe) => {
  const { DemandesConge, TypesConge } = cds.entities('sap.performance.dashboard.db');
  const data = req.data;

  if (data.dateFin < data.dateDebut) {
    req.reject(400, 'La date de fin doit etre superieure ou egale a la date de debut.');
  }

  data.consultant_ID = employe.ID;
  data.statut = data.statut || 'SOUMISE';
  data.nbJours = countWorkingDays(data.dateDebut, data.dateFin);

  const type = await tx.run(SELECT.one.from(TypesConge).where({ ID: data.typeConge_ID }));
  if (!type) req.reject(400, 'Type de conge introuvable.');
  if (type.deduitDuSolde && data.nbJours > employe.soldeConges) {
    req.reject(400, 'Solde de conges insuffisant pour cette demande.');
  }

  const overlapQuery = SELECT.from(DemandesConge).where`
      consultant_ID = ${employe.ID}
      and statut not in ('REJETEE', 'ANNULEE')
      and dateDebut <= ${data.dateFin}
      and dateFin >= ${data.dateDebut}
    `;
  const overlaps = (await tx.run(overlapQuery)).filter((item) => item.ID !== data.ID);

  if (overlaps.length) {
    req.reject(400, 'Cette demande chevauche une autre demande existante.');
  }
};

module.exports = cds.service.impl(function () {
  this.before('READ', 'MonProfil', addOwnFilter);
  this.before('READ', 'MesDemandesConge', addOwnFilter);
  this.before('READ', 'MesCertificats', addOwnFilter);

  this.before('CREATE', 'MesDemandesConge', async (req) => {
    const tx = cds.transaction(req);
    const employe = await getEmployeeForRequest(req, tx);
    await validateLeaveRequest(req, tx, employe);
  });

  this.before('UPDATE', 'MesDemandesConge', async (req) => {
    const tx = cds.transaction(req);
    const { DemandesConge } = cds.entities('sap.performance.dashboard.db');
    const employe = await getEmployeeForRequest(req, tx);
    const existing = await tx.run(SELECT.one.from(DemandesConge).where({ ID: req.data.ID, consultant_ID: employe.ID }));
    if (!existing) req.reject(404, 'Demande de conge introuvable.');
    if (existing.statut !== 'SOUMISE') req.reject(400, 'Seules les demandes soumises peuvent etre modifiees.');
    await validateLeaveRequest(req, tx, employe);
  });

  this.before('DELETE', 'MesDemandesConge', async (req) => {
    req.reject(405, 'Utilisez l action annulerDemande pour annuler une demande de conge.');
  });

  this.before('CREATE', 'MesCertificats', async (req) => {
    const tx = cds.transaction(req);
    const employe = await getEmployeeForRequest(req, tx);
    req.data.consultant_ID = employe.ID;
  });

  this.before('UPDATE', 'MesCertificats', async (req) => {
    const tx = cds.transaction(req);
    const { Certificats } = cds.entities('sap.performance.dashboard.db');
    const employe = await getEmployeeForRequest(req, tx);
    const existing = await tx.run(SELECT.one.from(Certificats).where({ ID: req.data.ID, consultant_ID: employe.ID }));
    if (!existing) req.reject(404, 'Certificat introuvable.');
    req.data.consultant_ID = employe.ID;
  });

  this.before('DELETE', 'MesCertificats', async (req) => {
    const tx = cds.transaction(req);
    const { Certificats } = cds.entities('sap.performance.dashboard.db');
    const employe = await getEmployeeForRequest(req, tx);
    const key = req.data.ID || req.params?.[0]?.ID;
    const existing = key && await tx.run(SELECT.one.from(Certificats).where({ ID: key, consultant_ID: employe.ID }));
    if (!existing) req.reject(404, 'Certificat introuvable.');
  });

  this.on('annulerDemande', async (req) => {
    const tx = cds.transaction(req);
    const { DemandesConge, Employes } = cds.entities('sap.performance.dashboard.db');
    const employe = await getEmployeeForRequest(req, tx);
    const demande = await tx.run(SELECT.one.from(DemandesConge).where({ ID: req.data.demandeId, consultant_ID: employe.ID }));
    if (!demande) req.reject(404, 'Demande de conge introuvable.');
    if (demande.statut === 'REJETEE' || demande.statut === 'ANNULEE') req.reject(400, 'Cette demande ne peut plus etre annulee.');
    if (demande.statut === 'APPROUVEE' && demande.dateDebut <= todayIso()) req.reject(400, 'Une demande approuvee deja commencee ne peut pas etre annulee.');

    if (demande.statut === 'APPROUVEE') {
      await tx.run(UPDATE(Employes).set({ soldeConges: Number(employe.soldeConges || 0) + Number(demande.nbJours || 0) }).where({ ID: employe.ID }));
    }

    await tx.run(UPDATE(DemandesConge).set({ statut: 'ANNULEE' }).where({ ID: demande.ID }));
    return tx.run(SELECT.one.from(DemandesConge).where({ ID: demande.ID }));
  });

  this.on('supprimerCertificat', async (req) => {
    const tx = cds.transaction(req);
    const { Certificats } = cds.entities('sap.performance.dashboard.db');
    const employe = await getEmployeeForRequest(req, tx);
    const certificat = await tx.run(SELECT.one.from(Certificats).where({ ID: req.data.certificatId, consultant_ID: employe.ID }));
    if (!certificat) req.reject(404, 'Certificat introuvable.');
    await tx.run(DELETE.from(Certificats).where({ ID: certificat.ID }));
    return true;
  });
});
