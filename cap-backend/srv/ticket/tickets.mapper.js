'use strict';

const parseJsonIfString = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const asRecord = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
};

const parseRows = (value) => {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];
  return parsed;
};

const asString = (value) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const normalizeTags = (value) =>
  parseRows(value)
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const candidate = asRecord(entry);
      if (!candidate) return '';
      return String(candidate.tag ?? candidate.value ?? '').trim();
    })
    .filter((tag) => tag.length > 0);

const normalizeDocumentationObjectIds = (value) =>
  parseRows(value)
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      const candidate = asRecord(entry);
      if (!candidate) return '';
      return String(candidate.docObjectId ?? candidate.id ?? candidate.ID ?? '').trim();
    })
    .filter((id) => id.length > 0);

const asAction = (value) => {
  if (typeof value !== 'string') return undefined;
  return value.trim();
};

const normalizeHistory = (value) =>
  parseRows(value)
    .map((entry, index) => {
      const candidate = asRecord(entry);
      if (!candidate) {
        const text = String(entry ?? '').trim();
        return text ? { id: `te-${index}`, timestamp: new Date().toISOString(), userId: 'system', action: 'COMMENT', comment: text } : null;
      }

      const action = asAction(candidate.action ?? candidate.event);
      const fromValue = asString(candidate.fromValue);
      const toValue = asString(candidate.toValue);
      const comment = asString(candidate.comment ?? candidate.details);

      return {
        id: asString(candidate.id ?? candidate.ID) ?? `te-${index}`,
        timestamp:
          asString(candidate.timestamp) ??
          asString(candidate.createdAt) ??
          new Date().toISOString(),
        userId: asString(candidate.userId) ?? asString(candidate.createdBy) ?? 'system',
        action: action ?? 'COMMENT',
        ...(fromValue ? { fromValue } : {}),
        ...(toValue ? { toValue } : {}),
        ...(comment ? { comment } : {}),
      };
    })
    .filter(Boolean);

const toTagRows = (value) =>
  normalizeTags(value).map((tag) => ({ tag }));

const toDocumentationRows = (value) =>
  normalizeDocumentationObjectIds(value).map((docObjectId) => ({ docObjectId }));

const toHistoryRows = (value) =>
  parseRows(value)
    .map((entry) => {
      if (typeof entry === 'string') {
        const text = entry.trim();
        return text ? { event: 'COMMENT', details: text } : null;
      }
      const candidate = asRecord(entry);
      if (!candidate) return null;

      const event = asString(candidate.action) ?? asString(candidate.event) ?? 'UPDATE';
      const detailsSource = candidate.details !== undefined ? candidate.details : candidate;
      const details = typeof detailsSource === 'string' ? detailsSource : JSON.stringify(detailsSource);
      if (!details.trim()) return null;
      return { event, details };
    })
    .filter((row) => Boolean(row));

const deserializeArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return [];
};

module.exports = {
  normalizeHistory,
  normalizeTags,
  normalizeDocumentationObjectIds,
  toTagRows,
  toDocumentationRows,
  toHistoryRows,
  deserializeArray,
};
