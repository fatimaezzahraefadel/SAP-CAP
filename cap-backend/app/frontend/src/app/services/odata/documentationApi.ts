import type { DocumentationObject, Ticket, Wricef, WricefObject } from './core';
import type { ODataQueryOptions, ODataRequestOptions } from './core';
import { listEntities, createEntity, updateEntity, deleteEntity, quoteLiteral } from './core';
import { TicketsAPI } from './ticketsApi';
import { sanitizeFileName } from '../../utils/file';

// ---------------------------------------------------------------------------
// WRICEF sync helpers
// ---------------------------------------------------------------------------

const WRICEF_SOURCE_PREFIX = 'wricef-object:';

const normalizeText = (value?: string | null): string => (value ?? '').trim().toLowerCase();
const normalizeRef = (value?: string | null): string =>
  normalizeText(value).replace(/[^a-z0-9_-]/g, '');

interface DocumentationObjectRaw
  extends Omit<DocumentationObject, 'attachedFiles' | 'relatedTicketIds' | 'description' | 'content'> {
  attachedFiles?: unknown;
  relatedTicketIds?: unknown;
  description?: unknown;
  content?: unknown;
}

const parseJsonIfString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const normalizeAttachmentUrl = (value: unknown): string => String(value ?? '').trim();

export const normalizeAttachments = (value: unknown): DocumentationObject['attachedFiles'] => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const filename = sanitizeFileName(
        candidate.filename ??
          candidate.fileName ??
          candidate.name ??
          ''
      );
      const url = normalizeAttachmentUrl(candidate.url ?? candidate.fileUrl ?? '');
      const size = Number(candidate.size ?? 0);
      return {
        filename: filename || 'Attachment',
        url: url || '#',
        size: Number.isFinite(size) && size >= 0 ? size : 0,
      };
    })
    .filter((entry): entry is DocumentationObject['attachedFiles'][number] => Boolean(entry));
};

const normalizeRelatedTicketIds = (value: unknown): string[] => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const candidate = entry as Record<string, unknown>;
        return String(candidate.ticketId ?? candidate.id ?? candidate.ID ?? '').trim();
      }
      return '';
    })
    .filter((id) => id.length > 0);
};

const normalizeDocumentationObject = (doc: DocumentationObjectRaw): DocumentationObject => ({
  ...doc,
  description: typeof doc.description === 'string' ? doc.description : '',
  content: typeof doc.content === 'string' ? doc.content : '',
  attachedFiles: normalizeAttachments(doc.attachedFiles),
  relatedTicketIds: normalizeRelatedTicketIds(doc.relatedTicketIds),
});

export const toAttachmentRows = (value: unknown): Array<{ fileName: string; fileUrl: string }> => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const candidate = entry as Record<string, unknown>;
      const fileName = sanitizeFileName(candidate.fileName ?? candidate.filename ?? candidate.name ?? '');
      const fileUrl = normalizeAttachmentUrl(candidate.fileUrl ?? candidate.url ?? '');
      if (!fileName && !fileUrl) return null;
      return {
        fileName: fileName || 'Attachment',
        fileUrl: fileUrl || '#',
      };
    })
    .filter((entry): entry is { fileName: string; fileUrl: string } => Boolean(entry));
};

const toRelatedTicketRows = (value: unknown): Array<{ ticketId: string }> => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => {
      if (typeof entry === 'string') {
        const ticketId = entry.trim();
        return ticketId ? { ticketId } : null;
      }
      if (entry && typeof entry === 'object') {
        const candidate = entry as Record<string, unknown>;
        const ticketId = String(candidate.ticketId ?? candidate.id ?? candidate.ID ?? '').trim();
        return ticketId ? { ticketId } : null;
      }
      return null;
    })
    .filter((entry): entry is { ticketId: string } => Boolean(entry));
};

const toDocumentationPayload = (
  value: Omit<DocumentationObject, 'id' | 'createdAt' | 'updatedAt'> | Partial<DocumentationObject>
): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...value };

  if ('attachedFiles' in value && value.attachedFiles !== undefined) {
    payload.attachedFiles = toAttachmentRows(value.attachedFiles);
  }

  if ('relatedTicketIds' in value && value.relatedTicketIds !== undefined) {
    payload.relatedTicketIds = toRelatedTicketRows(value.relatedTicketIds);
  }

  return payload;
};

const DOCUMENTATION_BASE_SELECT =
  'ID,title,description,type,content,projectId,authorId,createdAt,updatedAt,sourceSystem,sourceRefId';

const isMissingDocumentationCompositionTable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /no such table: .*Doc(AttachedFiles|RelatedTickets)/i.test(error.message);
};

const isTicketLinkedToWricefObject = (ticketRef?: string | null, objectRef?: string | null): boolean => {
  const normalizedTicket = normalizeRef(ticketRef);
  const normalizedObject = normalizeRef(objectRef);
  if (!normalizedTicket || !normalizedObject) return false;
  const compactTicket = normalizedTicket.replace(/[^a-z0-9]/g, '');
  const compactObject = normalizedObject.replace(/[^a-z0-9]/g, '');
  return (
    normalizedTicket === normalizedObject ||
    normalizedTicket.startsWith(`${normalizedObject}-tk-`) ||
    compactTicket === compactObject ||
    compactTicket.startsWith(`${compactObject}tk`)
  );
};

const buildWricefObjectContent = (object: WricefObject): string => {
  return [
    `# ${object.type} Object - ${object.id}`,
    '',
    '## Title',
    object.title,
    '',
    '## Description',
    object.description || '-',
    '',
    '## Complexity',
    object.complexity,
    '',
    '## Module',
    object.module,
  ].join('\n');
};

const resolveWricefLinkedTicketIds = (
  projectTickets: Ticket[],
  wricefObject: WricefObject
): string[] => {
  return projectTickets
    .filter((t) => isTicketLinkedToWricefObject(t.wricefId, wricefObject.id))
    .map((t) => t.id);
};

// ---------------------------------------------------------------------------
// DocumentationAPI
// ---------------------------------------------------------------------------

export const DocumentationAPI = {
  async list(
    options?: ODataQueryOptions,
    requestOptions?: ODataRequestOptions
  ): Promise<DocumentationObject[]> {
    const mergedOptions: ODataQueryOptions = {
      ...options,
      $select: options?.$select ?? DOCUMENTATION_BASE_SELECT,
      $expand: options?.$expand ?? 'relatedTicketIds,attachedFiles',
    };
    try {
      const docs = await listEntities<DocumentationObjectRaw>('core', 'DocumentationObjects',
        mergedOptions,
        requestOptions,
        true
      );
      return docs.map(normalizeDocumentationObject);
    } catch (error) {
      if (!isMissingDocumentationCompositionTable(error)) throw error;
      const legacyDocs = await listEntities<DocumentationObjectRaw>('core', 'DocumentationObjects',
        {
          ...options,
          $select:
            options?.$select ??
            `${DOCUMENTATION_BASE_SELECT},attachedFiles,relatedTicketIds`,
        },
        requestOptions,
        true
      );
      return legacyDocs.map(normalizeDocumentationObject);
    }
  },

  async getAll(requestOptions?: ODataRequestOptions): Promise<DocumentationObject[]> {
    return await DocumentationAPI.list(undefined, requestOptions);
  },

  async getByProject(
    projectId: string,
    requestOptions?: ODataRequestOptions
  ): Promise<DocumentationObject[]> {
    return await DocumentationAPI.list(
      {
        $filter: `projectId eq ${quoteLiteral(projectId)}`,
      },
      requestOptions
    );
  },

  async getById(
    id: string,
    requestOptions?: ODataRequestOptions
  ): Promise<DocumentationObject | null> {
    const docs = await DocumentationAPI.list(
      { $filter: `ID eq ${quoteLiteral(id)}`, $top: 1 },
      requestOptions
    );
    return docs.length > 0 ? docs[0] : null;
  },

  async getByTicketId(
    ticketId: string,
    requestOptions?: ODataRequestOptions
  ): Promise<DocumentationObject[]> {
    return await DocumentationAPI.list(
      {
        $filter: `relatedTicketIds/any(r:r/ticketId eq ${quoteLiteral(ticketId)})`,
      },
      requestOptions
    );
  },

  async create(
    documentation: Omit<DocumentationObject, 'id' | 'createdAt' | 'updatedAt'>,
    requestOptions?: ODataRequestOptions
  ): Promise<DocumentationObject> {
    const created = await createEntity<DocumentationObjectRaw>('core', 'DocumentationObjects',
      toDocumentationPayload(documentation),
      requestOptions
    );
    return normalizeDocumentationObject(created);
  },

  async update(
    id: string,
    data: Partial<DocumentationObject>,
    requestOptions?: ODataRequestOptions
  ): Promise<DocumentationObject> {
    const updated = await updateEntity<DocumentationObjectRaw>('core', 'DocumentationObjects',
      id,
      toDocumentationPayload(data),
      requestOptions
    );
    return normalizeDocumentationObject(updated);
  },

  async delete(id: string, requestOptions?: ODataRequestOptions): Promise<void> {
    await deleteEntity('core', 'DocumentationObjects', id, requestOptions);
  },

  async syncProjectWricef(
    projectId: string,
    wricef: Wricef,
    wricefObjects: WricefObject[],
    actorId: string
  ): Promise<{ created: number; updated: number; deleted: number; total: number }> {
    const docsForProject = (
      await DocumentationAPI.getByProject(projectId)
    ).filter((doc) => doc.sourceSystem === 'WRICEF');

    const docBySourceRef = new Map<string, DocumentationObject>();
    docsForProject.forEach((doc) => {
      if (doc.sourceRefId) docBySourceRef.set(doc.sourceRefId, doc);
    });

    const projectTickets = await TicketsAPI.getByProject(projectId);

    let created = 0;
    let updated = 0;
    let deleted = 0;
    const activeSourceRefs = new Set<string>();

    for (const wricefObject of wricefObjects) {
      const sourceRefId = `${WRICEF_SOURCE_PREFIX}${projectId}:${wricefObject.id}`;
      activeSourceRefs.add(sourceRefId);
      const linkedTicketIds = resolveWricefLinkedTicketIds(projectTickets, wricefObject);

      const docPayload: Omit<DocumentationObject, 'id' | 'createdAt' | 'updatedAt'> = {
        title: wricefObject.title || wricefObject.id,
        description:
          wricefObject.description ||
          `WRICEF object ${wricefObject.id} imported from ${wricef.sourceFileName}`,
        type: 'GENERAL',
        content: buildWricefObjectContent(wricefObject),
        attachedFiles: [],
        relatedTicketIds: linkedTicketIds,
        projectId,
        authorId: actorId,
        sourceSystem: 'WRICEF',
        sourceRefId,
      };

      const existingDoc = docBySourceRef.get(sourceRefId);
      if (existingDoc) {
        await DocumentationAPI.update(existingDoc.id, docPayload);
        updated += 1;
      } else {
        await DocumentationAPI.create(docPayload);
        created += 1;
      }
    }

    const staleDocs = docsForProject.filter((doc) => doc.sourceRefId && !activeSourceRefs.has(doc.sourceRefId));
    for (const staleDoc of staleDocs) {
      await DocumentationAPI.delete(staleDoc.id);
      deleted += 1;
    }

    return {
      created,
      updated,
      deleted,
      total: wricefObjects.length,
    };
  },
};
