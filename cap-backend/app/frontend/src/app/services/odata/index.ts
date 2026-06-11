// CAP OData v4 client – barrel re-export
// All types and config from core
export type {
  ODataClientConfig,
  ODataQueryOptions,
  ODataResponse,
  ODataSingleResponse,
  ODataError,
  ODataNormalizedError,
  ODataRequestOptions,
  ODataPagedResult,
  ODataListAllOptions,
  ODataRequestLogEvent,
} from './core';

export {
  getODataClientConfig,
  getODataAuthToken,
  setODataAuthToken,
  configureODataClient,
  onAuthExpired,
  listEntitiesPage,
  fetchNextPage,
  listAllPages,
  countEntities,
} from './core';

// Per-entity API modules
export { AuthAPI } from './authApi';
export { UsersAPI } from './usersApi';
export { ProjectsAPI } from './projectsApi';
export { TimesheetsAPI } from './timesheetsApi';
export { EvaluationsAPI } from './evaluationsApi';
export { DeliverablesAPI } from './deliverablesApi';
export { TicketsAPI } from './ticketsApi';
export { TicketCommentsAPI } from './ticketCommentsApi';
export { DocumentationAPI } from './documentationApi';
export { WricefsAPI } from './wricefsApi';
export { WricefObjectsAPI } from './wricefObjectsApi';
export { NotificationsAPI } from './notificationsApi';
export { ProjectFeedbackAPI } from './projectFeedbackApi';
export { ReferenceDataAPI } from './referenceDataApi';
export { AllocationsAPI } from './allocationsApi';
export { LeaveRequestsAPI } from './leaveRequestsApi';
export { TimeLogsAPI } from './timeLogsApi';
export { ImputationsAPI } from './imputationsApi';
export { ImputationPeriodsAPI } from './imputationPeriodsApi';
export { AuditLogsAPI } from './auditLogsApi';
export { CertificatesAPI } from './certificatesApi';
export type { CertificateDocument } from './certificatesApi';
