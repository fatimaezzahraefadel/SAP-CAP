import type { User } from './core';
import type { ODataQueryOptions, ODataRequestOptions } from './core';
import { listEntities, createEntity, updateEntity, deleteEntity, quoteLiteral } from './core';

interface UserRaw extends Omit<User, 'skills' | 'certifications' | 'availabilityPercent'> {
  skills?: unknown;
  certifications?: unknown;
  availabilityPercent?: unknown;
}

const parseJsonIfString = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith('[') || trimmed.startsWith('{'))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapCollection = (value: unknown): unknown[] => {
  const parsed = parseJsonIfString(value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object') {
    const collection = (parsed as { value?: unknown }).value;
    if (Array.isArray(collection)) return collection;
  }
  return [];
};

const normalizeSkills = (value: unknown): string[] => {
  const source = unwrapCollection(value);
  return source
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (entry && typeof entry === 'object') {
        const candidate = entry as Record<string, unknown>;
        return String(candidate.skill ?? candidate.name ?? candidate.label ?? '').trim();
      }
      return '';
    })
    .filter((skill) => skill.length > 0);
};

const normalizeCertifications = (
  value: unknown
): User['certifications'] => {
  const source = unwrapCollection(value);
  return source
    .map((entry, index) => {
      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) return null;
        return {
          id: `cert-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          name,
          issuingBody: 'N/A',
          dateObtained: new Date().toISOString().slice(0, 10),
          status: 'VALID' as const,
        };
      }
      if (entry && typeof entry === 'object') {
        const candidate = entry as Record<string, unknown>;
        const name = String(candidate.name ?? '').trim();
        if (!name) return null;
        const id = String(candidate.id ?? candidate.ID ?? `cert-${index}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`);
        const dateObtained = String(candidate.dateObtained ?? candidate.date ?? new Date().toISOString().slice(0, 10));
        const statusRaw = String(candidate.status ?? 'VALID').trim().toUpperCase();
        const status =
          statusRaw === 'VALID' || statusRaw === 'EXPIRING_SOON' || statusRaw === 'EXPIRED'
            ? statusRaw
            : 'VALID';
        return {
          id,
          name,
          issuingBody: String(candidate.issuingBody ?? 'N/A'),
          dateObtained,
          expiryDate: typeof candidate.expiryDate === 'string' && candidate.expiryDate ? candidate.expiryDate : undefined,
          status,
          documentUrl: typeof candidate.documentUrl === 'string' && candidate.documentUrl ? candidate.documentUrl : undefined,
        };
      }
      return null;
    })
    .filter((cert): cert is User['certifications'][number] => Boolean(cert));
};

const ensureExpand = (expand: string | undefined, required: string[]): string => {
  const current = (expand ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const merged = [...new Set([...current, ...required])];
  return merged.join(',');
};

const USER_BASE_SELECT =
  'ID,name,email,role,active,availabilityPercent,teamId,avatarUrl';

const isMissingUserCompositionTable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /no such table: .*User(Skills|Certifications)/i.test(error.message);
};

const normalizeUser = (entry: UserRaw & { ID?: string }): User => ({
  ...entry,
  id: String(entry.id ?? entry.ID ?? ''),
  name: String(entry.name ?? ''),
  email: String(entry.email ?? ''),
  role: entry.role,
  active: Boolean(entry.active),
  skills: normalizeSkills(entry.skills),
  certifications: normalizeCertifications(entry.certifications),
  availabilityPercent: Number(entry.availabilityPercent ?? 100) || 100,
  teamId: typeof entry.teamId === 'string' ? entry.teamId : undefined,
  avatarUrl: typeof entry.avatarUrl === 'string' ? entry.avatarUrl : undefined,
});

const toUserPayload = (user: Partial<User>): Record<string, unknown> => {
  const payload: Record<string, unknown> = { ...user };

  if ('skills' in user) {
    payload.skills = Array.isArray(user.skills)
      ? user.skills.map((skill) => ({ skill }))
      : [];
  }

  if ('certifications' in user) {
    payload.certifications = Array.isArray(user.certifications)
      ? user.certifications.map((cert) => ({
          name: typeof cert === 'string' ? cert : cert.name,
          issuingBody: typeof cert === 'string' ? 'N/A' : (cert.issuingBody ?? 'N/A'),
          dateObtained: typeof cert === 'string' ? undefined : cert.dateObtained,
          expiryDate: typeof cert === 'string' ? undefined : cert.expiryDate,
          status: typeof cert === 'string' ? 'VALID' : cert.status,
          documentUrl: typeof cert === 'string' ? undefined : cert.documentUrl,
          date: typeof cert === 'string' ? undefined : (cert.dateObtained || cert.expiryDate),
        }))
      : [];
  }

  return payload;
};

export const UsersAPI = {
  async list(
    options?: ODataQueryOptions,
    requestOptions?: ODataRequestOptions
  ): Promise<User[]> {
    try {
      const rows = await listEntities<UserRaw>('user', 'Users',
        {
          ...options,
          $select: options?.$select ?? USER_BASE_SELECT,
          $expand: ensureExpand(options?.$expand, ['skills', 'certifications']),
        },
        requestOptions,
        true
      );
      return rows.map(normalizeUser);
    } catch (error) {
      if (!isMissingUserCompositionTable(error)) throw error;
      const legacyRows = await listEntities<UserRaw>('user', 'Users',
        {
          ...options,
          $select: options?.$select ?? `${USER_BASE_SELECT},skills,certifications`,
        },
        requestOptions,
        true
      );
      return legacyRows.map(normalizeUser);
    }
  },

  async getAll(requestOptions?: ODataRequestOptions): Promise<User[]> {
    return await UsersAPI.list(undefined, requestOptions);
  },

  async getActive(requestOptions?: ODataRequestOptions): Promise<User[]> {
    return await UsersAPI.list(
      {
        $filter: 'active eq true',
      },
      requestOptions
    );
  },

  async getByEmail(
    email: string,
    requestOptions?: ODataRequestOptions
  ): Promise<User | null> {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return null;
    const normalizedEmail = trimmedEmail.toLowerCase();

    const exactMatch = await UsersAPI.list(
      {
        $filter: `active eq true and email eq ${quoteLiteral(trimmedEmail)}`,
        $top: 1,
      },
      requestOptions
    );
    if (exactMatch[0]) return exactMatch[0];

    if (normalizedEmail !== trimmedEmail) {
      const normalizedMatch = await UsersAPI.list(
        {
          $filter: `active eq true and email eq ${quoteLiteral(normalizedEmail)}`,
          $top: 1,
        },
        requestOptions
      );
      if (normalizedMatch[0]) return normalizedMatch[0];
    }

    try {
      const caseInsensitiveMatch = await UsersAPI.list(
        {
          $filter: `active eq true and tolower(email) eq ${quoteLiteral(normalizedEmail)}`,
          $top: 1,
        },
        requestOptions
      );
      return caseInsensitiveMatch[0] ?? null;
    } catch {
      return null;
    }
  },

  async getById(id: string, requestOptions?: ODataRequestOptions): Promise<User | null> {
    const rows = await UsersAPI.list(
      {
        $filter: `ID eq ${quoteLiteral(id)}`,
        $top: 1,
      },
      requestOptions
    );
    return rows[0] ?? null;
  },

  async create(user: Omit<User, 'id'>, requestOptions?: ODataRequestOptions): Promise<User> {
    const created = await createEntity<UserRaw>('user', 'Users',
      toUserPayload(user),
      requestOptions
    );
    return normalizeUser(created);
  },

  async update(
    id: string,
    user: Partial<User>,
    requestOptions?: ODataRequestOptions
  ): Promise<User> {
    const updated = await updateEntity<UserRaw>('user', 'Users', id, toUserPayload(user), requestOptions);
    return normalizeUser(updated);
  },

  async delete(id: string, requestOptions?: ODataRequestOptions): Promise<void> {
    await deleteEntity('user', 'Users', id, requestOptions);
  },
};
