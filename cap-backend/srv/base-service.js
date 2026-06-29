'use strict';

const fs = require('node:fs');
const path = require('node:path');
const AuthDomainService = require('./auth/auth.domain.service');
const { attachAuditLog } = require('./shared/services/audit');

const registerDomainImpls = (srv) => {
  const entries = fs.readdirSync(__dirname, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === 'shared') continue;
    const implPath = path.join(__dirname, entry.name, `${entry.name}.impl.js`);
    if (!fs.existsSync(implPath)) continue;

    const register = require(implPath);
    const primaryEntity = register.primaryEntity;

    // Skip if the service does not expose the primary entity this domain handles
    if (primaryEntity && !srv.entities[primaryEntity]) continue;

    if (typeof register === 'function') register(srv);
  }
};

module.exports = function (srv) {
  const auth = new AuthDomainService(srv);

  srv.before('*', async (req) => {
    if (auth.isPublicEvent(req.event)) return;
    const claims = auth.authenticateRequest(req);
    if (claims && claims.role) {
      try {
        const authUser = await auth.currentUser(req);
        claims.dbUserId = authUser.id;
      } catch (e) {
        // Ignore if user cannot be fetched (e.g. invalid role)
      }
    }
    req._authClaims = claims;
  });

  // Enforce server-side pagination: cap $top at 500, default to 100 if omitted
  const MAX_PAGE_SIZE = 500;
  const DEFAULT_PAGE_SIZE = 100;
  srv.before('READ', '*', (req) => {
    const select = req.query?.SELECT;
    if (!select) return;
    const limit = select.limit ?? {};
    const rows = limit.rows?.val;
    if (rows === undefined || rows === null) {
      select.limit = { ...limit, rows: { val: DEFAULT_PAGE_SIZE } };
    } else if (typeof rows === 'number' && rows > MAX_PAGE_SIZE) {
      select.limit = { ...limit, rows: { val: MAX_PAGE_SIZE } };
    }
  });

  // Global 404 handler for single-entity reads
  srv.after('READ', '*', (data, req) => {
    const isSingleRead = req.query.SELECT?.one || (req.params?.length > 0 && !Array.isArray(data));
    if (isSingleRead && (data === null || data === undefined)) {
      req.error(404, 'Entity not found');
    }
  });

  registerDomainImpls(srv);

  // Audit trail – logs every CREATE / UPDATE / DELETE
  attachAuditLog(srv);
};
