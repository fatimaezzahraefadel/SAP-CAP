import type { LeaveRequest } from './core';
import { listEntities, createEntity, updateEntity, deleteEntity, quoteLiteral } from './core';

export const LeaveRequestsAPI = {
  async getAll(): Promise<LeaveRequest[]> {
    return await listEntities<LeaveRequest>('user', 'LeaveRequests');
  },

  async getByConsultant(consultantId: string): Promise<LeaveRequest[]> {
    return await listEntities<LeaveRequest>('user', 'LeaveRequests', {
      $filter: `consultantId eq ${quoteLiteral(consultantId)}`,
    });
  },

  async create(leaveRequest: Omit<LeaveRequest, 'id' | 'createdAt'>): Promise<LeaveRequest> {
    return await createEntity<LeaveRequest>('user', 'LeaveRequests', leaveRequest);
  },

  async update(id: string, data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    return await updateEntity<LeaveRequest>('user', 'LeaveRequests', id, data);
  },

  async delete(id: string): Promise<void> {
    await deleteEntity('user', 'LeaveRequests', id);
  },
};
