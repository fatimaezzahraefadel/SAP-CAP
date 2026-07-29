'use strict';

const cds = require('@sap/cds');

module.exports = cds.service.impl(function () {
  this.before('READ', 'Consultants', (req) => {
    if (req.query?.SELECT) req.query.where({ role: 'CONSULTANT' });
  });

  this.on('approuverDemande', async (req) => {
    const tx = cds.transaction(req);
    const { DemandesConge, Employes, TypesConge } = cds.entities('sap.performance.dashboard.db');
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

    return tx.run(SELECT.one.from(DemandesConge).where({ ID: demande.ID }));
  });

  this.on('rejeterDemande', async (req) => {
    const commentaire = req.data.commentaire?.trim();
    if (!commentaire) req.reject(400, 'Le commentaire est obligatoire pour rejeter une demande.');

    const tx = cds.transaction(req);
    const { DemandesConge } = cds.entities('sap.performance.dashboard.db');
    const demande = await tx.run(SELECT.one.from(DemandesConge).where({ ID: req.data.demandeId }));
    if (!demande) req.reject(404, 'Demande de conge introuvable.');
    if (demande.statut !== 'SOUMISE') req.reject(400, 'Seules les demandes soumises peuvent etre rejetees.');

    await tx.run(UPDATE(DemandesConge).set({
      statut: 'REJETEE',
      commentaireManager: commentaire,
      dateDecision: new Date().toISOString(),
    }).where({ ID: demande.ID }));

    return tx.run(SELECT.one.from(DemandesConge).where({ ID: demande.ID }));
  });

  this.on('kpiConges', async (req) => {
    const tx = cds.transaction(req);
    const { DemandesConge } = cds.entities('sap.performance.dashboard.db');
    const demandes = await tx.run(SELECT.from(DemandesConge));
    const totalDecidees = demandes.filter((item) => item.statut === 'APPROUVEE' || item.statut === 'REJETEE').length;
    const approuvees = demandes.filter((item) => item.statut === 'APPROUVEE');
    const today = new Date().toISOString().slice(0, 10);

    return {
      demandesEnAttente: demandes.filter((item) => item.statut === 'SOUMISE').length,
      absencesEnCours: approuvees.filter((item) => item.dateDebut <= today && item.dateFin >= today).length,
      joursApprouves: approuvees.reduce((sum, item) => sum + Number(item.nbJours || 0), 0),
      tauxApprobation: totalDecidees ? (approuvees.length / totalDecidees) * 100 : 0,
    };
  });
});
