import {
  type Priority,
  type SAPModule,
  type TicketComplexity,
  type TicketStatus,
  type WricefObject,
  type WricefType,
} from '../types/entities';

export interface ParsedWricefTicket {
  id?: string;
  title: string;
  description?: string;
  priority?: Priority;
  status?: TicketStatus;
  wricefId: string;
}

export interface ParsedWricefResult {
  sourceFileName: string;
  importedAt: string;
  objects: Omit<WricefObject, 'projectId' | 'wricefId'>[];
  tickets: ParsedWricefTicket[];
}

type Row = Record<string, unknown>;

const normalizeKey = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const splitInlineTickets = (raw: string): string[] =>
  raw
    .split(/\r?\n|[|;,]/g)
    .map((part) => part.trim())
    .filter(Boolean);

const mapComplexity = (value: string): TicketComplexity => {
  const normalized = normalizeKey(value);
  if (!normalized) return 'MOYEN';
  if (normalized.includes('simple') || normalized.includes('low') || normalized.includes('faible')) {
    return 'SIMPLE';
  }
  if (normalized.includes('moyen') || normalized.includes('medium')) {
    return 'MOYEN';
  }
  if (
    normalized.includes('trescomplexe') ||
    normalized.includes('verycomplex') ||
    normalized.includes('critical')
  ) {
    return 'TRES_COMPLEXE';
  }
  if (normalized.includes('complexe') || normalized.includes('complex') || normalized.includes('high')) {
    return 'COMPLEXE';
  }
  return 'MOYEN';
};

const mapPriority = (value: string): Priority | undefined => {
  const normalized = normalizeKey(value);
  if (!normalized) return undefined;
  if (normalized === 'low') return 'LOW';
  if (normalized === 'medium' || normalized === 'moyen') return 'MEDIUM';
  if (normalized === 'high') return 'HIGH';
  if (normalized === 'critical' || normalized === 'urgent') return 'CRITICAL';
  return undefined;
};

const mapStatus = (value: string): TicketStatus | undefined => {
  const normalized = normalizeKey(value);
  if (!normalized) return undefined;
  if (normalized === 'new' || normalized === 'nouveau') return 'NEW';
  if (normalized === 'inprogress' || normalized === 'encours') return 'IN_PROGRESS';
  if (normalized === 'intest' || normalized === 'test') return 'IN_TEST';
  if (normalized === 'blocked' || normalized === 'bloque') return 'BLOCKED';
  if (normalized === 'done' || normalized === 'termine') return 'DONE';
  if (normalized === 'rejected' || normalized === 'rejete') return 'REJECTED';
  return undefined;
};

const getValue = (row: Row, aliases: string[]): string => {
  const aliasSet = new Set(aliases.map(normalizeKey));
  for (const [rawKey, rawValue] of Object.entries(row)) {
    if (!aliasSet.has(normalizeKey(rawKey))) continue;
    return String(rawValue ?? '').trim();
  }
  return '';
};

const makeTicketId = (objectId: string, index: number): string => {
  const safeObjectId = objectId.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase() || 'OBJ';
  return `${safeObjectId}-TK-${String(index + 1).padStart(3, '0')}`;
};

const pushTicket = (
  ticketList: ParsedWricefTicket[],
  objectId: string,
  partial: Omit<ParsedWricefTicket, 'wricefId'>
): void => {
  const nextIndex = ticketList.filter(t => t.wricefId === objectId).length;
  ticketList.push({
    id: partial.id?.trim() || makeTicketId(objectId, nextIndex),
    title: partial.title.trim(),
    description: partial.description?.trim() || undefined,
    priority: partial.priority,
    status: partial.status,
    wricefId: objectId,
  });
};

const inferWricefType = (objectId: string): WricefType => {
  const prefix = objectId.trim().charAt(0).toUpperCase();
  if (['W', 'R', 'I', 'C', 'E', 'F'].includes(prefix)) return prefix as WricefType;
  return 'E'; // default to Enhancement
};

const mapModule = (value: string): SAPModule => {
  const normalized = value.trim().toUpperCase();
  const valid: SAPModule[] = ['FI', 'CO', 'MM', 'SD', 'PP', 'QM', 'PM', 'HR', 'PS', 'WM', 'ABAP', 'BASIS', 'BW', 'FIORI', 'OTHER'];
  if (valid.includes(normalized as SAPModule)) return normalized as SAPModule;
  return 'OTHER';
};

const ensureObject = (
  objectsById: Map<string, WricefObject>,
  objectId: string,
  defaults?: Partial<Pick<WricefObject, 'title' | 'description' | 'complexity' | 'type' | 'module'>>
): WricefObject => {
  const existing = objectsById.get(objectId);
  if (existing) return existing;

  const created: WricefObject = {
    id: objectId,
    externalRef: objectId,
    type: defaults?.type ?? inferWricefType(objectId),
    title: defaults?.title?.trim() || `Object ${objectId}`,
    description: defaults?.description?.trim() || '',
    complexity: defaults?.complexity ?? 'MOYEN',
    module: defaults?.module ?? 'OTHER',
  } as unknown as WricefObject;
  objectsById.set(objectId, created);
  return created;
};

export async function parseWricefExcel(file: File): Promise<ParsedWricefResult> {
  const XLSX = await import('xlsx');
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (!workbook.SheetNames.length) {
    throw new Error('The file does not contain any worksheet');
  }

  const objectsSheetName =
    workbook.SheetNames.find((name) => normalizeKey(name).includes('object')) ??
    workbook.SheetNames[0];
  const objectsSheet = workbook.Sheets[objectsSheetName];
  const objectRows = XLSX.utils.sheet_to_json<Row>(objectsSheet, { defval: '' });

  const objectsById = new Map<string, WricefObject>();
  const ticketList: ParsedWricefTicket[] = [];
  let unnamedCounter = 0;

  objectRows.forEach((row) => {
    const rawId = getValue(row, [
      'id',
      'object id',
      'objet id',
      'object',
      'objet',
      'wricef object id',
    ]);
    const rawTitle = getValue(row, ['title', 'titre', 'object title', 'objet title']);
    const rawDescription = getValue(row, ['description', 'desc']);
    const rawComplexity = getValue(row, ['complexity', 'complexite', 'complexite objet']);
    const rawType = getValue(row, ['type', 'wricef type', 'object type', 'type objet']);
    const rawModule = getValue(row, ['module', 'sap module', 'module sap']);
    const rawInlineTickets = getValue(row, [
      'tickets',
      'ticket',
      'ticket titles',
      'liste tickets',
      'liste des tickets',
      'ticket list',
    ]);

    if (!rawId && !rawTitle && !rawDescription && !rawInlineTickets) return;

    const generatedObjectIndex = ++unnamedCounter;
    const objectId = rawId || `OBJ-${String(generatedObjectIndex).padStart(3, '0')}`;
    const projectObject = ensureObject(objectsById, objectId, {
      title: rawTitle || `Object ${objectId}`,
      description: rawDescription,
      complexity: mapComplexity(rawComplexity),
      type: rawType ? (rawType.charAt(0).toUpperCase() as WricefType) : undefined,
      module: rawModule ? mapModule(rawModule) : undefined,
    });

    if (!projectObject.title && rawTitle) projectObject.title = rawTitle;
    if (!projectObject.description && rawDescription) projectObject.description = rawDescription;
    if (rawComplexity) projectObject.complexity = mapComplexity(rawComplexity);

    splitInlineTickets(rawInlineTickets).forEach((ticketTitle) => {
      pushTicket(ticketList, projectObject.id, { title: ticketTitle });
    });
  });

  const ticketSheetName = workbook.SheetNames.find((name) =>
    normalizeKey(name).includes('ticket')
  );
  if (ticketSheetName) {
    const ticketRows = XLSX.utils.sheet_to_json<Row>(workbook.Sheets[ticketSheetName], {
      defval: '',
    });
    ticketRows.forEach((row) => {
      const objectId = getValue(row, ['object id', 'objet id', 'object', 'objet', 'wricef object id']);
      const ticketTitle = getValue(row, ['title', 'ticket title', 'titre']);
      if (!objectId || !ticketTitle) return;

      const projectObject = ensureObject(objectsById, objectId);
      const ticketId = getValue(row, ['ticket id', 'id']);
      const description = getValue(row, ['description', 'desc']);
      const priority = mapPriority(getValue(row, ['priority', 'priorite']));
      const status = mapStatus(getValue(row, ['status', 'statut']));

      pushTicket(ticketList, projectObject.id, {
        id: ticketId || undefined,
        title: ticketTitle,
        description: description || undefined,
        priority,
        status,
      });
    });
  }

  const objects = [...objectsById.values()];
  if (!objects.length) {
    throw new Error(
      'No WRICEF object found. Expected columns like: id, title, description, complexity.'
    );
  }

  return {
    sourceFileName: file.name,
    importedAt: new Date().toISOString(),
    objects,
    tickets: ticketList,
  };
}
