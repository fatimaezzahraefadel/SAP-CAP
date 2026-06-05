'use strict';
/**
 * audit.js – Lightweight audit logger.
 * Writes an immutable AuditLogs row for every CUD event AND every custom
 * action (e.g. approveTicket, uploadAttachment) that flows through a CAP
 * service registered via `attachAuditLog(srv)`.
 *
 * Read events and a small allowlist of public/read-style actions are skipped
 * to keep the log signal high.
 */

const cds = require('@sap/cds');

const fs = require('fs').promises;
const path = require('path');
const { maskSensitive } = require('../../_shared/security/mask-sensitive');
const { getRequestContext } = require('../../_shared/auth/request-context');

const AUDIT_ENTITY = 'sap.performance.dashboard.db.AuditLogs';
const SQLITE_AUDIT_TABLE = 'sap_performance_dashboard_db_AuditLogs';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const CUD_EVENTS = new Set(['CREATE', 'UPDATE', 'DELETE']);

// Events that are read-style or public and would only add noise to the audit:
//   - READ            : every list / detail GET, far too frequent
//   - authenticate    : login attempt, already logged by the auth service itself
//   - listAttachments / downloadAttachment : read-style, no state change
//   - cleanupOrphanAttachments / purgeDeletedAttachments / cleanupDuplicateAttachments / reconcileStorage :
//     scheduled maintenance jobs — they have their own logging
const AUDIT_SKIPPED_EVENTS = new Set([
  'READ',
  'authenticate',
  'listAttachments',
  'downloadAttachment',
  'cleanupOrphanAttachments',
  'purgeDeletedAttachments',
  'cleanupDuplicateAttachments',
  'reconcileStorage',
]);

let auditTableReady;

const ensureAuditTable = async () => {
  if (auditTableReady) return auditTableReady;

  auditTableReady = (async () => {
    if (!cds.db?.run) return;

    const dbKind = String(cds.db.kind ?? cds.db.options?.kind ?? '').toLowerCase();
    if (dbKind && dbKind !== 'sqlite') return;

    await cds.db.run(`
      CREATE TABLE IF NOT EXISTS ${SQLITE_AUDIT_TABLE} (
        ID NVARCHAR(36) PRIMARY KEY,
        timestamp TEXT NOT NULL,
        userId NVARCHAR(50),
        userRole NVARCHAR(40),
        "action" NVARCHAR(60) NOT NULL,
        entityName NVARCHAR(100) NOT NULL,
        entityId NVARCHAR(50),
        details NCLOB
      )
    `);
  })();

  return auditTableReady;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const writeAuditFallback = async (log) => {
  const logDir = path.join(process.cwd(), 'logs');
  const logFile = path.join(logDir, 'audit-fallback.log');
  
  try {
    // Ensure logs directory exists
    try {
      await fs.access(logDir);
    } catch {
      await fs.mkdir(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp}|${log.userId}|${log.userRole}|${log.action}|${log.entityName}|${log.entityId}|${log.details}\n`;
    await fs.appendFile(logFile, logEntry);
  } catch (err) {
    console.error('FATAL: Cannot write audit fallback:', err);
  }
};

const alertSecurityTeam = async (err, log) => {
  console.error('[AuditLog] CRITICAL FAILURE: Audit logging failed after retries.', {
    error: err?.message ?? err,
    log
  });
};

/**
 * Build a short JSON summary of the changed payload (max 2 KB).
 * Sensitive fields (password, token, authorization, secret) are masked BEFORE
 * serialisation so the audit row never persists cleartext credentials.
 */
const summarise = (data) => {
  if (!data) return null;
  try {
    const safe = maskSensitive(data);
    const raw = JSON.stringify(safe);
    return raw.length > 2048 ? raw.slice(0, 2045) + '...' : raw;
  } catch {
    return null;
  }
};

/**
 * Decide whether a given (event, target) pair should produce an audit row.
 * Covers CUD events on any entity AND every custom action that isn't on the
 * read-style skip list.
 */
const shouldAudit = (event) => {
  if (!event || typeof event !== 'string') return false;
  if (AUDIT_SKIPPED_EVENTS.has(event)) return false;
  return true;
};

const persistAuditRow = async (logEntry) => {
  let lastError;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await cds.db.run(INSERT.into(AUDIT_ENTITY).entries(logEntry));
      return; // Success
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }
  await writeAuditFallback(logEntry);
  await alertSecurityTeam(lastError, logEntry);
};

/**
 * Register an after-handler on the given CDS service that audits every CUD
 * operation AND every custom action — except the read-style skip list above.
 */
const attachAuditLog = (srv) => {
  const auditReady = ensureAuditTable();

  // Wildcard handler — CAP fires it after both entity events (CREATE/UPDATE/DELETE/READ)
  // and custom actions (bound or unbound). We filter inside.
  srv.after('*', '*', async (_result, req) => {
    const event = req.event;
    if (!shouldAudit(event)) return;

    await auditReady;

    const ctx = getRequestContext(req);
    const entityName = req.target?.name ?? req.entity ?? `${srv.name}.${event}`;
    const entityId = req.data?.ID ?? req.params?.[0]?.ID ?? req.params?.[0] ?? null;

    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: ctx.userId || null,
      userRole: ctx.role || null,
      action: event,
      entityName,
      entityId: entityId !== null && entityId !== undefined ? String(entityId) : null,
      details: summarise(req.data),
    };

    await persistAuditRow(logEntry);
  });
};

module.exports = { attachAuditLog, AUDIT_SKIPPED_EVENTS, shouldAudit };
