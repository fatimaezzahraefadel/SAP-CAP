// Entity types for SAP CAP Performance Management Platform

export type UserRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'CONSULTANT_TECHNIQUE'
  | 'CONSULTANT_FONCTIONNEL'
  | 'PROJECT_MANAGER'
  | 'DEV_COORDINATOR';

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Manager',
  CONSULTANT_TECHNIQUE: 'Technical Consultant',
  CONSULTANT_FONCTIONNEL: 'Functional Consultant',
  PROJECT_MANAGER: 'Project Manager',
  DEV_COORDINATOR: 'Dev Coordinator',
};

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type RiskLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ValidationStatus = 'PENDING' | 'APPROVED' | 'CHANGES_REQUESTED';
export type TicketStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'NEW' | 'IN_PROGRESS' | 'IN_TEST' | 'BLOCKED' | 'DONE' | 'REJECTED';
export type Complexity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type CertificationStatus = 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ProjectDeliveryType = 'TMA' | 'BUILD';

export const PROJECT_DELIVERY_TYPE_LABELS: Record<ProjectDeliveryType, string> = {
  TMA: 'TMA',
  BUILD: 'Build',
};

// ---------------------------------------------------------------------------
// SAP Module – assigned per ticket
// ---------------------------------------------------------------------------
export type SAPModule =
  | 'FI'
  | 'CO'
  | 'MM'
  | 'SD'
  | 'PP'
  | 'PM'
  | 'QM'
  | 'HR'
  | 'PS'
  | 'WM'
  | 'BASIS'
  | 'ABAP'
  | 'FIORI'
  | 'BW'
  | 'OTHER';

export const SAP_MODULE_LABELS: Record<SAPModule, string> = {
  FI: 'FI – Finance',
  CO: 'CO – Controlling',
  MM: 'MM – Materials Mgmt',
  SD: 'SD – Sales & Dist.',
  PP: 'PP – Production',
  PM: 'PM – Plant Maint.',
  QM: 'QM – Quality Mgmt',
  HR: 'HR – Human Resources',
  PS: 'PS – Project System',
  WM: 'WM – Warehouse Mgmt',
  BASIS: 'BASIS – Admin',
  ABAP: 'ABAP – Development',
  FIORI: 'Fiori / UI5',
  BW: 'BW – Business Warehouse',
  OTHER: 'Other',
};

// ---------------------------------------------------------------------------
// Ticket Complexity – business labels
// ---------------------------------------------------------------------------
export type TicketComplexity = 'SIMPLE' | 'MOYEN' | 'COMPLEXE' | 'TRES_COMPLEXE';

export const TICKET_COMPLEXITY_LABELS: Record<TicketComplexity, string> = {
  SIMPLE: 'Simple',
  MOYEN: 'Medium',
  COMPLEXE: 'Complex',
  TRES_COMPLEXE: 'Very Complex',
};

// ---------------------------------------------------------------------------
// Imputation Validation Status
// ---------------------------------------------------------------------------
export type ImputationValidationStatus = 'DRAFT' | 'SUBMITTED' | 'VALIDATED' | 'REJECTED';

export const IMPUTATION_VALIDATION_LABELS: Record<ImputationValidationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  VALIDATED: 'Validated',
  REJECTED: 'Rejected',
};

// ---------------------------------------------------------------------------
// Ticket Nature enum – required on every ticket
// ---------------------------------------------------------------------------
export type TicketNature =
  | 'WORKFLOW'
  | 'FORMULAIRE'
  | 'PROGRAMME'
  | 'ENHANCEMENT'
  | 'MODULE'
  | 'REPORT';

export const TICKET_NATURE_LABELS: Record<TicketNature, string> = {
  WORKFLOW: 'Workflow',
  FORMULAIRE: 'Formulaire',
  PROGRAMME: 'Programme',
  ENHANCEMENT: 'Enhancement',
  MODULE: 'Module',
  REPORT: 'Report',
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  NEW: 'New',
  IN_PROGRESS: 'In Progress',
  IN_TEST: 'In Test',
  BLOCKED: 'Blocked',
  DONE: 'Done',
  REJECTED: 'Rejected',
};

// ---------------------------------------------------------------------------
// Comment Types (Features 1 & 5)
// ---------------------------------------------------------------------------
export type CommentType = 'GENERAL' | 'BLOCKER' | 'QUESTION' | 'UPDATE' | 'FEEDBACK';

export const COMMENT_TYPE_LABELS: Record<CommentType, string> = {
  GENERAL: 'General',
  BLOCKER: 'Blocker',
  QUESTION: 'Question',
  UPDATE: 'Update',
  FEEDBACK: 'Feedback',
};

// ---------------------------------------------------------------------------
// WRICEF Validation Status (Feature 3)
// ---------------------------------------------------------------------------
export type WricefValidationStatus = 'DRAFT' | 'PENDING_VALIDATION' | 'VALIDATED' | 'REJECTED';

export const WRICEF_VALIDATION_STATUS_LABELS: Record<WricefValidationStatus, string> = {
  DRAFT: 'Draft',
  PENDING_VALIDATION: 'Pending Validation',
  VALIDATED: 'Validated',
  REJECTED: 'Rejected',
};

// ---------------------------------------------------------------------------
// Ticket Comment (Features 1 & 5)
// ---------------------------------------------------------------------------
export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  message: string;
  isInternal: boolean;
  commentType: CommentType;
  parentCommentId?: string | null;
  resolved: boolean;
  createdAt: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Abaques de Chiffrage
// ---------------------------------------------------------------------------

export interface ProjectAbaqueRow {
  id: string;
  nature: TicketNature;
  complexity: TicketComplexity;
  hours: number;
}


// ---------------------------------------------------------------------------
// WRICEF imported model (1 WRICEF file per project)
// ---------------------------------------------------------------------------

export type WricefType = 'W' | 'R' | 'I' | 'C' | 'E' | 'F';

export const WRICEF_TYPE_LABELS: Record<WricefType, string> = {
  W: 'W – Workflow',
  R: 'R – Report',
  I: 'I – Interface',
  C: 'C – Conversion',
  E: 'E – Enhancement',
  F: 'F – Form',
};

export interface Wricef {
  id: string;
  projectId: string;
  sourceFileName: string;
  importedAt: string;
  status: WricefValidationStatus;
  autoCreated: boolean;
  rejectionReason?: string;
  submittedBy?: string;
  submittedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WricefObject {
  id: string;
  wricefId: string;
  projectId: string;
  type: WricefType;
  title: string;
  description: string;
  complexity: TicketComplexity;
  module: SAPModule;
  status: WricefValidationStatus;
  rejectionReason?: string;
  documentationObjectIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

// ---------------------------------------------------------------------------
// Documentation Object / Knowledge Base
// ---------------------------------------------------------------------------

export type DocumentationObjectType = 'SFD' | 'GUIDE' | 'ARCHITECTURE_DOC' | 'GENERAL';

export const DOCUMENTATION_OBJECT_TYPE_LABELS: Record<DocumentationObjectType, string> = {
  SFD: 'SFD',
  GUIDE: 'Guide',
  ARCHITECTURE_DOC: 'Architecture Doc',
  GENERAL: 'General',
};

export interface DocumentationAttachment {
  filename: string;
  size: number;
  url: string;
}

export interface DocumentationObject {
  id: string;
  title: string;
  description: string;
  type: DocumentationObjectType;
  content: string;
  attachedFiles: DocumentationAttachment[];
  relatedTicketIds: string[];
  projectId: string;
  createdAt: string;
  updatedAt?: string;
  authorId: string;
  /** Origin of the object: manual creation or WRICEF synchronization */
  sourceSystem?: 'MANUAL' | 'WRICEF';
  /** Stable external reference used for sync (e.g. WRICEF object id) */
  sourceRefId?: string;
}

// ---------------------------------------------------------------------------
// Time-log types (replaces stopwatch / timer)
// ---------------------------------------------------------------------------

export interface TimeLog {
  id: string;
  consultantId: string;
  ticketId: string;
  projectId: string;
  date: string;
  durationMinutes: number;
  description?: string;
  sentToStraTIME: boolean;
  sentAt?: string;
}

// ---------------------------------------------------------------------------
// Certification (structured, replaces string[] on User)
// ---------------------------------------------------------------------------
export interface Certification {
  id: string;
  name: string;
  issuingBody: string;
  dateObtained: string;
  expiryDate?: string;
  status: CertificationStatus;
  // Raw backend status (ACTIVE | EXPIRED | REVOKED) — REVOKED displays as
  // EXPIRED but must survive a load-edit-save round trip.
  backendStatus?: string;
  // Extended fields from the dedicated Certificates entity
  userId?: string;
  credentialId?: string;
  credentialUrl?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Ticket history event
// ---------------------------------------------------------------------------
export interface TicketEvent {
  id: string;
  timestamp: string;
  userId: string;
  action: 'CREATED' | 'STATUS_CHANGE' | 'ASSIGNED' | 'COMMENT' | 'PRIORITY_CHANGE' | 'EFFORT_CHANGE' | 'SENT_TO_TEST';
  fromValue?: string;
  toValue?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  skills: string[];
  certifications: Certification[];
  availabilityPercent: number;
  teamId?: string;
  avatarUrl?: string;
}

export interface Project {
  id: string;
  name: string;
  /** Project delivery mode */
  projectType?: ProjectDeliveryType;
  managerId: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  priority: Priority;
  description: string;
  progress?: number;
  complexity?: Complexity;
  techKeywords?: string[];
  documentation?: string;
  /** Manual project matrix mapping Ticket Nature + Complexity -> Hours */
  abaqueEstimate?: ProjectAbaqueRow[];
  /** Deprecated: Moved to standalone Wricef table */
  wricef?: never;
}

export interface Timesheet {
  id: string;
  userId: string;
  date: string;
  hours: number;
  projectId: string;
  ticketId?: string;
  comment?: string;
}

export interface Evaluation {
  id: string;
  userId: string;
  evaluatorId: string;
  /** Optional: ticket-based evaluations span all of a consultant's projects. */
  projectId?: string;
  period: string;
  score: number;
  /** Legacy qualitative grid; kept optional for backward compatibility. */
  qualitativeGrid?: {
    productivity: number;
    quality: number;
    autonomy: number;
    collaboration: number;
    innovation: number;
  };
  feedback: string;
  createdAt: string;
}

export interface Deliverable {
  id: string;
  projectId: string;
  ticketId?: string;
  type: string;
  name: string;
  url?: string;
  fileRef?: string;
  validationStatus: ValidationStatus;
  functionalComment?: string;
  createdBy?: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  /** Auto-generated unique Ticket ID (e.g. TK-2026-0001) */
  ticketCode: string;
  projectId: string;
  createdBy: string;
  assignedTo?: string;
  /** Role of the assigned person at assignment time (historical accuracy) */
  assignedToRole?: UserRole;
  status: TicketStatus;
  priority: Priority;
  /** Required nature/category of the ticket */
  nature: TicketNature;
  title: string;
  description: string;
  dueDate?: string;
  createdAt: string;
  updatedAt?: string;
  history: TicketEvent[];
  /** Manual effort hours logged by the consultant */
  effortHours: number;
  effortComment?: string;
  /** Optional functional tester */
  functionalTesterId?: string;
  /** Tags for search / AI matching */
  tags?: string[];
  /** WRICEF reference for the ticket */
  wricefId?: string | null;
  /** SAP module assignment */
  module?: SAPModule | null;
  /** Estimation / chiffrage in hours */
  estimationHours: number;
  /** Business complexity level */
  complexity: TicketComplexity;
  /** True when estimation was auto-calculated from project abaque */
  estimatedViaAbaque?: boolean;
  /** Optional two-way mapping to linked knowledge base docs */
  documentationObjectIds?: string[];
  /** Manager-allocated time budget (Feature 2) */
  allocatedHours?: number;
  /** Comment count for list views */
  commentCount?: number;
  /** Whether ticket has unresolved blockers */
  hasUnresolvedBlockers?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  targetPath?: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userRole: string;
  action: string; // CREATE, UPDATE, DELETE
  entityName: string;
  entityId: string;
  details: string;
}

export interface ProjectFeedback {
  id: string;
  projectId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReferenceData {
  id: string;
  type: 'TICKET_STATUS' | 'PRIORITY' | 'PROJECT_TYPE' | 'SKILL';
  code: string;
  label: string;
  active: boolean;
  order?: number;
}

export interface Allocation {
  id: string;
  userId: string;
  projectId: string;
  allocationPercent: number;
  startDate: string;
  endDate: string;
}

export interface LeaveRequest {
  id: string;
  consultantId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: LeaveStatus;
  managerId: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface KPI {
  projectProgress: number;
  ticketsOnTrack: number;
  ticketsLate: number;
  criticalTickets: number;
  averageProductivity: number;
  allocationRate: number;
  activeRisks: number;
}

// ---------------------------------------------------------------------------
// AI Dispatch – Assignee Recommendation
// ---------------------------------------------------------------------------

export interface AssigneeRecommendation {
  userId: string;
  userName: string;
  userRole: UserRole;
  score: number;
  /** Breakdown of scoring factors */
  factors: {
    availabilityScore: number;
    skillsMatchScore: number;
    performanceScore: number;
    similarTicketsScore: number;
  };
  explanation: string;
}

// ---------------------------------------------------------------------------
// Imputation – Bi-weekly time-entry object
// ---------------------------------------------------------------------------

export interface Imputation {
  id: string;
  /** The consultant who performed the work */
  consultantId: string;
  /** Linked ticket */
  ticketId: string;
  /** Linked project (denormalized for faster queries) */
  projectId: string;
  /** SAP module (denormalized from ticket) */
  module: SAPModule;
  /** Date the hours were worked */
  date: string;
  /** Hours worked */
  hours: number;
  /** Description of work done */
  description?: string;
  /** Validation status */
  validationStatus: ImputationValidationStatus;
  /** Bi-weekly period key, e.g. "2026-02-H1" or "2026-02-H2" */
  periodKey: string;
  /** ID of the validator (Chef de Projet / Manager) */
  validatedBy?: string;
  /** Validation timestamp */
  validatedAt?: string;
  /** Created at */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Imputation period – groups imputations for bi-weekly submission
// ---------------------------------------------------------------------------

export interface ImputationPeriod {
  id: string;
  /** e.g. "2026-02-H1" */
  periodKey: string;
  consultantId: string;
  /** Start date of the 15-day period */
  startDate: string;
  /** End date of the 15-day period */
  endDate: string;
  /** Overall validation status for this submission */
  status: ImputationValidationStatus;
  /** Total hours in the period */
  totalHours: number;
  /** Submitted at */
  submittedAt?: string;
  /** Validated by */
  validatedBy?: string;
  /** Validated at */
  validatedAt?: string;
  /** Sent to StraTIME / Stratime platform */
  sentToStraTIME?: boolean;
  /** User who sent the period to StraTIME */
  sentBy?: string;
  /** Send timestamp */
  sentAt?: string;
}
