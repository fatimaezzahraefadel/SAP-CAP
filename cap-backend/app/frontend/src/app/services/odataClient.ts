/**
 * @deprecated odataClient.ts is a legacy compatibility shim.
 * All consumers have been migrated to import directly from services/odata/[entity]Api.ts
 * This file exists only as a safety net for future stragglers.
 * Do NOT add new imports here. Import directly from the odata/ modules instead.
 * @see services/odata/
 */

export type {
  User,
  Project,
  Timesheet,
  Evaluation,
  Deliverable,
  Ticket,
  Notification,
  ReferenceData,
  Allocation,
  LeaveRequest,
  TimeLog,
  Imputation,
  ImputationPeriod,
  DocumentationObject,
  Wricef,
  WricefObject,
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
} from './odata/core';

export {
  getODataClientConfig,
  getODataAuthToken,
  setODataAuthToken,
  onAuthExpired,
  configureODataClient,
  buildQueryString,
  normalizeEntityRecord,
  odataFetch,
  quoteLiteral,
  entityPath,
  unwrapSingle,
  listEntitiesPage,
  fetchNextPage,
  listAllPages,
  listEntities,
  countEntities,
  getEntityById,
  createEntity,
  updateEntity,
  deleteEntity,
} from './odata/core';

export { AuthAPI } from './odata/authApi';

export { AllocationsAPI } from './odata/allocationsApi';
export { DeliverablesAPI } from './odata/deliverablesApi';
export { DocumentationAPI } from './odata/documentationApi';
export { EvaluationsAPI } from './odata/evaluationsApi';
export { ImputationPeriodsAPI } from './odata/imputationPeriodsApi';
export { ImputationsAPI } from './odata/imputationsApi';
export { LeaveRequestsAPI } from './odata/leaveRequestsApi';
export { NotificationsAPI } from './odata/notificationsApi';
export { ProjectsAPI } from './odata/projectsApi';
export { ReferenceDataAPI } from './odata/referenceDataApi';
export { TicketsAPI } from './odata/ticketsApi';
export { TicketCommentsAPI } from './odata/ticketCommentsApi';
export { TimeLogsAPI } from './odata/timeLogsApi';
export { TimesheetsAPI } from './odata/timesheetsApi';
export { UsersAPI } from './odata/usersApi';
export { WricefObjectsAPI } from './odata/wricefObjectsApi';
export { WricefsAPI } from './odata/wricefsApi';
