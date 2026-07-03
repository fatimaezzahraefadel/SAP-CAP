'use strict';

const ProjectRepo = require('./project.repo');
const { assertEntityExists, ENTITIES, MANAGER_ROLES, requireRole } = require('../shared/services/validation');

const PROJECT_TRANSITIONS = {
  PLANNED: new Set(['ACTIVE', 'CANCELLED']),
  ACTIVE: new Set(['ON_HOLD', 'COMPLETED', 'CANCELLED']),
  ON_HOLD: new Set(['ACTIVE', 'CANCELLED']),
  COMPLETED: new Set([]),
  CANCELLED: new Set(['PLANNED']),
};

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

class ProjectDomainService {
  constructor(_srv) {
    this.repo = new ProjectRepo();
  }

  async beforeCreate(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can create projects');
    const data = req.data;
    if (!String(data.name ?? '').trim()) req.error(400, 'name is required');
    if (!data.managerId) req.error(400, 'managerId is required');

    if (data.managerId) {
      const activeManager = await this.repo.existsActiveUserById(data.managerId);
      if (!activeManager) req.error(400, `Unknown active managerId '${data.managerId}'`);
    }

    if (data.status === undefined) data.status = 'PLANNED';
    if (data.priority === undefined) data.priority = 'MEDIUM';
    if (data.progress === undefined) data.progress = 0;
  }

  async beforeUpdate(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can update projects');
    const data = req.data;

    await assertEntityExists(ENTITIES.Users, data.managerId, 'managerId', req);

    if (data.status !== undefined) {
      const id = extractEntityId(req);
      if (id) {
        const current = await this.repo.findById(id);
        if (current && data.status !== current.status) {
          const allowed = PROJECT_TRANSITIONS[current.status] || new Set();
          if (!allowed.has(data.status)) {
            req.reject(409, `Invalid project status transition: ${current.status} -> ${data.status}`);
          }
        }
      }
    }
  }

  async beforeDelete(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can delete projects');
    const id = extractEntityId(req);
    if (!id) return;

    // This runs inside the same CAP-managed transaction as the DELETE,
    // so concurrent inserts into child tables are serialised by the DB lock.
    const hasChildren = await this.repo.hasRelatedRecords(id);
    if (hasChildren) {
      req.reject(409, 'Cannot delete project with existing related records. Delete children first.');
    }
  }
}

module.exports = ProjectDomainService;
