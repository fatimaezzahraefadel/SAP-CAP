import type { Certification, CertificationStatus } from '../../types/entities';
import type { ODataQueryOptions, ODataRequestOptions } from './core';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  odataFetch,
  quoteLiteral,
} from './core';

// ---------------------------------------------------------------------------
// Backend raw shape (maps to db.Certificates entity)
// ---------------------------------------------------------------------------
interface CertificateRaw {
  ID?: string;
  id?: string;
  userId: string;
  title: string;
  issuingOrg?: string;
  issuedDate?: string;
  expiryDate?: string;
  credentialId?: string;
  credentialUrl?: string;
  status?: string; // ACTIVE | EXPIRED | REVOKED
  description?: string;
  createdAt?: string;
  modifiedAt?: string;
}

// ---------------------------------------------------------------------------
// Status mapping helpers
// ---------------------------------------------------------------------------
const EXPIRING_SOON_DAYS = 30;

const toFrontendStatus = (raw: CertificateRaw): CertificationStatus => {
  const backendStatus = String(raw.status ?? 'ACTIVE').toUpperCase();
  if (backendStatus === 'EXPIRED' || backendStatus === 'REVOKED') return 'EXPIRED';

  if (raw.expiryDate) {
    const diff = (new Date(raw.expiryDate).getTime() - Date.now()) / 86_400_000;
    if (diff >= 0 && diff <= EXPIRING_SOON_DAYS) return 'EXPIRING_SOON';
  }
  return 'VALID';
};

const toBackendStatus = (status: CertificationStatus): string => {
  if (status === 'EXPIRED') return 'EXPIRED';
  return 'ACTIVE';
};

// ---------------------------------------------------------------------------
// Normalize: CertificateRaw → Certification (frontend shape)
// ---------------------------------------------------------------------------
export const normalizeCertificate = (
  raw: CertificateRaw
): Certification & { userId: string } => {
  const id = String(raw.ID ?? raw.id ?? '');
  return {
    id,
    userId: String(raw.userId ?? ''),
    name: String(raw.title ?? ''),
    issuingBody: String(raw.issuingOrg ?? 'N/A'),
    dateObtained: String(raw.issuedDate ?? ''),
    expiryDate: raw.expiryDate ?? undefined,
    status: toFrontendStatus(raw),
    backendStatus: String(raw.status ?? 'ACTIVE').toUpperCase(),
    credentialId: raw.credentialId,
    credentialUrl: raw.credentialUrl,
    description: raw.description,
  } as Certification & { userId: string };
};

// ---------------------------------------------------------------------------
// Serialize: Certification (frontend) → backend payload
// ---------------------------------------------------------------------------
const toBackendPayload = (
  cert: Partial<Certification>,
  userId?: string
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  if (userId !== undefined) payload.userId = userId;
  if (cert.name !== undefined) payload.title = cert.name;
  if (cert.issuingBody !== undefined) payload.issuingOrg = cert.issuingBody;
  if (cert.dateObtained !== undefined) payload.issuedDate = cert.dateObtained;
  if (cert.expiryDate !== undefined) payload.expiryDate = cert.expiryDate || null;
  // Prefer the raw backend status (preserves REVOKED, which the frontend
  // CertificationStatus cannot represent and would otherwise rewrite as EXPIRED).
  if (cert.backendStatus !== undefined) {
    payload.status = cert.backendStatus;
  } else if (cert.status !== undefined) {
    payload.status = toBackendStatus(cert.status);
  }
  if ((cert as unknown as Record<string, unknown>).credentialId !== undefined)
    payload.credentialId = (cert as unknown as Record<string, unknown>).credentialId;
  if ((cert as unknown as Record<string, unknown>).credentialUrl !== undefined)
    payload.credentialUrl = (cert as unknown as Record<string, unknown>).credentialUrl;
  if ((cert as unknown as Record<string, unknown>).description !== undefined)
    payload.description = (cert as unknown as Record<string, unknown>).description;

  return payload;
};

// ---------------------------------------------------------------------------
// Document attachment raw shape
// ---------------------------------------------------------------------------
export interface CertificateDocument {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  storageKey: string;
  status: string;
  createdAt?: string;
}

const normalizeDocument = (raw: Record<string, unknown>): CertificateDocument => ({
  id: String(raw.ID ?? raw.id ?? ''),
  fileName: String(raw.fileName ?? ''),
  originalName: String(raw.originalName ?? ''),
  mimeType: String(raw.mimeType ?? ''),
  sizeBytes: Number(raw.sizeBytes ?? 0),
  uploadedBy: String(raw.uploadedBy ?? ''),
  storageKey: String(raw.storageKey ?? ''),
  status: String(raw.status ?? 'ACTIVE'),
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export const CertificatesAPI = {
  async list(
    options?: ODataQueryOptions,
    requestOptions?: ODataRequestOptions
  ): Promise<Array<Certification & { userId: string }>> {
    const rows = await listEntities<CertificateRaw>('user', 'Certificates', options, requestOptions, true);
    return rows.map(normalizeCertificate);
  },

  async getAll(requestOptions?: ODataRequestOptions) {
    return CertificatesAPI.list(undefined, requestOptions);
  },

  async getByUser(
    userId: string,
    requestOptions?: ODataRequestOptions
  ): Promise<Array<Certification & { userId: string }>> {
    return CertificatesAPI.list(
      { $filter: `userId eq ${quoteLiteral(userId)}` },
      requestOptions
    );
  },

  async create(
    userId: string,
    cert: Omit<Certification, 'id'>,
    requestOptions?: ODataRequestOptions
  ): Promise<Certification & { userId: string }> {
    const created = await createEntity<CertificateRaw>(
      'user',
      'Certificates',
      toBackendPayload(cert, userId),
      requestOptions
    );
    return normalizeCertificate(created);
  },

  async update(
    id: string,
    cert: Partial<Certification>,
    requestOptions?: ODataRequestOptions
  ): Promise<Certification & { userId: string }> {
    const updated = await updateEntity<CertificateRaw>(
      'user',
      'Certificates',
      id,
      toBackendPayload(cert),
      requestOptions
    );
    return normalizeCertificate(updated);
  },

  async delete(id: string, requestOptions?: ODataRequestOptions): Promise<void> {
    await deleteEntity('user', 'Certificates', id, requestOptions);
  },

  // ---- Document management ------------------------------------------------

  async uploadDocument(
    certId: string,
    fileName: string,
    mimeType: string,
    fileContent: ArrayBuffer | string,
    requestOptions?: ODataRequestOptions
  ): Promise<CertificateDocument> {
    const contentBase64 =
      typeof fileContent === 'string'
        ? fileContent
        : btoa(String.fromCharCode(...new Uint8Array(fileContent)));

    const data = await odataFetch<Record<string, unknown>>(
      'user',
      '/uploadCertificateDocument',
      {
        ...requestOptions,
        method: 'POST',
        body: JSON.stringify({ certId, fileName, mimeType, contentBase64 }),
      }
    );
    if (!data) throw new Error('uploadCertificateDocument returned no data');
    return normalizeDocument(data);
  },

  async listDocuments(
    certId: string,
    requestOptions?: ODataRequestOptions
  ): Promise<CertificateDocument[]> {
    const data = await odataFetch<{ value?: unknown[] } | unknown[]>(
      'user',
      '/listCertificateDocuments',
      {
        ...requestOptions,
        method: 'POST',
        body: JSON.stringify({ certId }),
      }
    );
    const items = Array.isArray(data)
      ? data
      : Array.isArray((data as { value?: unknown[] })?.value)
      ? (data as { value: unknown[] }).value
      : [];
    return items.map((item) => normalizeDocument(item as Record<string, unknown>));
  },

  async deleteDocument(
    attachmentId: string,
    requestOptions?: ODataRequestOptions
  ): Promise<CertificateDocument> {
    const data = await odataFetch<Record<string, unknown>>(
      'user',
      '/deleteCertificateDocument',
      {
        ...requestOptions,
        method: 'POST',
        body: JSON.stringify({ attachmentId }),
      }
    );
    if (!data) throw new Error('deleteCertificateDocument returned no data');
    return normalizeDocument(data);
  },
};
