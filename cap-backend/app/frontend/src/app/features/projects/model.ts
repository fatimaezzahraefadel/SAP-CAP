import {
  DocumentationObject,
  DocumentationObjectType,
  DocumentationAttachment,
  SAPModule,
  Ticket,
  TicketComplexity,
  TicketNature,
  TicketStatus,
  WricefObject,
  WricefType,
} from '../../types/entities';
import { ParsedWricefResult } from '../../utils/wricefExcel';
import { sanitizeFileName } from '../../utils/file';
import { ProjectTabDefinition } from './components/ProjectTabs';
import { ReactNode } from 'react';

export type ProjectTabKey =
  | 'overview'
  | 'objects'
  | 'tickets'
  | 'team'
  | 'kpi'
  | 'docs'
  | 'abaques';

export interface ProjectTicketFormState {
  title: string;
  description: string;
  nature: TicketNature;
  priority: Ticket['priority'];
  complexity: TicketComplexity;
  effortHours: number;
  dueDate: string;
  wricefObjectId: string;
}

export interface ProjectDocumentationFormState {
  title: string;
  description: string;
  type: DocumentationObjectType;
  content: string;
}

export interface WricefImportPlan {
  uniqueObjects: ParsedWricefResult['objects'];
  uniqueTickets: ParsedWricefResult['tickets'];
  skippedObjects: number;
  skippedTickets: number;
}

export const EMPTY_PROJECT_TICKET_FORM: ProjectTicketFormState = {
  title: '',
  description: '',
  nature: 'PROGRAMME',
  priority: 'MEDIUM',
  complexity: 'MOYEN',
  effortHours: 0,
  dueDate: '',
  wricefObjectId: '',
};

export const EMPTY_PROJECT_DOCUMENTATION_FORM: ProjectDocumentationFormState = {
  title: '',
  description: '',
  type: 'SFD',
  content: '',
};

export const PROJECT_TABS: ProjectTabDefinition<ProjectTabKey>[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'objects', label: 'Objects' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'team', label: 'Team & Allocation' },
  { key: 'kpi', label: 'KPI Report' },
  { key: 'docs', label: 'Documentation' },
  { key: 'abaques', label: 'Abaques' },
];

export const WRICEF_TYPE_BADGE_CLASS: Record<WricefType, string> = {
  W: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  R: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  I: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  E: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  F: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
};

export const COMPLEXITY_BADGE_CLASS: Record<TicketComplexity, string> = {
  SIMPLE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  MOYEN: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  COMPLEXE: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  TRES_COMPLEXE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export const WRICEF_STATUS_COLOR: Record<TicketStatus, string> = {
  PENDING_APPROVAL: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  NEW: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  IN_TEST: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  BLOCKED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  DONE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-gray-100 text-gray-800 dark:bg-gray-700/40 dark:text-gray-300',
};

export const WRICEF_PRIORITY_COLOR: Record<string, string> = {
  LOW: 'bg-muted text-muted-foreground',
  MEDIUM: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export interface ProjectKpis {
  onTrack: number;
  late: number;
  blocked: number;
  completed: number;
  critical: number;
  productivity: number;
}

export interface EffortTotals {
  totalActualHours: number;
  totalEstimatedHours: number;
  totalActualDays: number;
}

export interface EstimateConsumption {
  estimateConsumptionPercent: number;
  estimateDeltaDays: number;
}

// WricefTicketRow is removed

export const filterProjectObjects = (
  objects: WricefObject[],
  search: string,
  typeFilter: WricefType | '',
  complexityFilter: TicketComplexity | '',
  moduleFilter: SAPModule | ''
): WricefObject[] => {
  return objects.filter((object) => {
    if (search) {
      const query = search.toLowerCase();
      const matchesSearch =
        object.id.toLowerCase().includes(query) ||
        object.title.toLowerCase().includes(query) ||
        object.description.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    if (typeFilter && object.type !== typeFilter) return false;
    if (complexityFilter && object.complexity !== complexityFilter) return false;
    if (moduleFilter && object.module !== moduleFilter) return false;

    return true;
  });
};

export const filterProjectTickets = (
  tickets: Ticket[],
  search: string,
  statusFilter: TicketStatus | ''
): Ticket[] => {
  return tickets.filter((ticket) => {
    if (statusFilter && ticket.status !== statusFilter) return false;

    if (!search) return true;
    const query = search.toLowerCase();

    return (
      (ticket.ticketCode ?? '').toLowerCase().includes(query) ||
      (ticket.title ?? '').toLowerCase().includes(query) ||
      (ticket.description ?? '').toLowerCase().includes(query) ||
      (ticket.wricefId ?? '').toLowerCase().includes(query)
    );
  });
};

export const computeProjectKpis = (tickets: Ticket[]): ProjectKpis => {
  if (!tickets.length) {
    return {
      onTrack: 0,
      late: 0,
      blocked: 0,
      completed: 0,
      critical: 0,
      productivity: 0,
    };
  }

  const now = new Date();
  const isLate = (ticket: Ticket): boolean =>
    Boolean(ticket.dueDate && ticket.status !== 'DONE' && ticket.status !== 'REJECTED' && new Date(ticket.dueDate) < now);
  const progressByStatus: Record<TicketStatus, number> = {
    PENDING_APPROVAL: 5,
    APPROVED: 10,
    NEW: 0,
    IN_PROGRESS: 50,
    IN_TEST: 80,
    BLOCKED: 40,
    DONE: 100,
    REJECTED: 100,
  };

  const late = tickets.filter(isLate).length;
  const blocked = tickets.filter((ticket) => ticket.status === 'BLOCKED').length;
  const completed = tickets.filter((ticket) => ticket.status === 'DONE').length;
  const critical = tickets.filter((ticket) => ticket.priority === 'CRITICAL').length;
  // Tickets that are both blocked AND late should not be double-subtracted
  const blockedAndLate = tickets.filter((ticket) => ticket.status === 'BLOCKED' && isLate(ticket)).length;
  const onTrack = tickets.length - late - blocked + blockedAndLate;
  const productivity =
    tickets.reduce((sum, ticket) => sum + progressByStatus[ticket.status], 0) / tickets.length;

  return { onTrack, late, blocked, completed, critical, productivity };
};

export const computeEffortTotals = (tickets: Ticket[]): EffortTotals => {
  const totalActualHours = tickets.reduce((sum, ticket) => sum + Number(ticket.effortHours ?? 0), 0);
  const totalEstimatedHours = tickets.reduce((sum, ticket) => sum + Number(ticket.estimationHours ?? 0), 0);
  const totalActualDays = totalActualHours / 8;

  return {
    totalActualHours,
    totalEstimatedHours,
    totalActualDays,
  };
};

export const computeEstimateConsumption = (
  estimatedDays: number,
  totalActualDays: number
): EstimateConsumption => {
  const estimateConsumptionPercent = estimatedDays
    ? Math.round((totalActualDays / estimatedDays) * 100)
    : 0;
  const estimateDeltaDays = estimatedDays - totalActualDays;

  return {
    estimateConsumptionPercent,
    estimateDeltaDays,
  };
};

export const normalizeWricefRef = (value: string): string =>
  value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

export const isTicketLinkedToObject = (
  ticketWricefId: string | null | undefined,
  objectId: string
): boolean => {
  if (!ticketWricefId) return false;
  const ticketRef = ticketWricefId.trim().toLowerCase();
  const objectRef = objectId.trim().toLowerCase();
  if (ticketRef === objectRef || ticketRef.startsWith(`${objectRef}-tk-`)) return true;

  const normalizedTicketRef = normalizeWricefRef(ticketRef);
  const normalizedObjectRef = normalizeWricefRef(objectRef);
  const compactTicketRef = normalizedTicketRef.replace(/[^a-z0-9]/g, '');
  const compactObjectRef = normalizedObjectRef.replace(/[^a-z0-9]/g, '');
  return (
    normalizedTicketRef === normalizedObjectRef ||
    normalizedTicketRef.startsWith(`${normalizedObjectRef}-tk-`) ||
    compactTicketRef === compactObjectRef ||
    compactTicketRef.startsWith(`${compactObjectRef}tk`)
  );
};

export const buildWricefTicketMap = (tickets: Ticket[]): Map<string, Ticket[]> => {
  const byWricefId = new Map<string, Ticket[]>();
  tickets.forEach((ticket) => {
    if (ticket.wricefId) {
      const key = ticket.wricefId.toLowerCase();
      const existing = byWricefId.get(key);
      if (existing) {
        existing.push(ticket);
      } else {
        byWricefId.set(key, [ticket]);
      }
    }
  });
  return byWricefId;
};

export const buildObjectTicketRows = (
  object: WricefObject,
  tickets: Ticket[]
): Ticket[] => {
  return tickets.filter((ticket) => isTicketLinkedToObject(ticket.wricefId, object.id));
};

export const buildWricefObjectTicketStats = (
  wricefObjects: WricefObject[],
  tickets: Ticket[]
): Map<string, { available: number }> => {
  const stats = new Map<string, { available: number }>();
  wricefObjects.forEach((object) => {
    const linkedTickets = tickets.filter(t => isTicketLinkedToObject(t.wricefId, object.id));
    stats.set(object.id, { available: linkedTickets.length });
  });
  return stats;
};

export const paginateItems = <T,>(items: T[], page: number, pageSize: number): T[] => {
  return items.slice((page - 1) * pageSize, page * pageSize);
};

export const countDocumentationByType = (
  documentationObjects: DocumentationObject[],
  type: DocumentationObjectType
): number => documentationObjects.filter((doc) => doc.type === type).length;

export const withProjectTabIcons = (
  icons: Record<Exclude<ProjectTabKey, 'team'>, ReactNode>
): ProjectTabDefinition<ProjectTabKey>[] => {
  return PROJECT_TABS.map((tab) => {
    if (tab.key === 'team') return tab;
    return {
      ...tab,
      icon: icons[tab.key],
    };
  });
};

export const getUsageBarClass = (estimateConsumptionPercent: number): string => {
  if (estimateConsumptionPercent > 100) return 'bg-destructive';
  if (estimateConsumptionPercent > 80) return 'bg-amber-500';
  return 'bg-emerald-600';
};

export const sortTicketHistoryByLatest = (history: Ticket['history'] = []): Ticket['history'] => {
  return [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
};

export const buildWricefImportPlan = (
  imported: ParsedWricefResult,
  existingObjects: WricefObject[],
  existingTickets: Ticket[]
): WricefImportPlan => {
  const knownObjectIds = new Set(existingObjects.map((object) => object.id.trim().toLowerCase()));
  const knownObjectKeys = new Set(
    existingObjects.map((object) => `${object.type}::${object.title.trim().toLowerCase()}`)
  );

  const uniqueObjects = imported.objects.filter((object) => {
    const idKey = object.id.trim().toLowerCase();
    const titleKey = `${object.type}::${object.title.trim().toLowerCase()}`;
    if (knownObjectIds.has(idKey) || knownObjectKeys.has(titleKey)) return false;
    knownObjectIds.add(idKey);
    knownObjectKeys.add(titleKey);
    return true;
  });

  const existingTicketKeys = new Set(
    existingTickets.map(
      (ticket) => `${(ticket.wricefId ?? '').trim().toLowerCase()}::${ticket.title.trim().toLowerCase()}`
    )
  );
  const importedTicketKeys = new Set<string>();
  const uniqueTickets = imported.tickets.filter((ticket) => {
    if (!knownObjectIds.has(ticket.wricefId.trim().toLowerCase())) return false;
    const ticketKey = `${ticket.wricefId.trim().toLowerCase()}::${ticket.title.trim().toLowerCase()}`;
    if (existingTicketKeys.has(ticketKey) || importedTicketKeys.has(ticketKey)) return false;
    importedTicketKeys.add(ticketKey);
    return true;
  });

  return {
    uniqueObjects,
    uniqueTickets,
    skippedObjects: imported.objects.length - uniqueObjects.length,
    skippedTickets: imported.tickets.length - uniqueTickets.length,
  };
};

export const buildDocumentationDraft = (
  object: WricefObject | undefined
): ProjectDocumentationFormState => {
  if (!object) {
    return {
      title: '',
      description: '',
      type: 'SFD',
      content: '# Documentation\n\n## Context\n\n## Details\n- \n',
    };
  }

  return {
    title: `SFD - ${object.title}`,
    description: `Documentation for WRICEF object ${object.id}`,
    type: 'SFD',
    content: `# ${object.title}\n\n## Context\n${object.description}\n\n## Functional Details\n- \n\n## Technical Notes\n- \n`,
  };
};

export const appendFilesAsDocumentationAttachments = (
  files: FileList,
  previous: DocumentationAttachment[]
): DocumentationAttachment[] => {
  const next = Array.from(files).map((file) => ({
    filename: sanitizeFileName(file.name),
    size: file.size,
    url: URL.createObjectURL(file),
  }));
  return [...previous, ...next];
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
