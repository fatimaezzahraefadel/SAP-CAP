'use strict';

const fs = require('node:fs');
const path = require('node:path');
const cds = require('@sap/cds');
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

    // CAP performs internal, nested requests within the scope of an already
    // authenticated inbound request — most notably the "reselect" READ it runs
    // after a write to build the 201 response body. These nested requests do
    // not carry the Authorization header (only the top-level HTTP request does,
    // exposed as `req._.req`). Re-authenticating them fails with 401, which
    // makes CAP silently fall back to `204 No Content` on CREATE/UPDATE, so the
    // client never receives the persisted entity (and its server-generated ID).
    // Inherit the root request's claims for nested requests instead. For inbound
    // HTTP requests, authenticate and enrich claims with the local DB user id
    // when available.
    const isInboundHttpRequest = Boolean(req._?.req);
    if (!isInboundHttpRequest) {
      req._authClaims = cds.context?._authClaims ?? req._authClaims ?? null;
      return;
    }

    const claims = auth.authenticateRequest(req);
    // Attach claims synchronously BEFORE any async enrichment so that
    // downstream before-handlers (authz, read-scoping) always observe the
    // authenticated principal. Enriching dbUserId via an awaited DB lookup
    // first would leave a gap where handlers fall back to the mocked user.
    req._authClaims = claims;
    if (claims && claims.role) {
      try {
        const authUser = await auth.currentUser(req);
        if (authUser && authUser.id) claims.dbUserId = authUser.id;
      } catch (e) {
        // Ignore if user cannot be fetched (e.g. invalid role)
      }
    }
    // Expose the claims on the shared request context so nested requests
    // (which never re-authenticate) can inherit them above.
    if (cds.context) cds.context._authClaims = req._authClaims;
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
