import type { Ticket } from './core';
import type { ODataQueryOptions, ODataRequestOptions } from './core';
import { listEntities, getEntityById, createEntity, updateEntity, deleteEntity, quoteLiteral, odataFetch, entityPath, normalizeEntityRecord } from './core';
import type { TicketEvent, TicketStatus } from '../../types/entities';

interface TicketRaw extends Omit<Ticket, 'history' | 'tags' | 'documentationObjectIds'> {
  history?: unknown;
  tags?: unknown;
  documentationObjectIds?: unknown;
}

const TICKET_EVENT_ACTIONS: ReadonlySet<TicketEvent['action']> = new Set([
  'CREATED',
  'STATUS_CHANGE',
  'ASSIGNED',
  'COMMENT',
  'PRIORITY_CHANGE',
  'EFFORT_CHANGE',
  'SENT_TO_TEST',
]);

const parseJsonIfString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const parseRows = (value: unknown): unknown[] => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];
  return parsed;
};

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const asAction = (value: unknown): TicketEvent['action'] | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim() as TicketEvent['action'];
  return TICKET_EVENT_ACTIONS.has(normalized) ? normalized : undefined;
};

const isDefined = <T>(value: T | null): value is T => value !== null;

const unwrapHistoryRecord = (candidate: Record<string, unknown>): Record<string, unknown> => {
  const detailsRecord = asRecord(parseJsonIfString(candidate.details));
  if (detailsRecord) {
    const rest = { ...candidate };
    delete rest.details;
    return unwrapHistoryRecord({ ...rest, ...detailsRecord });
  }

  const commentRecord = asRecord(parseJsonIfString(candidate.comment));
  if (commentRecord) {
    const rest = { ...candidate };
    delete rest.comment;
    return unwrapHistoryRecord({ ...rest, ...commentRecord });
  }

  return candidate;
};

const normalizeTags = (value: unknown): string[] =>
  parseRows(value)
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const candidate = asRecord(entry);
      if (!candidate) return '';
      return String(candidate.tag ?? candidate.value ?? '').trim();
    })
    .filter((tag) => tag.length > 0);

const normalizeDocumentationObjectIds = (value: unknown): string[] =>
  parseRows(value)
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const candidate = asRecord(entry);
      if (!candidate) return '';
      return String(candidate.docObjectId ?? candidate.id ?? candidate.ID ?? '').trim();
    })
    .filter((id) => id.length > 0);

const normalizeHistory = (value: unknown): TicketEvent[] =>
  parseRows(value)
    .map((entry, index) => {
      const candidate = asRecord(entry);
      if (!candidate) return null;

      const normalized = unwrapHistoryRecord(candidate);
      const directAction = asAction(normalized.action);
      if (directAction) {
        const fromValue = asString(normalized.fromValue);
        const toValue = asString(normalized.toValue);
        const comment = asString(normalized.comment ?? normalized.details);
        return {
          id: asString(normalized.id) ?? asString(normalized.ID) ?? asString(candidate.ID) ?? `te-${index}`,
          timestamp:
            asString(normalized.timestamp) ??
            asString(candidate.createdAt) ??
            new Date().toISOString(),
          userId: asString(normalized.userId) ?? asString(candidate.createdBy) ?? 'system',
          action: directAction,
          ...(fromValue ? { fromValue } : {}),
          ...(toValue ? { toValue } : {}),
          ...(comment ? { comment } : {}),
        };
      }

      const event = asString(normalized.event ?? candidate.event);
      const detailAction = asAction(normalized.action ?? event);
      const fromValue = asString(normalized.fromValue);
      const toValue = asString(normalized.toValue);
      const comment =
        asString(normalized.comment) ??
        asString(normalized.details);

      return {
        id: asString(normalized.id) ?? asString(candidate.ID) ?? `te-${index}`,
        timestamp:
          asString(normalized.timestamp) ??
          asString(candidate.createdAt) ??
          asString(candidate.modifiedAt) ??
          new Date().toISOString(),
        userId: asString(normalized.userId) ?? asString(candidate.createdBy) ?? 'system',
        action: detailAction ?? 'COMMENT',
        ...(fromValue ? { fromValue } : {}),
        ...(toValue ? { toValue } : {}),
        ...(comment ? { comment } : {}),
      };
    })
    .filter(isDefined);

const toHistoryRows = (value: unknown): Array<{ event: string; details: string }> =>
  parseRows(value)
    .map((entry) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        return text ? { event: 'COMMENT', details: text } : null;
      }
      const candidate = asRecord(entry);
      if (!candidate) return null;

      const event =
        asString(candidate.action) ??
        asString(candidate.event) ??
        'UPDATE';
      const detailFields = {
        ...(asString(candidate.fromValue) ? { fromValue: asString(candidate.fromValue) } : {}),
        ...(asString(candidate.toValue) ? { toValue: asString(candidate.toValue) } : {}),
      };
      const hasDetailFields = Object.keys(detailFields).length > 0;
      const detailsSource =
        candidate.details !== undefined
          ? candidate.details
          : candidate.comment !== undefined
            ? candidate.comment
            : hasDetailFields
              ? detailFields
              : '';
      const details =
        typeof detailsSource === 'string'
          ? detailsSource
          : JSON.stringify(detailsSource);

      if (!details.trim()) return null;
      return { event, details };
    })
    .filter((row): row is { event: string; details: string } => Boolean(row));

const toTagRows = (value: unknown): Array<{ tag: string }> =>
  normalizeTags(value).map((tag) => ({ tag }));

const toDocumentationRows = (value: unknown): Array<{ docObjectId: string }> =>
  normalizeDocumentationObjectIds(value).map((docObjectId) => ({ docObjectId }));

const toTicketPayload = (ticket: Partial<Ticket>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...ticket };

  if ('history' in ticket && ticket.history !== undefined) {
    payload.history = toHistoryRows(ticket.history);
  }
  if ('tags' in ticket && ticket.tags !== undefined) {
    payload.tags = toTagRows(ticket.tags);
  }
  if ('documentationObjectIds' in ticket && ticket.documentationObjectIds !== undefined) {
    payload.documentationObjectIds = toDocumentationRows(ticket.documentationObjectIds);
  }

  return payload;
};

const normalizeTicket = (ticket: TicketRaw): Ticket => ({
  ...ticket,
  history: normalizeHistory(ticket.history),
  tags: normalizeTags(ticket.tags),
  documentationObjectIds: normalizeDocumentationObjectIds(ticket.documentationObjectIds),
});

export const TicketsAPI = {
  async list(
    options?: ODataQueryOptions,
    requestOptions?: ODataRequestOptions
  ): Promise<Ticket[]> {
    const tickets = await listEntities<TicketRaw>('ticket', 'Tickets', options, requestOptions, true);
    return tickets.map(normalizeTicket);
  },

  async getAll(requestOptions?: ODataRequestOptions): Promise<Ticket[]> {
    return await TicketsAPI.list(undefined, requestOptions);
  },

  async getByProject(projectId: string, requestOptions?: ODataRequestOptions): Promise<Ticket[]> {
    return await TicketsAPI.list(
      {
        $filter: `projectId eq ${quoteLiteral(projectId)}`,
        $top: 500,
      },
      requestOptions
    );
  },

  async getByUser(userId: string, requestOptions?: ODataRequestOptions): Promise<Ticket[]> {
    return await TicketsAPI.list(
      {
        $filter: `assignedTo eq ${quoteLiteral(userId)}`,
      },
      requestOptions
    );
  },

  async getById(id: string, requestOptions?: ODataRequestOptions): Promise<Ticket | null> {
    const ticket = await getEntityById<TicketRaw>('ticket', 'Tickets', id, requestOptions);
    if (!ticket) return null;
    return normalizeTicket(ticket);
  },

  async create(
    ticket: Omit<Ticket, 'id' | 'createdAt' | 'ticketCode' | 'status'> & { status?: TicketStatus },
    requestOptions?: ODataRequestOptions
  ): Promise<Ticket> {
    const created = await createEntity<TicketRaw>('ticket', 'Tickets',
      toTicketPayload(ticket),
      requestOptions
    );
    return normalizeTicket(created);
  },

  async update(
    id: string,
    ticket: Partial<Ticket>,
    requestOptions?: ODataRequestOptions
  ): Promise<Ticket> {
    const updated = await updateEntity<TicketRaw>('ticket', 'Tickets',
      id,
      toTicketPayload(ticket),
      requestOptions
    );
    return normalizeTicket(updated);
  },

  async delete(
    id: string,
    requestOptions?: ODataRequestOptions
  ): Promise<void> {
    await deleteEntity('ticket', 'Tickets', id, requestOptions);
  },

  async approveTicket(
    id: string,
    techConsultantId: string,
    allocatedHours: number,
    requestOptions?: ODataRequestOptions
  ): Promise<Ticket> {
    const data = await odataFetch<TicketRaw>('ticket', `${entityPath('Tickets', id)}/approveTicket`,
      {
        ...requestOptions,
        method: 'POST',
        body: JSON.stringify({ techConsultantId, allocatedHours }),
      }
    );
    if (!data) throw new Error(`approveTicket returned no data for Ticket '${id}'`);
    return normalizeTicket(normalizeEntityRecord(data));
  },

  async rejectTicket(
    id: string,
    reason: string,
    requestOptions?: ODataRequestOptions
  ): Promise<Ticket> {
    const data = await odataFetch<TicketRaw>('ticket', `${entityPath('Tickets', id)}/rejectTicket`,
      {
        ...requestOptions,
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    );
    if (!data) throw new Error(`rejectTicket returned no data for Ticket '${id}'`);
    return normalizeTicket(normalizeEntityRecord(data));
  },
};
