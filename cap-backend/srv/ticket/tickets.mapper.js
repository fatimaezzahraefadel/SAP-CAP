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

const unwrapHistoryRecord = (candidate) => {
  const details = parseJsonIfString(candidate.details);
  const detailsRecord = asRecord(details);
  if (detailsRecord) {
    const rest = { ...candidate };
    delete rest.details;
    return unwrapHistoryRecord({ ...rest, ...detailsRecord });
  }

  const comment = parseJsonIfString(candidate.comment);
  const commentRecord = asRecord(comment);
  if (commentRecord) {
    const rest = { ...candidate };
    delete rest.comment;
    return unwrapHistoryRecord({ ...rest, ...commentRecord });
  }

  return candidate;
};

const normalizeHistory = (value) =>
  parseRows(value)
    .map((entry, index) => {
      const candidate = asRecord(entry);
      if (!candidate) {
        const text = String(entry ?? '').trim();
        return text ? { id: `te-${index}`, timestamp: new Date().toISOString(), userId: 'system', action: 'COMMENT', comment: text } : null;
      }

      const normalized = unwrapHistoryRecord(candidate);
      const action = asAction(normalized.action ?? normalized.event ?? candidate.event);
      const fromValue = asString(normalized.fromValue);
      const toValue = asString(normalized.toValue);
      const comment = asString(normalized.comment ?? normalized.details);

      return {
        id: asString(normalized.id ?? normalized.ID ?? candidate.ID) ?? `te-${index}`,
        timestamp:
          asString(normalized.timestamp) ??
          asString(candidate.createdAt) ??
          new Date().toISOString(),
        userId: asString(normalized.userId) ?? asString(candidate.createdBy) ?? 'system',
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
      const detailFields = {
        ...(asString(candidate.fromValue) ? { fromValue: asString(candidate.fromValue) } : {}),
        ...(asString(candidate.toValue) ? { toValue: asString(candidate.toValue) } : {}),
      };
      const hasDetailFields = Object.keys(detailFields).length > 0;
      const detailsSource =
        candidate.details !== undefined
          ? candidate.details
          : candidate.comment !== undefined
            ? candidate.comment
            : hasDetailFields
              ? detailFields
              : '';
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

const normalizeTicketPayload = (req) => {
  const data = req?.data;
  if (!data || typeof data !== 'object') return;

  if (data.tags !== undefined) data.tags = normalizeTags(data.tags);
  if (data.documentationObjectIds !== undefined) {
    data.documentationObjectIds = normalizeDocumentationObjectIds(data.documentationObjectIds);
  }
  if (data.history !== undefined) data.history = normalizeHistory(data.history);
};

module.exports = {
  normalizeHistory,
  normalizeTags,
  normalizeDocumentationObjectIds,
  normalizeTicketPayload,
  toTagRows,
  toDocumentationRows,
  toHistoryRows,
  deserializeArray,
};
