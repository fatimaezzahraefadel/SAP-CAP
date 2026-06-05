'use strict';

/**
 * Audit-log permission policy.
 * Spec (backend architecture plan):
 *   - Reading audit logs is restricted to ADMIN only.
 *   - Sensitive fields inside `details` (password, token, authorization, secret)
 *     must be masked before being returned to any client.
 *
 * Writes are produced by srv/shared/services/audit.js as `after('CREATE'|...)`
 * side-effects, never as direct OData mutations, so the entity is exposed
 * read-only in the CDS service. We therefore only need a policy for AUDIT_READ.
 */

const policies = require('../_shared/security/policies');
const { Actions } = require('../_shared/security/actions');
const { Roles } = require('../_shared/security/roles');

function canReadAudit(ctx) {
  return ctx?.role === Roles.ADMIN;
}

policies.register(Actions.AUDIT_READ, canReadAudit);

module.exports = {
  canReadAudit,
};
