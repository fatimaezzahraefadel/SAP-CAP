'use strict';

const AllocationRepo = require('./allocation.repo');
const { assertEntityExists, assertDateRange, ENTITIES, MANAGER_ROLES, requireRole } = require('../shared/services/validation');

const extractEntityId = (req) => req.params?.[0]?.ID ?? req.params?.[0] ?? req.data?.ID;

const assertPercent = (value, req) => {
  if (value === undefined || value === null) return;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 100) {
    req.error(400, 'allocationPercent must be between 0 and 100');
  }
};

class AllocationDomainService {
  constructor(_srv) {
    this.repo = new AllocationRepo();
  }

  async beforeCreate(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can manage allocations');
    const data = req.data;

    await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

    assertPercent(data.allocationPercent, req);
    assertDateRange(data.startDate, data.endDate, req);
  }

  async beforeUpdate(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can manage allocations');
    const data = req.data;

    await assertEntityExists(ENTITIES.Users, data.userId, 'userId', req);
    await assertEntityExists(ENTITIES.Projects, data.projectId, 'projectId', req);

    assertPercent(data.allocationPercent, req);

    if (data.startDate !== undefined || data.endDate !== undefined) {
      const id = extractEntityId(req);
      const current = id ? await this.repo.findById(id) : null;
      const startDate = data.startDate ?? current?.startDate;
      const endDate = data.endDate ?? current?.endDate;
      assertDateRange(startDate, endDate, req);
    }
  }

  async beforeDelete(req) {
    requireRole(req, MANAGER_ROLES, 'Only managers can delete allocations');
  }
}

module.exports = AllocationDomainService;
