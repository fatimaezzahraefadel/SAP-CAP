import { describe, expect, it } from 'vitest';
import type {
  DocumentationAttachment,
  DocumentationObject,
  Ticket,
  WricefObject,
} from '@/app/types/entities';
import type { ProjectTabDefinition } from '@/app/features/projects/components/ProjectTabs';
import type { ParsedWricefResult } from '@/app/utils/wricefExcel';
import {
  appendFilesAsDocumentationAttachments,
  buildDocumentationDraft,
  buildObjectTicketRows,
  buildWricefImportPlan,
  buildWricefObjectTicketStats,
  buildWricefTicketMap,
  computeEffortTotals,
  computeEstimateConsumption,
  computeProjectKpis,
  countDocumentationByType,
  filterProjectObjects,
  filterProjectTickets,
  formatBytes,
  getUsageBarClass,
  isTicketLinkedToObject,
  normalizeWricefRef,
  paginateItems,
  sortTicketHistoryByLatest,
  withProjectTabIcons,
} from '@/app/features/projects/model';

const createTicket = (overrides: Partial<Ticket> = {}): Ticket => ({
  id: 'TCK-2025-0001',
  ticketCode: 'TK-2025-0001',
  projectId: 'PRJ-S4-001',
  createdBy: 'USR-PM-001',
  assignedTo: 'USR-CONS-001',
  assignedToRole: 'CONSULTANT_TECHNIQUE',
  status: 'NEW',
  priority: 'MEDIUM',
  nature: 'PROGRAMME',
  title: 'Développement module FI',
  description: 'Implémentation d une règle de validation comptable.',
  dueDate: '2025-03-12T00:00:00.000Z',
  createdAt: '2025-02-10T08:00:00.000Z',
  updatedAt: '2025-02-12T10:00:00.000Z',
  history: [],
  effortHours: 8,
  estimationHours: 16,
  complexity: 'MOYEN',
  wricefId: 'WF-SD-INV-001',
  module: 'FI',
  documentationObjectIds: ['DOC-SFD-001'],
  ...overrides,
});

const createWricefObject = (overrides: Partial<WricefObject> = {}): WricefObject => ({
  id: 'WF-SD-INV-001',
  wricefId: 'WRICEF-2025-S4-001',
  projectId: 'PRJ-S4-001',
  type: 'W',
  title: 'Workflow validation facture SD',
  description: 'Circuit de validation en deux niveaux avant comptabilisation.',
  complexity: 'COMPLEXE',
  module: 'SD',
  status: 'DRAFT',
  documentationObjectIds: ['DOC-SFD-001'],
  createdAt: '2025-01-10T09:30:00.000Z',
  updatedAt: '2025-01-20T15:45:00.000Z',
  ...overrides,
});

const createDoc = (overrides: Partial<DocumentationObject> = {}): DocumentationObject => ({
  id: 'DOC-SFD-001',
  title: 'SFD Validation facture client',
  description: 'Spécification fonctionnelle détaillée.',
  type: 'SFD',
  content: '# Contexte\nFlux SD vers FI.',
  attachedFiles: [],
  relatedTicketIds: ['TCK-2025-0001'],
  projectId: 'PRJ-S4-001',
  createdAt: '2025-02-01T08:00:00.000Z',
  updatedAt: '2025-02-05T11:00:00.000Z',
  authorId: 'USR-FUNC-002',
  sourceSystem: 'MANUAL',
  ...overrides,
});

const attachmentFixture: DocumentationAttachment = {
  filename: 'Architecture_Validation_Facture_SD_v1.3.pdf',
  size: 1_245_330,
  url: 'https://files.internal.company/docs/Architecture_Validation_Facture_SD_v1.3.pdf',
};

const makeFileList = (files: File[]): FileList => {
  return {
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* iterator(): IterableIterator<File> {
      for (const file of files) yield file;
    },
    ...Object.fromEntries(files.map((file, index) => [index, file])),
  } as unknown as FileList;
};

describe('filterProjectObjects', () => {
  it('returns expected output for typical input', () => {
    const objects = [
      createWricefObject(),
      createWricefObject({
        id: 'INT-MM-CAT-004',
        type: 'I',
        module: 'MM',
        title: 'Interface catalogue fournisseur',
        description: 'Synchronisation des articles.',
        complexity: 'MOYEN',
      }),
    ];

    const result = filterProjectObjects(objects, 'facture', 'W', 'COMPLEXE', 'SD');

    expect(result.map((item) => item.id)).toEqual(['WF-SD-INV-001']);
  });

  it('handles empty input without throwing', () => {
    const result = filterProjectObjects([], '', '', '', '');
    expect(result).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    const objects = [
      createWricefObject({
        description: null as unknown as string,
      }),
    ];

    const result = filterProjectObjects(objects, '', '', '', '');
    expect(result).toHaveLength(1);
  });

  it('handles combined filter edge case', () => {
    const objects = [
      createWricefObject({ id: 'WF-SD-INV-001' }),
      createWricefObject({ id: 'WF-SD-INV-002', module: 'FI' }),
    ];

    const result = filterProjectObjects(objects, 'inv-002', '', '', 'FI');
    expect(result.map((item) => item.id)).toEqual(['WF-SD-INV-002']);
  });
});

describe('filterProjectTickets', () => {
  it('returns expected output for typical input', () => {
    const tickets = [
      createTicket({ status: 'IN_PROGRESS', title: 'Correction contrôle crédit client' }),
      createTicket({ id: 'TCK-2025-0002', ticketCode: 'TK-2025-0002', status: 'DONE', title: 'Rapport CO mensuel' }),
    ];

    const result = filterProjectTickets(tickets, 'crédit', 'IN_PROGRESS');
    expect(result.map((ticket) => ticket.ticketCode)).toEqual(['TK-2025-0001']);
  });

  it('handles empty input without throwing', () => {
    const result = filterProjectTickets([], '', '');
    expect(result).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    const tickets = [
      createTicket({
        title: null as unknown as string,
        description: null as unknown as string,
        wricefId: null,
      }),
    ];

    const result = filterProjectTickets(tickets, 'wf-sd', '');
    expect(result).toEqual([]);
  });

  it('handles status-only filter edge case', () => {
    const tickets = [
      createTicket({ id: 'A', ticketCode: 'TK-2025-0901', status: 'BLOCKED' }),
      createTicket({ id: 'B', ticketCode: 'TK-2025-0902', status: 'IN_TEST' }),
    ];

    const result = filterProjectTickets(tickets, '', 'BLOCKED');
    expect(result.map((ticket) => ticket.ticketCode)).toEqual(['TK-2025-0901']);
  });
});

describe('computeProjectKpis', () => {
  it('returns expected output for typical input', () => {
    const tickets = [
      createTicket({ id: '1', status: 'NEW', dueDate: '2100-01-01T00:00:00.000Z', priority: 'LOW' }),
      createTicket({ id: '2', status: 'DONE', dueDate: '2020-01-01T00:00:00.000Z', priority: 'MEDIUM' }),
      createTicket({ id: '3', status: 'BLOCKED', dueDate: '2020-01-01T00:00:00.000Z', priority: 'CRITICAL' }),
      createTicket({ id: '4', status: 'IN_PROGRESS', dueDate: '2020-01-01T00:00:00.000Z', priority: 'HIGH' }),
    ];

    const result = computeProjectKpis(tickets);

    expect(result).toEqual({
      onTrack: 2,
      late: 2,
      blocked: 1,
      completed: 1,
      critical: 1,
      productivity: 47.5,
    });
  });

  it('handles empty input without throwing', () => {
    expect(computeProjectKpis([])).toEqual({
      onTrack: 0,
      late: 0,
      blocked: 0,
      completed: 0,
      critical: 0,
      productivity: 0,
    });
  });

  it('handles null/undefined fields gracefully', () => {
    const tickets = [
      createTicket({ dueDate: undefined, wricefId: null, status: 'IN_PROGRESS' }),
      createTicket({ id: 'X', ticketCode: 'TK-2025-0099', dueDate: undefined, status: 'DONE' }),
    ];

    const result = computeProjectKpis(tickets);
    expect(result.late).toBe(0);
    expect(result.completed).toBe(1);
  });

  it('handles blocked-and-late edge case without double subtraction', () => {
    const tickets = [
      createTicket({ status: 'BLOCKED', dueDate: '2020-02-01T00:00:00.000Z' }),
      createTicket({ id: '2', ticketCode: 'TK-2025-0202', status: 'IN_PROGRESS', dueDate: '2020-02-01T00:00:00.000Z' }),
    ];

    const result = computeProjectKpis(tickets);
    expect(result.onTrack).toBe(0);
  });
});

describe('computeEffortTotals', () => {
  it('returns expected output for typical input', () => {
    const tickets = [
      createTicket({ effortHours: 12, estimationHours: 16 }),
      createTicket({ id: '2', ticketCode: 'TK-2025-0022', effortHours: 20, estimationHours: 24 }),
    ];

    expect(computeEffortTotals(tickets)).toEqual({
      totalActualHours: 32,
      totalEstimatedHours: 40,
      totalActualDays: 4,
    });
  });

  it('handles empty input without throwing', () => {
    expect(computeEffortTotals([])).toEqual({
      totalActualHours: 0,
      totalEstimatedHours: 0,
      totalActualDays: 0,
    });
  });

  it('handles null/undefined fields gracefully', () => {
    const tickets = [
      createTicket({ effortHours: undefined as unknown as number, estimationHours: undefined as unknown as number }),
    ];

    expect(computeEffortTotals(tickets)).toEqual({
      totalActualHours: 0,
      totalEstimatedHours: 0,
      totalActualDays: 0,
    });
  });

  it('handles high-volume effort edge case', () => {
    const tickets = [createTicket({ effortHours: 80, estimationHours: 64 })];
    expect(computeEffortTotals(tickets).totalActualDays).toBe(10);
  });
});

describe('computeEstimateConsumption', () => {
  it('returns expected output for typical input', () => {
    expect(computeEstimateConsumption(20, 15)).toEqual({
      estimateConsumptionPercent: 75,
      estimateDeltaDays: 5,
    });
  });

  it('handles empty input without throwing', () => {
    expect(computeEstimateConsumption(0, 0)).toEqual({
      estimateConsumptionPercent: 0,
      estimateDeltaDays: 0,
    });
  });

  it('handles null/undefined fields gracefully', () => {
    const result = computeEstimateConsumption(null as unknown as number, null as unknown as number);
    expect(result).toEqual({
      estimateConsumptionPercent: 0,
      estimateDeltaDays: 0,
    });
  });

  it('handles estimatedDays=0 edge case', () => {
    expect(computeEstimateConsumption(0, 5)).toEqual({
      estimateConsumptionPercent: 0,
      estimateDeltaDays: -5,
    });
  });
});

describe('normalizeWricefRef', () => {
  it('returns expected output for typical input', () => {
    expect(normalizeWricefRef(' WF-SD-INV_001 ')).toBe('wf-sd-inv_001');
  });

  it('handles empty input without throwing', () => {
    expect(normalizeWricefRef('')).toBe('');
  });

  it('handles null/undefined fields gracefully', () => {
    expect(normalizeWricefRef('   ')).toBe('');
  });

  it('handles punctuation edge case', () => {
    expect(normalizeWricefRef('WF SD/INV#001')).toBe('wfsdinv001');
  });
});

describe('isTicketLinkedToObject', () => {
  it('returns expected output for typical input', () => {
    expect(isTicketLinkedToObject('wf-sd-inv-001', 'WF-SD-INV-001')).toBe(true);
  });

  it('handles empty input without throwing', () => {
    expect(isTicketLinkedToObject(undefined, 'WF-SD-INV-001')).toBe(false);
  });

  it('handles null/undefined fields gracefully', () => {
    expect(isTicketLinkedToObject(null, ' WF-SD-INV-001 ')).toBe(false);
  });

  it('handles direct and normalized matching edge cases', () => {
    const directMatch = isTicketLinkedToObject('WF-SD-INV-001-TK-09', 'WF-SD-INV-001');
    const normalizedMatch = isTicketLinkedToObject('WF SD INV 001 TK 09', 'WF-SD-INV-001');
    expect(directMatch).toBe(true);
    expect(normalizedMatch).toBe(true);
  });
});

describe('buildWricefTicketMap', () => {
  it('returns expected output for typical input', () => {
    const tickets = [
      createTicket({ id: '1', wricefId: 'WF-SD-INV-001' }),
      createTicket({ id: '2', ticketCode: 'TK-2025-2002', wricefId: 'wf-sd-inv-001' }),
    ];

    const map = buildWricefTicketMap(tickets);
    expect(map.get('wf-sd-inv-001')?.map((ticket) => ticket.id)).toEqual(['1', '2']);
  });

  it('handles empty input without throwing', () => {
    const map = buildWricefTicketMap([]);
    expect(map.size).toBe(0);
  });

  it('handles null/undefined fields gracefully', () => {
    const map = buildWricefTicketMap([createTicket({ wricefId: null })]);
    expect(map.size).toBe(0);
  });

  it('handles case-insensitive key edge case', () => {
    const map = buildWricefTicketMap([
      createTicket({ id: 'a', wricefId: 'Int-MM-Cat-004' }),
      createTicket({ id: 'b', ticketCode: 'TK-2025-3002', wricefId: 'INT-MM-CAT-004' }),
    ]);
    expect(map.get('int-mm-cat-004')?.length).toBe(2);
  });
});

describe('buildObjectTicketRows', () => {
  it('returns expected output for typical input', () => {
    const object = createWricefObject({ id: 'WF-SD-INV-001' });
    const tickets = [
      createTicket({ id: '1', wricefId: 'WF-SD-INV-001' }),
      createTicket({ id: '2', ticketCode: 'TK-2025-4002', wricefId: 'WF-SD-INV-001-TK-02' }),
      createTicket({ id: '3', ticketCode: 'TK-2025-4003', wricefId: 'RPT-CO-MAR-002' }),
    ];

    const rows = buildObjectTicketRows(object, tickets);
    expect(rows.map((ticket) => ticket.id)).toEqual(['1', '2']);
  });

  it('handles empty input without throwing', () => {
    const rows = buildObjectTicketRows(createWricefObject(), []);
    expect(rows).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    const rows = buildObjectTicketRows(createWricefObject(), [createTicket({ wricefId: undefined })]);
    expect(rows).toEqual([]);
  });

  it('handles normalized reference edge case', () => {
    const object = createWricefObject({ id: 'WF-SD-INV-001' });
    const rows = buildObjectTicketRows(object, [createTicket({ wricefId: 'WF SD INV 001 TK 07' })]);
    expect(rows).toHaveLength(1);
  });
});

describe('buildWricefObjectTicketStats', () => {
  it('returns expected output for typical input', () => {
    const objects = [createWricefObject({ id: 'WF-SD-INV-001' }), createWricefObject({ id: 'INT-MM-CAT-004' })];
    const tickets = [
      createTicket({ wricefId: 'WF-SD-INV-001' }),
      createTicket({ id: '2', ticketCode: 'TK-2025-5002', wricefId: 'WF-SD-INV-001-TK-02' }),
      createTicket({ id: '3', ticketCode: 'TK-2025-5003', wricefId: 'INT-MM-CAT-004' }),
    ];

    const stats = buildWricefObjectTicketStats(objects, tickets);
    expect(stats.get('WF-SD-INV-001')).toEqual({ available: 2 });
    expect(stats.get('INT-MM-CAT-004')).toEqual({ available: 1 });
  });

  it('handles empty input without throwing', () => {
    const stats = buildWricefObjectTicketStats([], []);
    expect(stats.size).toBe(0);
  });

  it('handles null/undefined fields gracefully', () => {
    const stats = buildWricefObjectTicketStats([createWricefObject()], [createTicket({ wricefId: null })]);
    expect(stats.get('WF-SD-INV-001')).toEqual({ available: 0 });
  });

  it('handles object-without-ticket edge case', () => {
    const stats = buildWricefObjectTicketStats([createWricefObject({ id: 'OBJ-NO-TICKET-001' })], [createTicket()]);
    expect(stats.get('OBJ-NO-TICKET-001')).toEqual({ available: 0 });
  });
});

describe('paginateItems', () => {
  it('returns expected output for typical input', () => {
    expect(paginateItems(['A', 'B', 'C', 'D', 'E'], 2, 2)).toEqual(['C', 'D']);
  });

  it('handles empty input without throwing', () => {
    expect(paginateItems([], 1, 10)).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    const values = paginateItems([null as unknown as string, 'B'], 1, 2);
    expect(values).toEqual([null, 'B']);
  });

  it('handles page beyond total items edge case', () => {
    expect(paginateItems([1, 2, 3], 5, 2)).toEqual([]);
  });
});

describe('countDocumentationByType', () => {
  it('returns expected output for typical input', () => {
    const docs = [
      createDoc({ type: 'SFD' }),
      createDoc({ id: '2', type: 'GUIDE' }),
      createDoc({ id: '3', type: 'SFD' }),
    ];
    expect(countDocumentationByType(docs, 'SFD')).toBe(2);
  });

  it('handles empty input without throwing', () => {
    expect(countDocumentationByType([], 'GENERAL')).toBe(0);
  });

  it('handles null/undefined fields gracefully', () => {
    const docs = [createDoc({ type: undefined as unknown as DocumentationObject['type'] }), createDoc({ id: '4', type: 'GUIDE' })];
    expect(countDocumentationByType(docs, 'GUIDE')).toBe(1);
  });

  it('handles single-type edge case', () => {
    const docs = [createDoc({ type: 'ARCHITECTURE_DOC' }), createDoc({ id: '5', type: 'ARCHITECTURE_DOC' })];
    expect(countDocumentationByType(docs, 'ARCHITECTURE_DOC')).toBe(2);
  });
});

describe('withProjectTabIcons', () => {
  it('returns expected output for typical input', () => {
    const tabs = withProjectTabIcons({
      overview: 'overview-icon',
      objects: 'objects-icon',
      tickets: 'tickets-icon',
      kpi: 'kpi-icon',
      docs: 'docs-icon',
      abaques: 'abaques-icon',
    });

    expect((tabs[0] as ProjectTabDefinition<string>).icon).toBe('overview-icon');
    expect(tabs.find((tab) => tab.key === 'team')?.icon).toBeUndefined();
  });

  it('handles empty input without throwing', () => {
    const tabs = withProjectTabIcons({
      overview: '',
      objects: '',
      tickets: '',
      kpi: '',
      docs: '',
      abaques: '',
    });
    expect(tabs).toHaveLength(7);
  });

  it('handles null/undefined fields gracefully', () => {
    const tabs = withProjectTabIcons({
      overview: null,
      objects: null,
      tickets: null,
      kpi: null,
      docs: null,
      abaques: null,
    });
    expect(tabs.find((tab) => tab.key === 'overview')?.icon).toBeNull();
  });

  it('handles team-tab edge case without icon assignment', () => {
    const tabs = withProjectTabIcons({
      overview: 'a',
      objects: 'b',
      tickets: 'c',
      kpi: 'd',
      docs: 'e',
      abaques: 'f',
    });
    expect(tabs.find((tab) => tab.key === 'team')?.icon).toBeUndefined();
  });
});

describe('getUsageBarClass', () => {
  it('returns expected output for typical input', () => {
    expect(getUsageBarClass(65)).toBe('bg-emerald-600');
  });

  it('handles empty input without throwing', () => {
    expect(getUsageBarClass(0)).toBe('bg-emerald-600');
  });

  it('handles null/undefined fields gracefully', () => {
    expect(getUsageBarClass(undefined as unknown as number)).toBe('bg-emerald-600');
  });

  it('handles boundary edge cases at 0, 80, 100 and 150', () => {
    expect(getUsageBarClass(0)).toBe('bg-emerald-600');
    expect(getUsageBarClass(80)).toBe('bg-emerald-600');
    expect(getUsageBarClass(100)).toBe('bg-amber-500');
    expect(getUsageBarClass(150)).toBe('bg-destructive');
  });
});

describe('sortTicketHistoryByLatest', () => {
  it('returns expected output for typical input', () => {
    const history = [
      { id: 'E1', timestamp: '2025-02-01T10:00:00.000Z', userId: 'USR-01', action: 'CREATED' as const },
      { id: 'E2', timestamp: '2025-02-03T08:00:00.000Z', userId: 'USR-01', action: 'STATUS_CHANGE' as const },
      { id: 'E3', timestamp: '2025-02-02T12:00:00.000Z', userId: 'USR-02', action: 'COMMENT' as const },
    ];

    expect(sortTicketHistoryByLatest(history).map((event) => event.id)).toEqual(['E2', 'E3', 'E1']);
  });

  it('handles empty input without throwing', () => {
    expect(sortTicketHistoryByLatest([])).toEqual([]);
  });

  it('handles null/undefined fields gracefully', () => {
    expect(sortTicketHistoryByLatest(undefined)).toEqual([]);
  });

  it('handles timezone edge case', () => {
    const history = [
      { id: 'A', timestamp: '2025-02-10T09:00:00+01:00', userId: 'USR-01', action: 'COMMENT' as const },
      { id: 'B', timestamp: '2025-02-10T09:30:00Z', userId: 'USR-02', action: 'COMMENT' as const },
    ];

    expect(sortTicketHistoryByLatest(history).map((event) => event.id)).toEqual(['B', 'A']);
  });
});

describe('buildWricefImportPlan', () => {
  const importedFixture: ParsedWricefResult = {
    sourceFileName: 'WRICEF_S4_Mars_2025.xlsx',
    importedAt: '2025-03-01T08:00:00.000Z',
    objects: [
      {
        id: 'WF-SD-INV-001',
        type: 'W',
        title: 'Workflow validation facture SD',
        description: 'Objet déjà existant',
        complexity: 'COMPLEXE',
        module: 'SD',
        status: 'DRAFT',
      },
      {
        id: 'ENH-FI-TAX-003',
        type: 'E',
        title: 'Enhancement contrôle TVA',
        description: 'Nouvel objet fiscal FI',
        complexity: 'MOYEN',
        module: 'FI',
        status: 'DRAFT',
      },
    ],
    tickets: [
      { id: 'ENH-FI-TAX-003-TK-001', title: 'Développement règle TVA UE', wricefId: 'ENH-FI-TAX-003' },
      { id: 'ENH-FI-TAX-003-TK-002', title: 'Développement règle TVA UE', wricefId: 'ENH-FI-TAX-003' },
      { id: 'WF-SD-INV-001-TK-003', title: 'Ajustement workflow legacy', wricefId: 'WF-SD-INV-001' },
    ],
  };

  it('returns expected output for typical input', () => {
    const existingObjects = [createWricefObject({ id: 'WF-SD-INV-001' })];
    const existingTickets = [createTicket({ title: 'Ajustement workflow legacy', wricefId: 'WF-SD-INV-001' })];

    const plan = buildWricefImportPlan(importedFixture, existingObjects, existingTickets);

    expect(plan.uniqueObjects.map((obj) => obj.id)).toEqual(['ENH-FI-TAX-003']);
    expect(plan.uniqueTickets.map((ticket) => ticket.id)).toEqual(['ENH-FI-TAX-003-TK-001']);
    expect(plan.skippedObjects).toBe(1);
    expect(plan.skippedTickets).toBe(2);
  });

  it('handles empty input without throwing', () => {
    const emptyImported: ParsedWricefResult = {
      sourceFileName: 'WRICEF_empty.xlsx',
      importedAt: '2025-03-01T08:00:00.000Z',
      objects: [],
      tickets: [],
    };

    const plan = buildWricefImportPlan(emptyImported, [], []);
    expect(plan).toEqual({
      uniqueObjects: [],
      uniqueTickets: [],
      skippedObjects: 0,
      skippedTickets: 0,
    });
  });

  it('handles null/undefined fields gracefully', () => {
    const looseImported: ParsedWricefResult = {
      sourceFileName: 'WRICEF_loose.xlsx',
      importedAt: '2025-03-01T08:00:00.000Z',
      objects: [
        {
          id: ' INT-MM-CAT-004 ',
          type: 'I',
          title: ' Interface catalogue fournisseur ',
          description: '',
          complexity: 'SIMPLE',
          module: 'MM',
          status: 'DRAFT',
        },
      ],
      tickets: [
        { title: '  Synchronisation catalogue ', wricefId: 'int-mm-cat-004', description: undefined },
      ],
    };

    const plan = buildWricefImportPlan(looseImported, [], []);
    expect(plan.uniqueObjects).toHaveLength(1);
    expect(plan.uniqueTickets).toHaveLength(1);
  });

  it('handles duplicate imported-ticket edge case', () => {
    const duplicated: ParsedWricefResult = {
      ...importedFixture,
      tickets: [
        { title: 'Analyse impact TVA', wricefId: 'ENH-FI-TAX-003' },
        { title: 'Analyse impact TVA', wricefId: 'ENH-FI-TAX-003' },
      ],
    };

    const plan = buildWricefImportPlan(duplicated, [], []);
    expect(plan.uniqueTickets).toHaveLength(1);
    expect(plan.skippedTickets).toBe(1);
  });
});

describe('buildDocumentationDraft', () => {
  it('returns expected output for typical input', () => {
    const draft = buildDocumentationDraft(createWricefObject({ title: 'Workflow validation facture SD' }));
    expect(draft).toEqual({
      title: 'SFD - Workflow validation facture SD',
      description: 'Documentation for WRICEF object WF-SD-INV-001',
      type: 'SFD',
      content:
        '# Workflow validation facture SD\n\n## Context\nCircuit de validation en deux niveaux avant comptabilisation.\n\n## Functional Details\n- \n\n## Technical Notes\n- \n',
    });
  });

  it('handles empty input without throwing', () => {
    const draft = buildDocumentationDraft(undefined);
    expect(draft.title).toBe('');
    expect(draft.type).toBe('SFD');
  });

  it('handles null/undefined fields gracefully', () => {
    const draft = buildDocumentationDraft(
      createWricefObject({
        title: 'Interface fournisseurs',
        description: undefined as unknown as string,
      })
    );

    expect(draft.content.includes('undefined')).toBe(true);
  });

  it('handles special-character edge case', () => {
    const draft = buildDocumentationDraft(
      createWricefObject({
        id: 'ENH-FI-TVA-ÉU-003',
        title: 'Enhancement contrôle TVA ÉU',
      })
    );
    expect(draft.title).toBe('SFD - Enhancement contrôle TVA ÉU');
  });
});

describe('appendFilesAsDocumentationAttachments', () => {
  const fileA = new File(['document A'], 'SFD_Module_FI_v2.pdf', {
    type: 'application/pdf',
    lastModified: 1739145600000,
  });
  const fileB = new File(['document B'], 'Guide_Utilisateur_FI_v1.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: 1739232000000,
  });

  it('returns expected output for typical input', () => {
    const previous = [attachmentFixture];
    const fileList = makeFileList([fileA, fileB]);

    const result = appendFilesAsDocumentationAttachments(fileList, previous);

    expect(result).toHaveLength(3);
    expect(result[1].filename).toBe('SFD_Module_FI_v2.pdf');
    expect(result[2].filename).toBe('Guide_Utilisateur_FI_v1.docx');
    expect(result[1].url.startsWith('blob:')).toBe(true);
    expect(result[2].url.startsWith('blob:')).toBe(true);
  });

  it('handles empty input without throwing', () => {
    const previous = [attachmentFixture];
    const result = appendFilesAsDocumentationAttachments(makeFileList([]), previous);
    expect(result).toEqual(previous);
  });

  it('handles null/undefined fields gracefully', () => {
    const previous: DocumentationAttachment[] = [
      {
        filename: 'Historique_Anomalies.xlsx',
        size: 0,
        url: '',
      },
    ];

    const result = appendFilesAsDocumentationAttachments(makeFileList([fileA]), previous);
    expect(result[0].url).toBe('');
    expect(result[1].filename).toBe('SFD_Module_FI_v2.pdf');
  });

  it('handles append-order edge case', () => {
    const result = appendFilesAsDocumentationAttachments(makeFileList([fileB, fileA]), []);
    expect(result.map((item) => item.filename)).toEqual(['Guide_Utilisateur_FI_v1.docx', 'SFD_Module_FI_v2.pdf']);
  });

  it('sanitizes file names when appending attachments', () => {
    const fileWithPath = new File(['document'], 'C:\\temp\\bad<name>.pdf', {
      type: 'application/pdf',
      lastModified: 1739318400000,
    });

    const result = appendFilesAsDocumentationAttachments(makeFileList([fileWithPath]), []);
    expect(result[0].filename).toBe('badname.pdf');
  });
});

describe('formatBytes', () => {
  it('returns expected output for typical input', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('handles empty input without throwing', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('handles null/undefined fields gracefully', () => {
    // ⚠️ REVIEW: Null input is out-of-contract but currently coerces to "null B".
    expect(formatBytes(null as unknown as number)).toBe('null B');
  });

  it('handles MB boundary edge case', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });
});


