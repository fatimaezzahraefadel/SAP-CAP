'use strict';

const Actions = Object.freeze({
  TICKET_CREATE: 'ticket:create',
  TICKET_READ: 'ticket:read',
  TICKET_UPDATE: 'ticket:update',
  TICKET_DELETE: 'ticket:delete',
  TICKET_APPROVE: 'ticket:approve',
  TICKET_REJECT: 'ticket:reject',
  DOCUMENT_CREATE: 'document:create',
  DOCUMENT_READ: 'document:read',
  DOCUMENT_UPDATE: 'document:update',
  DOCUMENT_DELETE: 'document:delete',
  ATTACHMENT_UPLOAD: 'attachment:upload',
  ATTACHMENT_DOWNLOAD: 'attachment:download',
  ATTACHMENT_DELETE: 'attachment:delete',
  AUDIT_READ: 'audit:read',
});

module.exports = {
  Actions,
};
