import type { Deliverable } from './core';
import type { ODataQueryOptions, ODataRequestOptions } from './core';
import { listEntities, createEntity, updateEntity, deleteEntity, quoteLiteral } from './core';

const SAFE_DELIVERABLE_SELECT =
  'ID,projectId,type,name,url,fileRef,validationStatus,functionalComment,createdBy,createdAt';

const normalizeDeliverable = (entry: Partial<Deliverable>): Deliverable => ({
  id: String(entry.id ?? ''),
  projectId: String(entry.projectId ?? ''),
  ticketId: typeof entry.ticketId === 'string' ? entry.ticketId : undefined,
  type: String(entry.type ?? ''),
  name: String(entry.name ?? ''),
  url: typeof entry.url === 'string' ? entry.url : undefined,
  fileRef: typeof entry.fileRef === 'string' ? entry.fileRef : undefined,
  validationStatus:
    entry.validationStatus === 'APPROVED' ||
    entry.validationStatus === 'CHANGES_REQUESTED' ||
    entry.validationStatus === 'PENDING'
      ? entry.validationStatus
      : 'PENDING',
  functionalComment: typeof entry.functionalComment === 'string' ? entry.functionalComment : undefined,
  createdBy: typeof entry.createdBy === 'string' ? entry.createdBy : undefined,
  createdAt: String(entry.createdAt ?? ''),
});

export const DeliverablesAPI = {
  async list(
    options?: ODataQueryOptions,
    requestOptions?: ODataRequestOptions
  ): Promise<Deliverable[]> {
    const rows = await listEntities<Partial<Deliverable>>('core', 'Deliverables',
      {
        ...options,
        // Avoid selecting optional columns on stale local SQLite schemas.
        $select: options?.$select ?? SAFE_DELIVERABLE_SELECT,
      },
      requestOptions,
      true
    );
    return rows.map(normalizeDeliverable);
  },

  async getAll(requestOptions?: ODataRequestOptions): Promise<Deliverable[]> {
    return await DeliverablesAPI.list(undefined, requestOptions);
  },

  async getByProject(
    projectId: string,
    requestOptions?: ODataRequestOptions
  ): Promise<Deliverable[]> {
    return await DeliverablesAPI.list(
      {
        $filter: `projectId eq ${quoteLiteral(projectId)}`,
      },
      requestOptions
    );
  },

  async create(
    deliverable: Omit<Deliverable, 'id' | 'createdAt'>,
    requestOptions?: ODataRequestOptions
  ): Promise<Deliverable> {
    return await createEntity<Deliverable>('core', 'Deliverables', deliverable, requestOptions);
  },

  async update(
    id: string,
    deliverable: Partial<Deliverable>,
    requestOptions?: ODataRequestOptions
  ): Promise<Deliverable> {
    return await updateEntity<Deliverable>('core', 'Deliverables', id, deliverable, requestOptions);
  },

  async remove(id: string, requestOptions?: ODataRequestOptions): Promise<void> {
    await deleteEntity('core', 'Deliverables', id, requestOptions);
  },
};
