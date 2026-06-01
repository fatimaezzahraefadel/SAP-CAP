'use strict';

const cds = require('@sap/cds');
const cron = require('node-cron');
const DocumentationDomainService = require('./documentation.domain.service');

const scheduleSpec = process.env.CLEANUP_CRON || '0 2 * * *'; // default: 02:00 daily

function registerCleanupJob() {
  // Schedule the job only once the CDS runtime is ready
  cron.schedule(scheduleSpec, async () => {
    try {
      const domain = new DocumentationDomainService();
      const mockReq = { _authClaims: { role: 'ADMIN', sub: 'system' } };
      const deleted = await domain.cleanupOrphanAttachments(mockReq);
      console.info(`[cleanup-job] removed ${deleted} orphan DocAttachedFiles`);
    } catch (err) {
      console.error('[cleanup-job] failed to run cleanupOrphanAttachments', err);
    }
  }, { scheduled: true });
}

module.exports = { registerCleanupJob };
