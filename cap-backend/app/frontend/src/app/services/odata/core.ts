// CAP OData v4 client – shared infrastructure (config, fetch, CRUD helpers, types)

import type {
  User,
  Project,
  Timesheet,
  Evaluation,
  Deliverable,
  Ticket,
  TicketComment,
  Notification,
  ProjectFeedback,
  ReferenceData,
  Allocation,
  LeaveRequest,
  TimeLog,
  Imputation,
  ImputationPeriod,
  DocumentationObject,
  Wricef,
  WricefObject,
} from '../../types/entities';

// Re-export entity types so per-API modules need only import from core
export type {
  User,
  Project,
  Timesheet,
  Evaluation,
  Deliverable,
  Ticket,
  TicketComment,
  Notification,
  ProjectFeedback,
  ReferenceData,
  Allocation,
  LeaveRequest,
  TimeLog,
  Imputation,
  ImputationPeriod,
  DocumentationObject,
  Wricef,
  WricefObject,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export type ODataService = 'core' | 'user' | 'ticket' | 'time' | 'consultant' | 'manager';

const FALLBACK_BASE = import.meta.env.VITE_ODATA_BASE_URL ? import.meta.env.VITE_ODATA_BASE_URL.replace(/\/performance\/?$/, '') : '/odata/v4';

const ODATA_SERVICES: Record<ODataService, string> = {
  core: import.meta.env.VITE_ODATA_CORE_URL || `${FALLBACK_BASE}/core`,
  user: import.meta.env.VITE_ODATA_USER_URL || `${FALLBACK_BASE}/user`,
  ticket: import.meta.env.VITE_ODATA_TICKET_URL || `${FALLBACK_BASE}/ticket`,
  time: import.meta.env.VITE_ODATA_TIME_URL || `${FALLBACK_BASE}/time`,
  consultant: import.meta.env.VITE_ODATA_CONSULTANT_URL || `${FALLBACK_BASE}/consultant`,
  manager: import.meta.env.VITE_ODATA_MANAGER_URL || `${FALLBACK_BASE}/manager`,
};

const ODATA_OBSERVABILITY_ENABLED = import.meta.env.VITE_ODATA_OBSERVABILITY === 'true';
const ODATA_AUTH_TOKEN_STORAGE_KEY = 'odata.auth.token';
const ODATA_TEST_USER_STORAGE_KEY = 'odata.test.user';
const JWT_EXPIRY_SKEW_SECONDS = 30;

export interface ODataClientConfig {
  credentials: RequestCredentials;
  csrf: {
    enabled: boolean;
    headerName: string;
  };
  observability: {
    enabled: boolean;
    requestIdHeader: string;
    logger?: (event: ODataRequestLogEvent) => void;
  };
}

let odataClientConfig: ODataClientConfig = {
  credentials: 'same-origin',
  csrf: {
    enabled: false,
    headerName: 'x-csrf-token',
  },
  observability: {
    enabled: ODATA_OBSERVABILITY_ENABLED,
    requestIdHeader: 'x-request-id',
    logger: ODATA_OBSERVABILITY_ENABLED
      ? (event) => {
          console.debug('[ODataClient]', event);
        }
      : undefined,
  },
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const segments = token.split('.');
  if (segments.length < 2) return null;

  try {
    const payloadSegment = segments[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(segments[1].length / 4) * 4, '=');
    const payload = atob(payloadSegment);
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const isTokenExpired = (
  token: string | null | undefined,
  skewSeconds = JWT_EXPIRY_SKEW_SECONDS
): boolean => {
  const normalized = token?.trim();
  if (!normalized) return true;

  const payload = decodeJwtPayload(normalized);
  const expRaw = payload?.exp;
  if (typeof expRaw !== 'number') return false;
  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  return expRaw <= nowEpochSeconds + Math.max(0, skewSeconds);
};

const readStoredAuthToken = (): string | null => {
  try {
    const token = localStorage.getItem(ODATA_AUTH_TOKEN_STORAGE_KEY);
    const normalized = token && token.trim() ? token : null;
    if (!normalized) return null;
    if (isTokenExpired(normalized)) {
      localStorage.removeItem(ODATA_AUTH_TOKEN_STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
};

const persistAuthToken = (token: string | null): void => {
  try {
    if (token) localStorage.setItem(ODATA_AUTH_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(ODATA_AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
};

let odataAuthToken: string | null = readStoredAuthToken();

/**
 * @description Returns the current effective OData client runtime configuration.
 * @param {void} _unused - This function does not accept arguments.
 * @returns {ODataClientConfig} The active configuration object used for outgoing OData requests.
 * @throws {never} This accessor does not throw.
 * @example const config = getODataClientConfig();
 */
export const getODataClientConfig = (): ODataClientConfig => odataClientConfig;
/**
 * @description Returns the currently cached OData bearer token, if one is set.
 * @param {void} _unused - This function does not accept arguments.
 * @returns {string | null} The current authentication token or `null` when no token is configured.
 * @throws {never} This accessor does not throw.
 * @example const token = getODataAuthToken();
 */
export const getODataAuthToken = (): string | null => odataAuthToken;

/**
 * @description Updates the in-memory and persisted OData bearer token used for authorization headers.
 * @param {string | null} token - The bearer token to store, or `null` to clear authentication state.
 * @returns {void} No return value.
 * @throws {never} Storage errors are internally swallowed.
 * @example setODataAuthToken(session.token);
 */
export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

let testUser: TestUser | null = null;

const readStoredTestUser = (): TestUser | null => {
  try {
    const data = localStorage.getItem(ODATA_TEST_USER_STORAGE_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
    if (parsed && parsed.id && parsed.email && parsed.name && parsed.role) {
      return parsed as TestUser;
    }
    return null;
  } catch {
    return null;
  }
};

const persistTestUser = (user: TestUser | null): void => {
  try {
    if (user) localStorage.setItem(ODATA_TEST_USER_STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(ODATA_TEST_USER_STORAGE_KEY);
  } catch {
    // ignore storage failures
  }
};

testUser = readStoredTestUser();

export const getTestUser = (): TestUser | null => testUser;

export const setTestUser = (user: TestUser | null): void => {
  testUser = user;
  persistTestUser(user);
};

export const setODataAuthToken = (token: string | null): void => {
  const normalized = token?.trim() || null;
  odataAuthToken = normalized;
  persistAuthToken(normalized);
};

// ---------------------------------------------------------------------------
// Token expiry / 401 event bus
// ---------------------------------------------------------------------------

type AuthExpiredListener = () => void;
const authExpiredListeners = new Set<AuthExpiredListener>();

/** Register a callback invoked when the server returns 401 (token expired/invalid). */
/**
 * @description Registers a callback executed whenever the client detects a 401 authentication failure.
 * @param {AuthExpiredListener} listener - Callback to run when authentication expires.
 * @returns {() => void} An unsubscribe function that removes the registered listener.
 * @throws {never} This registration helper does not throw.
 * @example const off = onAuthExpired(() => setODataAuthToken(null));
 */
export const onAuthExpired = (listener: AuthExpiredListener): (() => void) => {
  authExpiredListeners.add(listener);
  return () => { authExpiredListeners.delete(listener); };
};

const notifyAuthExpired = (): void => {
  authExpiredListeners.forEach((listener) => {
    try { listener(); } catch { /* listener errors should not break the client */ }
  });
};

/**
 * @description Merges partial runtime options into the current OData client configuration.
 * @param {Partial<ODataClientConfig>} config - Partial configuration values to apply.
 * @returns {void} No return value.
 * @throws {never} This mutator does not throw.
 * @example configureODataClient({ observability: { enabled: true } });
 */
export const configureODataClient = (config: Partial<ODataClientConfig>): void => {
  odataClientConfig = {
    ...odataClientConfig,
    ...config,
    csrf: {
      ...odataClientConfig.csrf,
      ...(config.csrf ?? {}),
    },
    observability: {
      ...odataClientConfig.observability,
      ...(config.observability ?? {}),
    },
  };
};

// ---------------------------------------------------------------------------
// OData types
// ---------------------------------------------------------------------------

export interface ODataQueryOptions {
  $filter?: string;
  $select?: string;
  $expand?: string;
  $orderby?: string;
  $top?: number;
  $skip?: number;
  $count?: boolean;
  $search?: string;
}

export interface ODataResponse<T> {
  '@odata.context'?: string;
  '@odata.count'?: number;
  '@odata.nextLink'?: string;
  value: T[];
}

export interface ODataSingleResponse<T> {
  '@odata.context'?: string;
  '@odata.etag'?: string;
  value?: T;
}

type ODataRawMessage =
  | string
  | {
      lang?: string;
      value?: string;
      message?: string;
    };

interface ODataRawDetail {
  code?: string | number;
  message?: ODataRawMessage;
  target?: string;
  severity?: string;
}

interface ODataRawErrorPayload {
  code?: string | number;
  message?: ODataRawMessage;
  target?: string;
  details?: ODataRawDetail[];
  innererror?: {
    errordetails?: ODataRawDetail[];
    details?: ODataRawDetail[];
    message?: ODataRawMessage;
    originalMessage?: ODataRawMessage;
    cause?: unknown;
  };
}

export interface ODataError {
  error?: ODataRawErrorPayload;
  code?: string | number;
  message?: ODataRawMessage;
  details?: ODataRawDetail[];
  target?: string;
  innererror?: ODataRawErrorPayload['innererror'];
}

export interface ODataNormalizedError {
  name: 'ODataClientError';
  message: string;
  status: number;
  statusText: string;
  code: string;
  target?: string;
  details: Array<{
    code: string;
    message: string;
    target?: string;
  }>;
  isAbort: boolean;
  endpoint: string;
  requestId?: string;
}

export interface ODataRequestOptions extends RequestInit {
  timeoutMs?: number;
  ifMatch?: string;
  requestId?: string;
}

export interface ODataPagedResult<T> {
  items: T[];
  count?: number;
  nextLink?: string;
}

export interface ODataListAllOptions {
  maxPages?: number;
}

export interface ODataRequestLogEvent {
  stage: 'request' | 'response' | 'error';
  requestId: string;
  endpoint: string;
  method: string;
  status?: number;
  durationMs?: number;
  message?: string;
  errorCode?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * @description Builds a URL-encoded OData query string from optional query options.
 * @param {ODataQueryOptions | undefined} options - OData query options such as `$filter`, `$top`, and `$orderby`.
 * @returns {string} A query string beginning with `?`, or an empty string when no options are provided.
 * @throws {never} This formatter does not throw.
 * @example const qs = buildQueryString({ $top: 20, $count: true });
 */
export function buildQueryString(options?: ODataQueryOptions): string {
  if (!options) return '';

  const params: Array<[string, string]> = [];
  if (options.$filter) params.push(['$filter', options.$filter]);
  if (options.$select) params.push(['$select', options.$select]);
  if (options.$expand) params.push(['$expand', options.$expand]);
  if (options.$orderby) params.push(['$orderby', options.$orderby]);
  if (options.$top !== undefined) params.push(['$top', options.$top.toString()]);
  if (options.$skip !== undefined) params.push(['$skip', options.$skip.toString()]);
  if (options.$count) params.push(['$count', 'true']);
  if (options.$search) params.push(['$search', options.$search]);

  const queryString = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return queryString ? `?${queryString}` : '';
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

/**
 * @description Normalizes a CAP/OData entity record by mapping common backend field aliases to frontend names.
 * @param {T} value - The entity record to normalize.
 * @returns {T} The normalized entity record with compatibility fields (`ID` -> `id`, `modifiedAt` -> `updatedAt`).
 * @throws {never} This normalization utility does not throw.
 * @example const normalized = normalizeEntityRecord(rawTicket);
 */
export const normalizeEntityRecord = <T>(value: T): T => {
  const record = asRecord(value);
  if (!record) return value;

  const normalized = { ...record };
  if ('ID' in record && !('id' in record)) {
    normalized.id = record.ID;
  }
  if ('modifiedAt' in record && !('updatedAt' in record)) {
    normalized.updatedAt = record.modifiedAt;
  }

  return normalized as T;
};

const normalizeEntityArray = <T>(items: T[]): T[] => items.map((item) => normalizeEntityRecord(item));

const toODataEntityPayload = (payload: unknown): unknown => {
  const record = asRecord(payload);
  if (!record) return payload;

  const normalized = { ...record };
  if ('id' in record && !('ID' in record)) {
    normalized.ID = record.id;
    delete normalized.id;
  }
  if ('updatedAt' in record && !('modifiedAt' in record)) {
    normalized.modifiedAt = record.updatedAt;
    delete normalized.updatedAt;
  }

  return normalized;
};

const toRawMessage = (value: unknown): ODataRawMessage | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  const record = asRecord(value);
  if (!record) return undefined;
  const message = typeof record.message === 'string' ? record.message : undefined;
  const nestedValue = typeof record.value === 'string' ? record.value : undefined;
  const lang = typeof record.lang === 'string' ? record.lang : undefined;
  if (!message && !nestedValue && !lang) return undefined;
  return {
    ...(lang ? { lang } : {}),
    ...(nestedValue ? { value: nestedValue } : {}),
    ...(message ? { message } : {}),
  };
};

const toRawDetail = (value: unknown): ODataRawDetail | null => {
  const record = asRecord(value);
  if (!record) return null;
  return {
    ...(typeof record.code === 'string' || typeof record.code === 'number'
      ? { code: record.code }
      : {}),
    ...(toRawMessage(record.message) ? { message: toRawMessage(record.message) } : {}),
    ...(typeof record.target === 'string' ? { target: record.target } : {}),
    ...(typeof record.severity === 'string' ? { severity: record.severity } : {}),
  };
};

const toRawDetailArray = (value: unknown): ODataRawDetail[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toRawDetail(item))
    .filter((item): item is ODataRawDetail => Boolean(item));
};

function normalizeODataError(input: {
  endpoint: string;
  status?: number;
  statusText?: string;
  code?: string;
  message?: string;
  target?: string;
  details?: Array<{ code: string; message: string; target?: string }>;
  isAbort?: boolean;
  requestId?: string;
}): ODataNormalizedError {
  return {
    name: 'ODataClientError',
    message: input.message ?? 'OData request failed',
    status: input.status ?? 0,
    statusText: input.statusText ?? '',
    code: input.code ?? 'UNKNOWN',
    target: input.target,
    details: input.details ?? [],
    isAbort: Boolean(input.isAbort),
    endpoint: input.endpoint,
    requestId: input.requestId,
  };
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Unknown error';
}

function extractODataMessage(message: ODataRawMessage | undefined): string | undefined {
  if (!message) return undefined;
  if (typeof message === 'string') return message;
  if (typeof message.value === 'string') return message.value;
  if (typeof message.message === 'string') return message.message;
  return undefined;
}

function normalizeODataDetails(details: ODataRawDetail[] | undefined): Array<{
  code: string;
  message: string;
  target?: string;
}> {
  if (!details || details.length === 0) return [];

  const normalized: Array<{ code: string; message: string; target?: string }> = [];
  details.forEach((detail) => {
    const message = extractODataMessage(detail.message);
    if (!message) return;

    normalized.push({
      code: String(detail.code ?? 'DETAIL'),
      message,
      ...(detail.target ? { target: detail.target } : {}),
    });
  });

  return normalized;
}

function pickODataErrorPayload(payload: unknown): ODataRawErrorPayload {
  const root = asRecord(payload);
  if (!root) return {};

  const nestedError =
    asRecord(root.error)?.error && asRecord(asRecord(root.error)?.error)
      ? asRecord(asRecord(root.error)?.error)
      : asRecord(root.error);

  const source = nestedError ?? root;
  const innererrorRecord = asRecord(source.innererror);

  const messageCandidate =
    toRawMessage(source.message) ??
    toRawMessage(source.error_description) ??
    toRawMessage(innererrorRecord?.message) ??
    toRawMessage(innererrorRecord?.originalMessage);

  return {
    ...(typeof source.code === 'string' || typeof source.code === 'number'
      ? { code: source.code }
      : {}),
    ...(messageCandidate ? { message: messageCandidate } : {}),
    ...(typeof source.target === 'string' ? { target: source.target } : {}),
    details: toRawDetailArray(source.details),
    innererror: innererrorRecord
      ? {
          errordetails: toRawDetailArray(innererrorRecord.errordetails),
          details: toRawDetailArray(innererrorRecord.details),
          ...(toRawMessage(innererrorRecord.message)
            ? { message: toRawMessage(innererrorRecord.message) }
            : {}),
          ...(toRawMessage(innererrorRecord.originalMessage)
            ? { originalMessage: toRawMessage(innererrorRecord.originalMessage) }
            : {}),
          ...(innererrorRecord.cause !== undefined ? { cause: innererrorRecord.cause } : {}),
        }
      : undefined,
  };
}

const createRequestId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

const reportRequestEvent = (event: ODataRequestLogEvent): void => {
  if (!odataClientConfig.observability.enabled) return;
  odataClientConfig.observability.logger?.(event);
};

function combineAbortSignals(
  externalSignal?: AbortSignal | null,
  timeoutMs?: number
): { signal?: AbortSignal; cleanup: () => void } {
  if (!externalSignal && !timeoutMs) {
    return { signal: undefined, cleanup: () => undefined };
  }

  const controller = new AbortController();
  const cleanups: Array<() => void> = [];

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      const onAbort = () => controller.abort();
      externalSignal.addEventListener('abort', onAbort, { once: true });
      cleanups.push(() => externalSignal.removeEventListener('abort', onAbort));
    }
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs && timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      cleanups.forEach((cleanup) => cleanup());
      if (timeoutId) clearTimeout(timeoutId);
    },
  };
}

async function parseODataErrorResponse(
  response: Response,
  endpoint: string,
  requestId?: string
): Promise<ODataNormalizedError> {
  const rawBody = await response.text();
  if (!rawBody) {
    return normalizeODataError({
      endpoint,
      status: response.status,
      statusText: response.statusText,
      code: String(response.status),
      message: response.statusText || 'OData request failed',
      requestId,
    });
  }

  let payload: unknown = null;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return normalizeODataError({
      endpoint,
      status: response.status,
      statusText: response.statusText,
      code: String(response.status),
      message: rawBody || response.statusText || 'OData request failed',
      requestId,
    });
  }

  const errorPayload = pickODataErrorPayload(payload);
  const details = normalizeODataDetails([
    ...(errorPayload.details ?? []),
    ...(errorPayload.innererror?.errordetails ?? []),
    ...(errorPayload.innererror?.details ?? []),
  ]);
  const messageFromPayload =
    extractODataMessage(errorPayload.message) ||
    extractODataMessage(errorPayload.innererror?.message) ||
    extractODataMessage(errorPayload.innererror?.originalMessage);
  const fallbackMessage = details[0]?.message || response.statusText || 'OData request failed';

  return normalizeODataError({
    endpoint,
    status: response.status,
    statusText: response.statusText,
    code: String(errorPayload.code ?? response.status),
    message: messageFromPayload ?? fallbackMessage,
    target: errorPayload.target,
    details,
    requestId,
  });
}

// ---------------------------------------------------------------------------
// Core fetch
// ---------------------------------------------------------------------------

/**
 * @description Executes an HTTP request against the configured OData endpoint and normalizes transport/protocol errors.
 * @param {string} endpoint - Relative OData endpoint path (for example `/Tickets` or `/Projects('p1')`).
 * @param {ODataRequestOptions | undefined} options - Request init options including timeout, headers, and credentials.
 * @returns {Promise<T | undefined>} Parsed JSON payload when present, otherwise `undefined` for empty responses (204/205).
 * @throws {ODataNormalizedError} Throws normalized client errors for HTTP failures, aborted requests, and network errors.
 * @example const data = await odataFetch<ODataResponse<Ticket>>('/Tickets?$top=10');
 */
export async function odataFetch<T>(
  serviceName: ODataService,
  endpoint: string,
  options?: ODataRequestOptions
): Promise<T | undefined> {
  const {
    timeoutMs,
    ifMatch,
    requestId: requestIdOverride,
    headers,
    signal,
    credentials,
    ...requestInit
  } = options ?? {};
  const { signal: combinedSignal, cleanup } = combineAbortSignals(signal, timeoutMs);
  const requestId = requestIdOverride ?? createRequestId();
  const method = (requestInit.method ?? 'GET').toUpperCase();

  const requestHeaders = new Headers({
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers ?? {}),
  });

  if (ifMatch) {
    requestHeaders.set('If-Match', ifMatch);
  }

  if (testUser) {
    console.log('[core.ts] Adding test user headers:', testUser);
    requestHeaders.set('x-test-user-id', testUser.id);
    requestHeaders.set('x-test-user-email', testUser.email);
    requestHeaders.set('x-test-user-name', testUser.name);
    requestHeaders.set('x-test-user-role', testUser.role);
  }

  if (!requestHeaders.has('Authorization') && odataAuthToken) {
    requestHeaders.set('Authorization', `Bearer ${odataAuthToken}`);
  }

  if (odataClientConfig.observability.enabled && odataClientConfig.observability.requestIdHeader) {
    requestHeaders.set(odataClientConfig.observability.requestIdHeader, requestId);
  }

  // TODO: CSRF placeholder only (intentionally not implemented in frontend yet).
  // if (odataClientConfig.csrf.enabled) {}
  const startedAt = Date.now();
  reportRequestEvent({
    stage: 'request',
    requestId,
    endpoint,
    method,
  });

  try {
    const baseUrl = ODATA_SERVICES[serviceName];
    const response = await fetch(`${baseUrl}${endpoint}`, {
      ...requestInit,
      signal: combinedSignal,
      credentials: credentials ?? odataClientConfig.credentials,
      headers: requestHeaders,
    });

    const durationMs = Date.now() - startedAt;
    if (!response.ok) {
      // Detect expired/invalid token and notify listeners before throwing
      if (response.status === 401) {
        notifyAuthExpired();
      }
      throw await parseODataErrorResponse(response, endpoint, requestId);
    }

    reportRequestEvent({
      stage: 'response',
      requestId,
      endpoint,
      method,
      status: response.status,
      durationMs,
    });

    if (response.status === 204 || response.status === 205) {
      return undefined;
    }

    const raw = await response.text();
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as ODataNormalizedError)?.name === 'ODataClientError') {
      const normalized = error as ODataNormalizedError;
      reportRequestEvent({
        stage: 'error',
        requestId,
        endpoint,
        method,
        status: normalized.status || undefined,
        durationMs: Date.now() - startedAt,
        errorCode: normalized.code,
        message: normalized.message,
      });
      throw error;
    }

    if (
      error instanceof DOMException &&
      error.name === 'AbortError'
    ) {
      const normalized = normalizeODataError({
        endpoint,
        code: 'ABORTED',
        message: 'Request aborted',
        isAbort: true,
        requestId,
      });
      reportRequestEvent({
        stage: 'error',
        requestId,
        endpoint,
        method,
        durationMs: Date.now() - startedAt,
        errorCode: normalized.code,
        message: normalized.message,
      });
      throw normalized;
    }

    const normalized = normalizeODataError({
      endpoint,
      code: 'NETWORK_ERROR',
      message: asErrorMessage(error),
      requestId,
    });
    reportRequestEvent({
      stage: 'error',
      requestId,
      endpoint,
      method,
      durationMs: Date.now() - startedAt,
      errorCode: normalized.code,
      message: normalized.message,
    });
    throw normalized;
  } finally {
    cleanup();
  }
}

// ---------------------------------------------------------------------------
// Generic helpers (used by per-entity modules)
// ---------------------------------------------------------------------------

const isNotFoundError = (error: unknown): boolean => {
  const status = (error as ODataNormalizedError)?.status;
  if (typeof status === 'number' && status === 404) return true;
  if (!(error instanceof Error)) return false;
  return /\b404\b/i.test(error.message) || /not found/i.test(error.message);
};

/**
 * @description Escapes and wraps a string value as an OData single-quoted literal.
 * @param {string} value - Raw literal value to escape for OData keys and filters.
 * @returns {string} An escaped OData string literal.
 * @throws {never} This utility does not throw.
 * @example const literal = quoteLiteral(\"A'B\");
 */
export const quoteLiteral = (value: string): string => `'${value.replace(/'/g, "''")}'`;
/**
 * @description Builds an OData entity path for a given entity set and identifier.
 * @param {string} entitySet - OData entity set name.
 * @param {string} id - Entity identifier to include in the path.
 * @returns {string} A formatted OData path (for example `/Tickets('TK-001')`).
 * @throws {never} This utility does not throw.
 * @example const path = entityPath('Tickets', 'TK-001');
 */
export const entityPath = (entitySet: string, id: string): string => `/${entitySet}(${quoteLiteral(id)})`;

/**
 * @description Unwraps a plain entity or single-response wrapper and normalizes common CAP field aliases.
 * @param {T | ODataSingleResponse<T> | undefined} data - Raw entity payload or wrapper returned by OData fetch helpers.
 * @returns {T | null} A normalized entity record, or `null` when no payload is present.
 * @throws {never} This utility does not throw.
 * @example const project = unwrapSingle<Project>(payload);
 */
export function unwrapSingle<T>(data: T | ODataSingleResponse<T> | undefined): T | null {
  if (!data) return null;
  if (typeof data === 'object' && data !== null && 'value' in data) {
    const wrapped = data as ODataSingleResponse<T>;
    return wrapped.value ? normalizeEntityRecord(wrapped.value) : null;
  }
  return normalizeEntityRecord(data as T);
}

function toPagedResult<T>(data: ODataResponse<T> | T[] | undefined): ODataPagedResult<T> {
  if (!data) return { items: [] };
  if (Array.isArray(data)) return { items: normalizeEntityArray(data) };
  return {
    items: Array.isArray(data.value) ? normalizeEntityArray(data.value) : [],
    count: data['@odata.count'],
    nextLink: data['@odata.nextLink'],
  };
}

/**
 * @description Fetches one OData page for an entity set with optional query options.
 * @param {string} entitySet - OData entity set name to query.
 * @param {ODataQueryOptions | undefined} options - OData query parameters for filtering, sorting, and paging.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @returns {Promise<ODataPagedResult<T>>} A normalized page with items, optional count, and optional nextLink.
 * @throws {ODataNormalizedError} Throws when the request fails or returns a non-success HTTP status.
 * @example const page = await listEntitiesPage<Ticket>('Tickets', { $top: 20, $count: true });
 */
export async function listEntitiesPage<T>(
  serviceName: ODataService,
  entitySet: string,
  options?: ODataQueryOptions,
  requestOptions?: ODataRequestOptions
): Promise<ODataPagedResult<T>> {
  const data = await odataFetch<ODataResponse<T> | T[]>(serviceName, `/${entitySet}${buildQueryString(options)}`, requestOptions);
  return toPagedResult(data);
}

const resolveNextLinkEndpoint = (nextLink: string, serviceName: ODataService): string => {
  const ensureLeadingSlash = (path: string): string => (path.startsWith('/') ? path : `/${path}`);
  const baseUrl = ODATA_SERVICES[serviceName];

  if (nextLink.startsWith('http://') || nextLink.startsWith('https://')) {
    const url = new URL(nextLink);
    const withQuery = `${url.pathname}${url.search}${url.hash}`;
    if (withQuery.startsWith(baseUrl)) {
      return ensureLeadingSlash(withQuery.slice(baseUrl.length));
    }
    return ensureLeadingSlash(withQuery);
  }

  if (nextLink.startsWith(baseUrl)) {
    return ensureLeadingSlash(nextLink.slice(baseUrl.length));
  }

  if (nextLink.startsWith('/')) {
    return nextLink;
  }

  if (nextLink.startsWith('?')) {
    return `/${nextLink}`;
  }

  return ensureLeadingSlash(nextLink);
};

/**
 * @description Fetches a continuation page from a previously returned `@odata.nextLink` value.
 * @param {string} nextLink - Next-link URL or relative path returned by OData pagination.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @returns {Promise<ODataPagedResult<T>>} A normalized continuation page.
 * @throws {ODataNormalizedError} Throws when the continuation request fails.
 * @example const next = await fetchNextPage<Ticket>(page.nextLink!, { timeoutMs: 8000 });
 */
export async function fetchNextPage<T>(
  serviceName: ODataService,
  nextLink: string,
  requestOptions?: ODataRequestOptions
): Promise<ODataPagedResult<T>> {
  const endpoint = resolveNextLinkEndpoint(nextLink, serviceName);
  const data = await odataFetch<ODataResponse<T> | T[]>(serviceName, endpoint, requestOptions);
  return toPagedResult(data);
}

/**
 * @description Iterates through paginated OData results and aggregates pages up to exhaustion or `maxPages`.
 * @param {string} entitySet - OData entity set name to query.
 * @param {ODataQueryOptions | undefined} options - OData query options applied to the first page request.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @param {ODataListAllOptions | undefined} listAllOptions - Pagination guard options such as `maxPages`.
 * @returns {Promise<ODataPagedResult<T>>} Aggregated normalized items with final count and nextLink metadata.
 * @throws {ODataNormalizedError} Throws when any page request fails.
 * @example const allProjects = await listAllPages<Project>('Projects', { $orderby: 'name asc' });
 */
export async function listAllPages<T>(
  serviceName: ODataService,
  entitySet: string,
  options?: ODataQueryOptions,
  requestOptions?: ODataRequestOptions,
  listAllOptions?: ODataListAllOptions
): Promise<ODataPagedResult<T>> {
  const maxPages = Math.max(1, listAllOptions?.maxPages ?? 100);
  const firstPage = await listEntitiesPage<T>(serviceName, entitySet, options, requestOptions);
  const items = [...firstPage.items];
  let count = firstPage.count;
  let nextLink = firstPage.nextLink;
  let pageCount = 1;
  const seenLinks = new Set<string>();

  while (nextLink && pageCount < maxPages) {
    if (seenLinks.has(nextLink)) break;
    seenLinks.add(nextLink);
    const page = await fetchNextPage<T>(serviceName, nextLink, requestOptions);
    items.push(...page.items);
    if (typeof page.count === 'number') {
      count = page.count;
    }
    nextLink = page.nextLink;
    pageCount += 1;
  }

  return {
    items,
    count,
    nextLink,
  };
}

/**
 * @description Lists entities from an OData set, optionally aggregating all pages.
 * @param {string} entitySet - OData entity set name to query.
 * @param {ODataQueryOptions | undefined} options - OData query options for filtering, sorting, and paging.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @param {boolean} fetchAllPages - Whether to fetch every paginated page before returning.
 * @returns {Promise<T[]>} A normalized array of entities.
 * @throws {ODataNormalizedError} Throws when page retrieval fails.
 * @example const tickets = await listEntities<Ticket>('Tickets', { $filter: \"status eq 'NEW'\" }, undefined, true);
 */
export async function listEntities<T>(
  serviceName: ODataService,
  entitySet: string,
  options?: ODataQueryOptions,
  requestOptions?: ODataRequestOptions,
  fetchAllPages = false
): Promise<T[]> {
  if (fetchAllPages) {
    const pages = await listAllPages<T>(serviceName, entitySet, options, requestOptions);
    return pages.items;
  }

  const page = await listEntitiesPage<T>(serviceName, entitySet, options, requestOptions);
  return page.items;
}

/**
 * @description Returns the count of entities in a set, optionally filtered by an OData expression.
 * @param {string} entitySet - OData entity set name to count.
 * @param {string | undefined} filter - Optional OData `$filter` expression to limit counted records.
 * @returns {Promise<number>} The matching entity count.
 * @throws {ODataNormalizedError} Throws when the count request fails.
 * @example const blocked = await countEntities('Tickets', \"status eq 'BLOCKED'\");
 */
export async function countEntities(serviceName: ODataService, entitySet: string, filter?: string): Promise<number> {
  const page = await listEntitiesPage<unknown>(serviceName, entitySet, {
    $count: true,
    $top: 0,
    ...(filter ? { $filter: filter } : {}),
  });

  return page.count ?? 0;
}

/**
 * @description Retrieves one entity by id, returning `null` when the entity does not exist.
 * @param {string} entitySet - OData entity set name to query.
 * @param {string} id - Identifier of the target entity.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @returns {Promise<T | null>} A normalized entity when found, otherwise `null` on not-found.
 * @throws {ODataNormalizedError} Throws for transport/server errors other than not-found.
 * @example const ticket = await getEntityById<Ticket>('Tickets', 'TK-001');
 */
export async function getEntityById<T>(
  serviceName: ODataService,
  entitySet: string,
  id: string,
  requestOptions?: ODataRequestOptions
): Promise<T | null> {
  try {
    const data = await odataFetch<T | ODataSingleResponse<T>>(
      serviceName,
      entityPath(entitySet, id),
      requestOptions
    );
    return unwrapSingle(data);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

/**
 * @description Creates a new entity in the target OData entity set.
 * @param {string} entitySet - OData entity set name to create into.
 * @param {unknown} payload - Entity payload to send (converted to OData field conventions).
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @returns {Promise<T>} The normalized created entity, or payload-derived fallback when response body is empty.
 * @throws {ODataNormalizedError} Throws when the create request fails.
 * @example const created = await createEntity<Ticket>('Tickets', draftTicket);
 */
export async function createEntity<T>(
  serviceName: ODataService,
  entitySet: string,
  payload: unknown,
  requestOptions?: ODataRequestOptions
): Promise<T> {
  const data = await odataFetch<T>(serviceName, `/${entitySet}`, {
    ...requestOptions,
    method: 'POST',
    body: JSON.stringify(toODataEntityPayload(payload)),
  });
  // POST should always return the created entity; guard against unexpected 204
  if (data === undefined) return normalizeEntityRecord(toODataEntityPayload(payload) as T);
  return normalizeEntityRecord(data);
}

/**
 * @description Updates an existing entity by id using PATCH semantics.
 * @param {string} entitySet - OData entity set name containing the entity.
 * @param {string} id - Identifier of the entity to update.
 * @param {unknown} payload - Partial update payload converted to OData field conventions.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @returns {Promise<T>} The normalized updated entity, or payload-derived fallback when response body is empty.
 * @throws {ODataNormalizedError} Throws when the update request fails.
 * @example const updated = await updateEntity<Ticket>('Tickets', ticketId, { status: 'DONE' });
 */
export async function updateEntity<T>(
  serviceName: ODataService,
  entitySet: string,
  id: string,
  payload: unknown,
  requestOptions?: ODataRequestOptions
): Promise<T> {
  const data = await odataFetch<T>(serviceName, entityPath(entitySet, id), {
    ...requestOptions,
    method: 'PATCH',
    body: JSON.stringify(toODataEntityPayload(payload)),
  });
  // PATCH may return 204 (no content) – return the payload as fallback
  if (data === undefined) {
    const fallback = toODataEntityPayload(payload) as Record<string, unknown>;
    return normalizeEntityRecord({ ...fallback, ID: id } as T);
  }
  return normalizeEntityRecord(data);
}

/**
 * @description Deletes an entity by id from the specified OData entity set.
 * @param {string} entitySet - OData entity set name containing the entity.
 * @param {string} id - Identifier of the entity to delete.
 * @param {ODataRequestOptions | undefined} requestOptions - Low-level request options for timeout, headers, and abort signal.
 * @returns {Promise<void>} Resolves when deletion completes successfully.
 * @throws {ODataNormalizedError} Throws when the delete request fails.
 * @example await deleteEntity('Tickets', ticketId);
 */
export async function deleteEntity(
  serviceName: ODataService,
  entitySet: string,
  id: string,
  requestOptions?: ODataRequestOptions
): Promise<void> {
  // DELETE typically returns 204 (no content), odataFetch returns undefined which is fine for void
  await odataFetch<void>(serviceName, entityPath(entitySet, id), {
    ...requestOptions,
    method: 'DELETE',
  });
}
