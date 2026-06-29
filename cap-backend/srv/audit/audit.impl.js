'use strict';

/**
 * Audit domain handler.
 *
 * Responsibilities:
 *   1. Enforce the AUDIT_READ policy (ADMIN-only) before any READ on AuditLogs.
 *   2. Mask sensitive keys (password, token, authorization, secret) found
 *      anywhere in the JSON `details` blob before returning rows to clients.
 *
 * Auto-wired by srv/base-service.js because `module.exports.primaryEntity`
 * matches a CoreService projection.
 */

require('./audit.policy');
const policies = require('../_shared/security/policies');
const { Actions } = require('../_shared/security/actions');
const { getRequestContext } = require('../_shared/auth/request-context');
const { maskSensitive, maskJsonString } = require('../_shared/security/mask-sensitive');

// Read-side mask: rows persisted before write-time masking was in place may
// still contain sensitive values, so we scrub on the way out too.
const maskDetailsString = maskJsonString;

module.exports = (srv) => {
  const requirePermission = async (req) => {
    const ctx = getRequestContext(req);
    try {
      await policies.require(ctx, Actions.AUDIT_READ);
    } catch (err) {
      if (err?.statusCode === 403 || err?.status === 403 || err?.code === 403) {
        return req.reject(403, err.message || 'Forbidden: AuditLogs are restricted to ADMIN');
      }
      throw err;
    }
  };

  srv.before('READ', 'AuditLogs', requirePermission);

  srv.after('READ', 'AuditLogs', (data) => {
    if (!data) return data;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      if (row && typeof row === 'object' && 'details' in row) {
        row.details = maskDetailsString(row.details);
      }
    }
    return data;
  });
};

module.exports.primaryEntity = 'AuditLogs';

// Exported for unit tests.
module.exports.maskSensitive = maskSensitive;
module.exports.maskDetailsString = maskDetailsString;
