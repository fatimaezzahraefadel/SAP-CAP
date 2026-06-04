namespace sap.performance.dashboard.db;

using { cuid, managed } from '@sap/cds/common';

// ---------------------------------------------------------------------------
// Enum Types
// ---------------------------------------------------------------------------
type TicketStatus     : String(20) enum { PENDING_APPROVAL; APPROVED; NEW; IN_PROGRESS; IN_TEST; BLOCKED; DONE; REJECTED; };
type CommentType      : String(20) enum { GENERAL; BLOCKER; QUESTION; UPDATE; FEEDBACK; };
type WricefStatus     : String(30) enum { DRAFT; PENDING_VALIDATION; VALIDATED; REJECTED; };
type ProjectStatus    : String(20) enum { PLANNED; ACTIVE; ON_HOLD; COMPLETED; CANCELLED; };
type Priority         : String(20) enum { LOW; MEDIUM; HIGH; CRITICAL; };
type RiskLevel        : String(20) enum { NONE; LOW; MEDIUM; HIGH; CRITICAL; };
type TicketComplexity : String(20) enum { SIMPLE; MOYEN; COMPLEXE; TRES_COMPLEXE; };
type TicketNature     : String(30) enum { WORKFLOW; FORMULAIRE; PROGRAMME; ENHANCEMENT; MODULE; REPORT; };
type SAPModule        : String(20) enum { FI; CO; MM; SD; PP; PM; QM; HR; PS; WM; BASIS; ABAP; FIORI; BW; OTHER; };
type ValidationStatus : String(20) enum { PENDING; APPROVED; CHANGES_REQUESTED; };
type ImputationStatus : String(20) enum { DRAFT; SUBMITTED; VALIDATED; REJECTED; };
type LeaveStatus      : String(20) enum { PENDING; APPROVED; REJECTED; };
type DeliverableValidation : String(30) enum { PENDING; APPROVED; CHANGES_REQUESTED; };
type UserRole         : String(40) enum { ADMIN; MANAGER; CONSULTANT_TECHNIQUE; CONSULTANT_FONCTIONNEL; PROJECT_MANAGER; DEV_COORDINATOR; };
type ProjectType      : String(20) enum { TMA; BUILD; };
type DocObjectType    : String(30) enum { SFD; GUIDE; ARCHITECTURE_DOC; GENERAL; };
type WricefType       : String(10) enum { W; R; I; C; E; F; };
type Complexity       : String(20) enum { LOW; MEDIUM; HIGH; CRITICAL; };

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
entity Users : cuid, managed {
  name               : String(100) not null;
  email              : String(150) not null;
  role               : UserRole    not null;
  active             : Boolean     default true;
  skills             : Composition of many UserSkills on skills.user = $self;
  certifications     : Composition of many UserCertifications on certifications.user = $self;
  availabilityPercent: Integer     default 100;
  teamId             : String(50);
  avatarUrl          : String(500);
}

entity UserSkills : cuid {
  user  : Association to Users;
  skill : String(100);
}

entity UserCertifications : cuid {
  user : Association to Users;
  name : String(200);
  date : Date;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
entity Projects : cuid, managed {
  name            : String(200) not null;
  projectType     : ProjectType;
  managerId       : String(50)  not null;
  manager         : Association to Users on manager.ID = managerId;
  startDate       : Date;
  endDate         : Date;
  status          : ProjectStatus default 'PLANNED';
  priority        : Priority      default 'MEDIUM';
  description     : String(10000);
  progress        : Integer       default 0;
  complexity      : Complexity;
  techKeywords    : Composition of many ProjectTechKeywords on techKeywords.project = $self;
  documentation   : String(10000);
  abaqueEstimate  : Composition of many ProjectAbaqueEstimates on abaqueEstimate.project = $self;
}

entity ProjectTechKeywords : cuid {
  project : Association to Projects;
  keyword : String(100);
}

entity ProjectAbaqueEstimates : cuid {
  project : Association to Projects;
  details : String(10000);
}

// ---------------------------------------------------------------------------
// WRICEFs
// ---------------------------------------------------------------------------
entity Wricefs : cuid, managed {
  projectId       : String(50) not null;
  sourceFileName  : String(200);
  importedAt      : DateTime;
  status          : WricefStatus default 'DRAFT';
  autoCreated     : Boolean     default false;
  rejectionReason : String(5000);
  submittedBy     : String(50);
  submittedAt     : DateTime;
}

entity WricefObjects : cuid, managed {
  wricefId                : String(50) not null;
  wricef                  : Association to Wricefs on wricef.ID = wricefId;
  projectId               : String(50) not null;
  project                 : Association to Projects on project.ID = projectId;
  type                    : WricefType       not null;
  title                   : String(200)      not null;
  description             : String(10000);
  complexity              : TicketComplexity default 'SIMPLE';
  module                  : SAPModule;
  status                  : WricefStatus default 'DRAFT';
  rejectionReason         : String(10000);
  documentationObjectIds  : Composition of many WricefDocumentationObjects on documentationObjectIds.wricefObject = $self;
}

entity WricefDocumentationObjects : cuid {
  wricefObject  : Association to WricefObjects;
  docObjectId   : String(50);
}

// ---------------------------------------------------------------------------
// Timesheets
// ---------------------------------------------------------------------------
/**
 * Legacy/simple daily hours per project.
 * No validation workflow.
 */
entity Timesheets : cuid, managed {
  userId    : String(50) not null;
  user      : Association to Users on user.ID = userId;
  date      : Date       not null;
  hours     : Decimal(4,2) default 0;
  projectId : String(50) not null;
  project   : Association to Projects on project.ID = projectId;
  ticketId  : String(50);
  ticket    : Association to Tickets on ticket.ID = ticketId;
  comment   : String(500);
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------
entity Evaluations : cuid, managed {
  userId          : String(50) not null;
  user            : Association to Users on user.ID = userId;
  evaluatorId     : String(50) not null;
  evaluator       : Association to Users on evaluator.ID = evaluatorId;
  projectId       : String(50) not null;
  project         : Association to Projects on project.ID = projectId;
  period          : String(20);
  score           : Decimal(4,2) default 0;
  qualitativeGrid : Composition of many EvaluationQualitativeGrids on qualitativeGrid.evaluation = $self;
  feedback        : String(10000);
}

entity EvaluationQualitativeGrids : cuid {
  evaluation : Association to Evaluations;
  criteria   : String(100);
  rating     : String(50);
}

// ---------------------------------------------------------------------------
// Deliverables
// ---------------------------------------------------------------------------
entity Deliverables : cuid, managed {
  projectId          : String(50) not null;
  project            : Association to Projects on project.ID = projectId;
  ticketId           : String(50);
  ticket             : Association to Tickets on ticket.ID = ticketId;
  type               : String(50);
  name               : String(200) not null;
  url                : String(500);
  fileRef            : String(500);
  validationStatus   : DeliverableValidation default 'PENDING';
  functionalComment  : String(10000);
}

// ---------------------------------------------------------------------------
// Tickets - PRIMARY DOMAIN
// ---------------------------------------------------------------------------
entity Tickets : cuid, managed {
  ticketCode              : String(30);
  projectId               : String(50)  not null;
  project                 : Association to Projects on project.ID = projectId;
  createdBy               : String(50)  not null;
  createdByUser           : Association to Users on createdByUser.ID = createdBy;
  assignedTo              : String(50);
  assignee                : Association to Users on assignee.ID = assignedTo;
  assignedToRole          : UserRole;
  status                  : TicketStatus     default 'NEW';
  priority                : Priority         default 'MEDIUM';
  nature                  : TicketNature     not null;
  title                   : String(200)      not null;
  description             : String(10000);
  dueDate                 : Date;
  effortHours             : Decimal(6,2)     default 0;
  effortComment           : String(500);
  functionalTesterId      : String(50);
  functionalTester        : Association to Users on functionalTester.ID = functionalTesterId;
  tags                    : Composition of many TicketTags on tags.ticket = $self;
  wricefId                : String(100);
  module                  : SAPModule;
  estimationHours         : Decimal(6,2)     default 0;
  complexity              : TicketComplexity default 'SIMPLE';
  estimatedViaAbaque      : Boolean          default false;
  documentationObjectIds  : Composition of many TicketDocumentationObjects on documentationObjectIds.ticket = $self;
  history                 : Composition of many TicketHistory on history.ticket = $self;
  comments                : Composition of many TicketComments on comments.ticket = $self;
  allocatedHours          : Decimal(6,2)     default 0;
  updatedAt               : DateTime;
}

entity TicketTags : cuid {
  ticket : Association to Tickets;
  tag    : String(100);
}

entity TicketDocumentationObjects : cuid {
  ticket      : Association to Tickets;
  docObjectId : String(50);
}

entity TicketHistory : cuid, managed {
  ticket : Association to Tickets;
  event  : String(100);
  details: String(10000);
}

// ---------------------------------------------------------------------------
// TicketComments – exchange thread per ticket (Features 1 & 5)
// ---------------------------------------------------------------------------
entity TicketComments : cuid, managed {
  ticket          : Association to Tickets;
  ticketId        : String(50) not null;
  authorId        : String(50) not null;
  author          : Association to Users on author.ID = authorId;
  message         : String(10000) not null;
  isInternal      : Boolean default false;
  commentType     : CommentType default 'GENERAL';
  parentCommentId : String(50);
  parentComment   : Association to TicketComments on parentComment.ID = parentCommentId;
  resolved        : Boolean default false;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
entity Notifications : cuid, managed {
  userId    : String(50) not null;
  user      : Association to Users on user.ID = userId;
  type      : String(50);
  title     : String(200);
  message   : String(10000);
  targetPath: String(500);
  read      : Boolean   default false;
}

// ---------------------------------------------------------------------------
// ProjectFeedback
// ---------------------------------------------------------------------------
entity ProjectFeedback : cuid, managed {
  projectId : String(50) not null;
  project   : Association to Projects on project.ID = projectId;
  authorId  : String(50) not null;
  author    : Association to Users on author.ID = authorId;
  content   : String(10000) not null;
}

// ---------------------------------------------------------------------------
// Allocations
// ---------------------------------------------------------------------------
entity Allocations : cuid, managed {
  userId            : String(50) not null;
  user              : Association to Users on user.ID = userId;
  projectId         : String(50) not null;
  project           : Association to Projects on project.ID = projectId;
  allocationPercent : Integer   default 0;
  startDate         : Date;
  endDate           : Date;
}

// ---------------------------------------------------------------------------
// LeaveRequests
// ---------------------------------------------------------------------------
entity LeaveRequests : cuid, managed {
  consultantId : String(50) not null;
  consultant   : Association to Users on consultant.ID = consultantId;
  startDate    : Date       not null;
  endDate      : Date       not null;
  reason       : String(500);
  status       : LeaveStatus default 'PENDING';
  managerId    : String(50) not null;
  manager      : Association to Users on manager.ID = managerId;
  reviewedAt   : DateTime;
}

// ---------------------------------------------------------------------------
// TimeLogs
// ---------------------------------------------------------------------------
/**
 * Granular per-ticket time entries.
 * Exportable to StraTIME.
 */
entity TimeLogs : cuid, managed {
  consultantId    : String(50) not null;
  consultant      : Association to Users on consultant.ID = consultantId;
  ticketId        : String(50) not null;
  ticket          : Association to Tickets on ticket.ID = ticketId;
  projectId       : String(50) not null;
  project         : Association to Projects on project.ID = projectId;
  date            : Date       not null;
  durationMinutes : Integer    default 0;
  description     : String(10000);
  sentToStraTIME  : Boolean    default false;
  sentAt          : DateTime;
}

// ---------------------------------------------------------------------------
// Imputations
// ---------------------------------------------------------------------------
/**
 * Formal time declarations with validation workflow.
 * DRAFT -> SUBMITTED -> VALIDATED, grouped by ImputationPeriods.
 */
entity Imputations : cuid, managed {
  consultantId      : String(50) not null;
  consultant        : Association to Users on consultant.ID = consultantId;
  ticketId          : String(50) not null;
  ticket            : Association to Tickets on ticket.ID = ticketId;
  projectId         : String(50) not null;
  project           : Association to Projects on project.ID = projectId;
  module            : SAPModule;
  date              : Date       not null;
  hours             : Decimal(4,2) default 0;
  description       : String(10000);
  validationStatus  : ImputationStatus default 'DRAFT';
  periodKey         : String(20) not null;
  validatedBy       : String(50);
  validatedAt       : DateTime;
}

// ---------------------------------------------------------------------------
// ImputationPeriods
// ---------------------------------------------------------------------------
entity ImputationPeriods : cuid, managed {
  periodKey      : String(20) not null;
  consultantId   : String(50) not null;
  consultant     : Association to Users on consultant.ID = consultantId;
  startDate      : Date       not null;
  endDate        : Date       not null;
  status         : ImputationStatus default 'DRAFT';
  totalHours     : Decimal(6,2) default 0;
  submittedAt    : DateTime;
  validatedBy    : String(50);
  validatedAt    : DateTime;
  sentToStraTIME : Boolean    default false;
  sentBy         : String(50);
  sentAt         : DateTime;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------

// DocumentationObjects
// ---------------------------------------------------------------------------
entity DocumentationObjects : cuid, managed {
  title            : String(200) not null;
  description      : String(10000);
  type             : DocObjectType default 'GENERAL';
  content          : String(10000);
  attachedFiles    : Composition of many DocAttachedFiles on attachedFiles.docObject = $self;
  relatedTicketIds : Composition of many DocRelatedTickets on relatedTicketIds.docObject = $self;
  projectId        : String(50)  not null;
  project          : Association to Projects on project.ID = projectId;
  authorId         : String(50)  not null;
  author           : Association to Users on author.ID = authorId;
  // createdAt is provided by `managed`; do not redeclare it here
  updatedAt        : DateTime;  // application-managed; updated by domain logic on PATCH
  sourceSystem     : String(20);
  sourceRefId      : String(200);
}

entity DocAttachedFiles : cuid {
  docObject : Association to DocumentationObjects;
  fileName  : String(200);
  fileUrl   : String(500);
  fileSize  : Integer;
}

entity DocRelatedTickets : cuid {
  docObject : Association to DocumentationObjects;
  ticketId  : String(50);
}

// ---------------------------------------------------------------------------
// Attachments - central entity for file lifecycle
// ---------------------------------------------------------------------------
entity Attachments : cuid, managed {
  parentType      : String(40) not null; // e.g. TICKET, DOCUMENT, DELIVERABLE, COMMENT
  parentId        : String(50) not null;
  fileName        : String(255) not null; // sanitized storage filename
  originalName    : String(255) not null; // original uploaded name
  content         : LargeBinary; // file bytes stored in-DB; served via /attachments/:id
  mimeType        : String(120) not null;
  sizeBytes       : Integer not null;
  storageKey      : String(500) not null; // opaque storage key (not physical path)
  checksumSha256  : String(64);
  uploadedBy      : String(50) not null;
  status          : String(20) default 'ACTIVE'; // ACTIVE | DELETED | ORPHANED
  deletedAt       : DateTime;
  deletedBy       : String(50);
}

// ---------------------------------------------------------------------------
// ReferenceData
// ---------------------------------------------------------------------------
entity ReferenceData : cuid, managed {
  type   : String(30) not null;
  code   : String(50) not null;
  label  : String(100);
  active : Boolean    default true;
  order  : Integer;
}

// ---------------------------------------------------------------------------
// AuditLogs – immutable record of all CUD operations
// ---------------------------------------------------------------------------
entity AuditLogs : cuid {
  timestamp  : DateTime not null;
  userId     : String(50);
  userRole   : String(40);
  action     : String(10) not null;       // CREATE, UPDATE, DELETE
  entityName : String(100) not null;
  entityId   : String(50);
  details    : String(10000);               // JSON diff / summary
}
