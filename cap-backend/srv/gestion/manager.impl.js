'use strict';

const cds = require('@sap/cds');

const ensureManager = async (req, tx) => {
  const email = req.user?.attr?.email || req.headers['x-test-user-email'];
  const userId = req.user?.id || req.headers['x-test-user-id'];
  const requestedRole = req.headers['x-test-user-role'];
  const { Employes } = cds.entities('sap.performance.dashboard.db');

  let employe = email && await tx.run(SELECT.one.from(Employes).where({ email }));
  if (!employe && userId) employe = await tx.run(SELECT.one.from(Employes).where({ ID: userId }));
  if (!employe) employe = await tx.run(SELECT.one.from(Employes).where({ role: 'MANAGER' }));
  if (!employe) req.reject(403, 'Aucun manager de test ne correspond a cet utilisateur.');
  if (requestedRole && requestedRole !== 'MANAGER') req.reject(403, 'Acces reserve au role manager.');
  if (employe.role !== 'MANAGER') req.reject(403, 'Acces reserve au role manager.');
  return employe;
};

const daysUntil = (date) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / (24 * 60 * 60 * 1000));

module.exports = cds.service.impl(function () {
  this.before(['READ', 'CREATE', 'UPDATE', 'DELETE'], '*', async (req) => {
    await ensureManager(req, cds.transaction(req));
  });

  this.before('READ', 'Consultants', (req) => {
    if (req.query?.SELECT) req.query.where({ role: 'CONSULTANT' });
  });

  this.on('approuverDemande', async (req) => {
    const tx = cds.transaction(req);
    await ensureManager(req, tx);
    const { DemandesConge, Employes, TypesConge, Notifications, Users } = cds.entities('sap.performance.dashboard.db');
    const demande = await tx.run(SELECT.one.from(DemandesConge).where({ ID: req.data.demandeId }));
    if (!demande) req.reject(404, 'Demande de conge introuvable.');
    if (demande.statut !== 'SOUMISE') req.reject(400, 'Seules les demandes soumises peuvent etre approuvees.');

    const type = await tx.run(SELECT.one.from(TypesConge).where({ ID: demande.typeConge_ID }));
    if (type?.deduitDuSolde) {
      const consultant = await tx.run(SELECT.one.from(Employes).where({ ID: demande.consultant_ID }));
      if (consultant.soldeConges < demande.nbJours) req.reject(400, 'Solde de conges insuffisant.');
      await tx.run(UPDATE(Employes).set({ soldeConges: Number(consultant.soldeConges || 0) - Number(demande.nbJours || 0) }).where({ ID: demande.consultant_ID }));
    }

    await tx.run(UPDATE(DemandesConge).set({
      statut: 'APPROUVEE',
      commentaireManager: req.data.commentaire,
      dateDecision: new Date().toISOString(),
    }).where({ ID: demande.ID }));

    // Notifier le consultant
    const employe = await tx.run(SELECT.one.from(Employes).where({ ID: demande.consultant_ID }));
    let notificationUserId = demande.consultant_ID;
    if (employe) {
      const user = await tx.run(SELECT.one.from(Users).where({ email: employe.email }))
        || await tx.run(SELECT.one.from(Users).where({ ID: employe.ID }))
        || await tx.run(SELECT.one.from(Users).where({ ID: demande.consultant_ID }));
      if (user) notificationUserId = user.ID;
    }

    try {
      const dateDebutStr = demande.dateDebut ? new Date(demande.dateDebut).toLocaleDateString('fr-FR') : demande.dateDebut;
      const dateFinStr = demande.dateFin ? new Date(demande.dateFin).toLocaleDateString('fr-FR') : demande.dateFin;
      await tx.run(INSERT.into(Notifications).entries({
        userId: notificationUserId,
        type: 'LEAVE_DECISION',
        title: '✅ Demande de congé approuvée',
        message: `Votre demande de congé du ${dateDebutStr} au ${dateFinStr} a été approuvée.${req.data.commentaire ? ` Commentaire : ${req.data.commentaire}` : ''}`,
        targetPath: '/consultant-tech/leave',
        read: false,
      }));
    } catch (e) {
      console.warn('Could not create notification for leave approval:', e.message);
    }

    return tx.run(SELECT.one.from(DemandesConge).where({ ID: demande.ID }));
  });

  this.on('rejeterDemande', async (req) => {
    const commentaire = req.data.commentaire?.trim();
    if (!commentaire) req.reject(400, 'Le commentaire est obligatoire pour rejeter une demande.');

    const tx = cds.transaction(req);
    await ensureManager(req, tx);
    const { DemandesConge, Employes, Notifications, Users } = cds.entities('sap.performance.dashboard.db');
    const demande = await tx.run(SELECT.one.from(DemandesConge).where({ ID: req.data.demandeId }));
    if (!demande) req.reject(404, 'Demande de conge introuvable.');
    if (demande.statut !== 'SOUMISE') req.reject(400, 'Seules les demandes soumises peuvent etre rejetees.');

    await tx.run(UPDATE(DemandesConge).set({
      statut: 'REJETEE',
      commentaireManager: commentaire,
      dateDecision: new Date().toISOString(),
    }).where({ ID: demande.ID }));

    // Notifier le consultant
    const employe = await tx.run(SELECT.one.from(Employes).where({ ID: demande.consultant_ID }));
    let notificationUserId = demande.consultant_ID;
    if (employe) {
      const user = await tx.run(SELECT.one.from(Users).where({ email: employe.email }))
        || await tx.run(SELECT.one.from(Users).where({ ID: employe.ID }))
        || await tx.run(SELECT.one.from(Users).where({ ID: demande.consultant_ID }));
      if (user) notificationUserId = user.ID;
    }

    try {
      const dateDebutStr = demande.dateDebut ? new Date(demande.dateDebut).toLocaleDateString('fr-FR') : demande.dateDebut;
      const dateFinStr = demande.dateFin ? new Date(demande.dateFin).toLocaleDateString('fr-FR') : demande.dateFin;
      await tx.run(INSERT.into(Notifications).entries({
        userId: notificationUserId,
        type: 'LEAVE_DECISION',
        title: '❌ Demande de congé rejetée',
        message: `Votre demande de congé du ${dateDebutStr} au ${dateFinStr} a été rejetée. Motif : ${commentaire}`,
        targetPath: '/consultant-tech/leave',
        read: false,
      }));
    } catch (e) {
      console.warn('Could not create notification for leave rejection:', e.message);
    }

    return tx.run(SELECT.one.from(DemandesConge).where({ ID: demande.ID }));
  });

  this.on('kpiConges', async (req) => {
    const tx = cds.transaction(req);
    await ensureManager(req, tx);
    const { DemandesConge, Certificats, Employes } = cds.entities('sap.performance.dashboard.db');
    const demandes = await tx.run(SELECT.from(DemandesConge));
    const certificats = await tx.run(SELECT.from(Certificats));
    const consultants = await tx.run(SELECT.from(Employes).where({ role: 'CONSULTANT' }));
    const totalDecidees = demandes.filter((item) => item.statut === 'APPROUVEE' || item.statut === 'REJETEE').length;
    const approuvees = demandes.filter((item) => item.statut === 'APPROUVEE');
    const today = new Date().toISOString().slice(0, 10);
    const consultantsAvecCertificat = new Set(certificats.map((item) => item.consultant_ID));

    return {
      demandesEnAttente: demandes.filter((item) => item.statut === 'SOUMISE').length,
      absencesEnCours: approuvees.filter((item) => item.dateDebut <= today && item.dateFin >= today).length,
      joursApprouves: approuvees.reduce((sum, item) => sum + Number(item.nbJours || 0), 0),
      tauxApprobation: totalDecidees ? (approuvees.length / totalDecidees) * 100 : 0,
      totalCertificats: certificats.length,
      certificatsExpires: certificats.filter((item) => item.dateExpiration && item.dateExpiration < today).length,
      certificatsA90Jours: certificats.filter((item) => {
        if (!item.dateExpiration) return false;
        const delta = daysUntil(item.dateExpiration);
        return delta >= 0 && delta <= 90;
      }).length,
      consultantsSansCertificat: consultants.filter((item) => !consultantsAvecCertificat.has(item.ID)).length,
    };
  });
});
