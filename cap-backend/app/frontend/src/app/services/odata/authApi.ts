import type { User } from './core';
import type { ODataRequestOptions } from './core';
import { normalizeEntityRecord, odataFetch } from './core';

const parseJsonArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const AuthAPI = {
  async currentUser(requestOptions?: ODataRequestOptions): Promise<User> {
    const data = await odataFetch<User>('user', '/currentUser', {
      ...requestOptions,
      method: 'POST',
      body: JSON.stringify({}),
    });
    if (!data) throw new Error('Authentication failed: no current user returned');

    const user = normalizeEntityRecord<User>(data);
    return {
      ...user,
      skills: parseJsonArray<string>(user.skills),
      certifications: parseJsonArray<User['certifications'][number]>(user.certifications),
      availabilityPercent: user.availabilityPercent ?? 100,
    };
  },
};
