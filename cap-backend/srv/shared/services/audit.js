'use strict';
/**
 * audit.js – Lightweight audit logger.
 * Writes an immutable AuditLogs row for every CUD event that flows through
 * a CAP service registered via `attachAuditLog(srv)`.
 */

const cds = require('@sap/cds');

const fs = require('fs').promises;
const path = require('path');
const { getRequestContext } = require('../../_shared/auth/request-context');

const AUDIT_ENTITY = 'sap.performance.dashboard.db.AuditLogs';
const SQLITE_AUDIT_TABLE = 'sap_performance_dashboard_db_AuditLogs';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Events we track – skips drafts, metadata, and custom actions
const CUD_EVENTS = new Set(['CREATE', 'UPDATE', 'DELETE']);

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
        "action" NVARCHAR(10) NOT NULL,
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
 */
const summarise = (data) => {
  if (!data) return null;
  try {
    const raw = JSON.stringify(data);
    return raw.length > 2048 ? raw.slice(0, 2045) + '...' : raw;
  } catch {
    return null;
  }
};

/**
 * Register after-handlers on the given CDS service to log CUD operations.
 */
const attachAuditLog = (srv) => {
  const auditReady = ensureAuditTable();

  for (const event of CUD_EVENTS) {
    srv.after(event, '*', async (_result, req) => {
      await auditReady;

      const ctx = getRequestContext(req);
      const entityName = req.target?.name ?? req.entity ?? 'unknown';
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

      // All retries failed
      await writeAuditFallback(logEntry);
      await alertSecurityTeam(lastError, logEntry);
    });
  }
};

module.exports = { attachAuditLog };
