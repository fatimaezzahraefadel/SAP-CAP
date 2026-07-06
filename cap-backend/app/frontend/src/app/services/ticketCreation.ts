import { TicketsAPI } from './odata/ticketsApi';
import {
  Project,
  SAPModule,
  Ticket,
  TicketComplexity,
  TicketNature,
  UserRole,
  WricefObject,
} from '../types/entities';

export interface UnifiedTicketCreateInput {
  project: Project;
  wricefObjects: WricefObject[];
  existingProjectTickets: Ticket[];
  createdBy: string;
  assignedTo?: string;
  assignedToRole?: UserRole;
  priority: Ticket['priority'];
  nature: TicketNature;
  title: string;
  description: string;
  dueDate?: string;
  module: SAPModule;
  complexity: TicketComplexity;
  estimationHours: number;
  estimatedViaAbaque?: boolean;
  selectedWricefObjectId?: string;
  manualWricefId?: string;
  creationComment?: string;
}

export interface UnifiedTicketCreateResult {
  ticket: Ticket;
  updatedProject?: Project;
}

const normalizeRef = (value?: string | null): string =>
  (value ?? '').trim().toLowerCase();

const buildManualWricefId = (usedRefs: Set<string>, startAt: number): string => {
  let sequence = Math.max(1, startAt);
  let candidate = `W-${String(sequence).padStart(3, '0')}`;
  while (usedRefs.has(candidate.toLowerCase())) {
    sequence += 1;
    candidate = `W-${String(sequence).padStart(3, '0')}`;
  }
  return candidate;
};

export const createTicketWithUnifiedFlow = async (
  input: UnifiedTicketCreateInput
): Promise<UnifiedTicketCreateResult> => {
  const {
    project,
    existingProjectTickets,
    createdBy,
    assignedTo,
    assignedToRole,
    priority,
    nature,
    title,
    description,
    dueDate,
    module,
    complexity,
    estimationHours,
    estimatedViaAbaque,
    selectedWricefObjectId,
    manualWricefId,
    creationComment,
    wricefObjects,
  } = input;

  const selectedObject = selectedWricefObjectId
    ? wricefObjects.find((obj) => obj.id === selectedWricefObjectId)
    : undefined;

  let wricefId = (manualWricefId ?? '').trim();
  if (selectedObject) {
    wricefId = selectedObject.externalRef?.trim() || selectedObject.id;
  }
  
  if (!wricefId) {
    const usedRefs = new Set<string>(existingProjectTickets.map((ticket) => normalizeRef(ticket.wricefId)));
    wricefId = buildManualWricefId(usedRefs, existingProjectTickets.length + 1);
  }

  const created = await TicketsAPI.create({
    projectId: project.id,
    createdBy,
    assignedTo: assignedTo || undefined,
    assignedToRole,
    priority,
    nature,
    title: title.trim(),
    description: description.trim(),
    dueDate: dueDate || undefined,
    effortHours: 0,
    wricefId,
    module,
    estimationHours,
    complexity,
    estimatedViaAbaque: Boolean(estimatedViaAbaque),
    history: [
      {
        id: `te${Date.now()}`,
        timestamp: new Date().toISOString(),
        userId: createdBy,
        action: 'CREATED',
        comment: creationComment || 'Ticket created',
      },
    ],
  });

  return { ticket: created };
};
