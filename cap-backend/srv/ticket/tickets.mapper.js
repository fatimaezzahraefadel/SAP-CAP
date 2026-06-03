'use strict';

const normalizeEmptyString = (value) => {
  if (typeof value !== 'string') return value;
  return value.trim() === '' ? null : value;
};

const parseJsonArray = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const normalizeTicketPayload = (req) => {
  if (!req.data || typeof req.data !== 'object') return;

  req.data.assignedTo = normalizeEmptyString(req.data.assignedTo);
  req.data.assignedToRole = normalizeEmptyString(req.data.assignedToRole);
  req.data.functionalTesterId = normalizeEmptyString(req.data.functionalTesterId);
  req.data.tags = parseJsonArray(req.data.tags);
  req.data.history = parseJsonArray(req.data.history);
  req.data.documentationObjectIds = parseJsonArray(req.data.documentationObjectIds);
};

const normalizeTicketResponse = (ticket) => {
  if (!ticket || typeof ticket !== 'object') return ticket;
  return {
    ...ticket,
    tags: parseJsonArray(ticket.tags),
    history: parseJsonArray(ticket.history),
    documentationObjectIds: parseJsonArray(ticket.documentationObjectIds),
  };
};

module.exports = {
  normalizeTicketPayload,
  normalizeTicketResponse,
};
