'use strict';

const cds = require('@sap/cds');
const WricefRepo = require('./wricef.repo');
const { assertEntityExists, assertInEnum, ENTITIES, requireRole } = require('../shared/services/validation');
const { nowIso } = require('../shared/utils/timestamp');
const { getRequestContext } = require('../_shared/auth/request-context');

const WRICEF_TYPES = ['W', 'R', 'I', 'C', 'E', 'F'];
const PM_ROLES = new Set(['ADMIN', 'PROJECT_MANAGER']);
const MANAGER_CREATE_ROLES = new Set(['ADMIN', 'MANAGER']);
const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

class WricefDomainService {
  constructor(_srv) {
    this.repo = new WricefRepo();
  }

  // ─── WRICEF lifecycle ───────────────────────────────────────────────

  async beforeCreate(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can create WRICEFs');
    await assertEntityExists(ENTITIES.Projects, req.data.projectId, 'projectId', req);
    req.data.status = 'DRAFT';
    req.data.autoCreated = req.data.autoCreated ?? false;
  }

  /**
   * Block edits when the WRICEF is not in DRAFT status.
   */
  async beforeUpdateWricef(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can edit WRICEFs');
    const id = extractEntityId(req);
    if (!id) return;
    const wricef = await this.repo.findById(id);
    if (wricef && wricef.status !== 'DRAFT') {
      req.reject(409, `Cannot edit WRICEF in status '${wricef.status}'; only DRAFT WRICEFs can be edited`);
    }
  }

  async beforeDelete(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can delete WRICEFs');
    const id = extractEntityId(req);
    if (!id) return;
    await this.repo.deleteObjectsByWricefId(id);
  }

  /**
   * submitWricef – Manager submits a DRAFT WRICEF → PENDING_VALIDATION.
   * Also transitions all child objects to PENDING_VALIDATION.
   */
  async submitWricef(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can submit WRICEFs');
    const id = extractEntityId(req);

    return await cds.tx(req).run(async (tx) => {
      const wricef = await tx.run(SELECT.one.from(ENTITIES.Wricefs).where({ ID: id }));
      if (!wricef) { req.reject(404, 'WRICEF not found'); return; }

      if (wricef.status !== 'DRAFT') {
        req.reject(409, `Cannot submit WRICEF in status '${wricef.status}'; expected DRAFT`);
        return;
      }

      // Ensure there is at least one object
      const objects = await tx.run(SELECT.from(ENTITIES.WricefObjects).where({ wricefId: id }));
      if (!objects || objects.length === 0) {
        req.reject(400, 'Cannot submit a WRICEF without any objects. Add at least one object first.');
        return;
      }

      const userId = getRequestContext(req).userId || 'unknown';
      const now = nowIso();

      // Transition the WRICEF
      await tx.run(UPDATE(ENTITIES.Wricefs).where({ ID: id }).with({
        status: 'PENDING_VALIDATION',
        submittedBy: userId,
        submittedAt: now,
      }));

      // Transition all child objects that are in DRAFT
      await tx.run(UPDATE(ENTITIES.WricefObjects)
        .where({ wricefId: id, status: 'DRAFT' })
        .with({ status: 'PENDING_VALIDATION' }));

      // Notify all project managers (Batch insert to fix Issue #1)
      const pms = await tx.run(
        SELECT.from(ENTITIES.Users).where({ role: 'PROJECT_MANAGER', active: true })
      );

      if (pms.length > 0) {
        const notifications = pms.map(pm => ({
          userId: pm.ID,
          type: 'WRICEF_SUBMITTED',
          title: 'New WRICEF pending validation',
          message: `WRICEF "${wricef.sourceFileName || 'Untitled'}" has been submitted for your approval.`,
          targetPath: '/project-manager/wricef-validation',
          read: false,
        }));
        await tx.run(INSERT.into(ENTITIES.Notifications).entries(notifications));
      }

      // Return the updated WRICEF
      return await tx.run(SELECT.one.from(ENTITIES.Wricefs).where({ ID: id }));
    });
  }

  /**
   * validateWricef – PM validates a PENDING_VALIDATION WRICEF.
   * Also validates all child objects that are PENDING_VALIDATION.
   */
  async validateWricef(req) {
    requireRole(req, PM_ROLES, 'Only project managers can validate WRICEFs');
    const id = extractEntityId(req);

    return await cds.tx(req).run(async (tx) => {
      const wricef = await tx.run(SELECT.one.from(ENTITIES.Wricefs).where({ ID: id }));
      if (!wricef) { req.reject(404, 'WRICEF not found'); return; }

      if (wricef.status !== 'PENDING_VALIDATION') {
        req.reject(409, `Cannot validate WRICEF in status '${wricef.status}'; expected PENDING_VALIDATION`);
        return;
      }

      await tx.run(UPDATE(ENTITIES.Wricefs).where({ ID: id }).with({
        status: 'VALIDATED',
      }));

      // Also validate all child objects still pending
      await tx.run(UPDATE(ENTITIES.WricefObjects)
        .where({ wricefId: id, status: 'PENDING_VALIDATION' })
        .with({ status: 'VALIDATED' }));

      // Notify the submitter
      if (wricef.submittedBy) {
        const submitter = await tx.run(
          SELECT.one.from(ENTITIES.Users).columns('role').where({ ID: wricef.submittedBy })
        );
        const targetPath = submitter?.role === 'MANAGER' ? '/manager/wricef' : null;
        await tx.run(INSERT.into(ENTITIES.Notifications).entries({
          userId: wricef.submittedBy,
          type: 'WRICEF_VALIDATED',
          title: 'WRICEF validated',
          message: `Your WRICEF "${wricef.sourceFileName || 'Untitled'}" has been validated by the project manager.`,
          targetPath,
          read: false,
        }));
      }

      return await tx.run(SELECT.one.from(ENTITIES.Wricefs).where({ ID: id }));
    });
  }

  /**
   * rejectWricef – PM rejects a PENDING_VALIDATION WRICEF with reason.
   * Also rejects all child objects that are PENDING_VALIDATION.
   */
  async rejectWricef(req) {
    requireRole(req, PM_ROLES, 'Only project managers can reject WRICEFs');
    const id = extractEntityId(req);
    const { reason } = req.data ?? {};

    if (!reason || !String(reason).trim()) {
      req.reject(400, 'A rejection reason is required');
      return;
    }

    return await cds.tx(req).run(async (tx) => {
      const wricef = await tx.run(SELECT.one.from(ENTITIES.Wricefs).where({ ID: id }));
      if (!wricef) { req.reject(404, 'WRICEF not found'); return; }

      if (wricef.status !== 'PENDING_VALIDATION') {
        req.reject(409, `Cannot reject WRICEF in status '${wricef.status}'; expected PENDING_VALIDATION`);
        return;
      }

      await tx.run(UPDATE(ENTITIES.Wricefs).where({ ID: id }).with({
        status: 'REJECTED',
        rejectionReason: reason.trim(),
      }));

      // Also reject all child objects still pending
      await tx.run(UPDATE(ENTITIES.WricefObjects)
        .where({ wricefId: id, status: 'PENDING_VALIDATION' })
        .with({ status: 'REJECTED' }));

      // Notify the submitter
      if (wricef.submittedBy) {
        const submitter = await tx.run(
          SELECT.one.from(ENTITIES.Users).columns('role').where({ ID: wricef.submittedBy })
        );
        const targetPath = submitter?.role === 'MANAGER' ? '/manager/wricef' : null;
        await tx.run(INSERT.into(ENTITIES.Notifications).entries({
          userId: wricef.submittedBy,
          type: 'WRICEF_REJECTED',
          title: 'WRICEF rejected',
          message: `Your WRICEF "${wricef.sourceFileName || 'Untitled'}" was rejected. Reason: ${reason.trim()}`,
          targetPath,
          read: false,
        }));
      }

      return await tx.run(SELECT.one.from(ENTITIES.Wricefs).where({ ID: id }));
    });
  }

  // ─── WRICEF Object lifecycle ────────────────────────────────────────

  async beforeCreateObject(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can create WRICEF objects');
    const data = req.data;

    const wricef = await this.repo.findById(data.wricefId);
    if (!wricef) {
      req.error(400, `Unknown wricefId '${data.wricefId}'`);
      return;
    }

    // Only allow adding objects to DRAFT wricefs
    if (wricef.status !== 'DRAFT') {
      req.error(409, `Cannot add objects to WRICEF in status '${wricef.status}'; only DRAFT WRICEFs accept new objects`);
      return;
    }

    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    assertInEnum(data.type, WRICEF_TYPES, 'type', req);
    if (!String(data.title ?? '').trim()) req.error(400, 'title is required');

    // Force DRAFT status on new objects
    data.status = 'DRAFT';
  }

  async beforeUpdateObject(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can edit WRICEF objects');
    const data = req.data;
    const id = extractEntityId(req);

    // Check the object's current status — only DRAFT can be edited
    if (id) {
      const existing = await this.repo.findObjectById(id);
      if (existing && existing.status !== 'DRAFT') {
        req.error(409, `Cannot edit WRICEF object in status '${existing.status}'; only DRAFT objects can be edited`);
        return;
      }
    }

    if (data.wricefId !== undefined) {
      const existsWricef = await this.repo.existsWricefById(data.wricefId);
      if (!existsWricef) req.error(400, `Unknown wricefId '${data.wricefId}'`);
    }
    if (data.projectId !== undefined) {
      await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);
    }
  }

  async beforeDeleteObject(req) {
    requireRole(req, MANAGER_CREATE_ROLES, 'Only managers can delete WRICEF objects');
  }

  /**
   * approveWricefObject – PM approves a single PENDING_VALIDATION object.
   */
  async approveWricefObject(req) {
    requireRole(req, PM_ROLES, 'Only project managers can approve WRICEF objects');
    const id = extractEntityId(req);

    const obj = await this.repo.findObjectById(id);
    if (!obj) { req.reject(404, 'WRICEF Object not found'); return; }

    if (obj.status !== 'PENDING_VALIDATION') {
      req.reject(409, `Cannot approve object in status '${obj.status}'; expected PENDING_VALIDATION`);
      return;
    }

    const updated = await this.repo.updateObjectById(id, { status: 'VALIDATED' });
    return updated;
  }

  /**
   * rejectWricefObject – PM rejects a single PENDING_VALIDATION object with reason.
   */
  async rejectWricefObject(req) {
    requireRole(req, PM_ROLES, 'Only project managers can reject WRICEF objects');
    const id = extractEntityId(req);
    const { reason } = req.data ?? {};

    if (!reason || !String(reason).trim()) {
      req.reject(400, 'A rejection reason is required');
      return;
    }

    const obj = await this.repo.findObjectById(id);
    if (!obj) { req.reject(404, 'WRICEF Object not found'); return; }

    if (obj.status !== 'PENDING_VALIDATION') {
      req.reject(409, `Cannot reject object in status '${obj.status}'; expected PENDING_VALIDATION`);
      return;
    }

    const updated = await this.repo.updateObjectById(id, {
      status: 'REJECTED',
      rejectionReason: reason.trim(),
    });
    return updated;
  }
}

module.exports = WricefDomainService;
