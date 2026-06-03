using from './project/project.service';
using from './reference-data/reference-data.service';
using from './documentation/documentation.service';
using from './deliverable/deliverable.service';
using from './project-feedback/project-feedback.service';
using from './wricef/wricef.service';
using from './attachments/attachments.service';

using { sap.performance.dashboard.db as db } from '../db/schema';

@path: '/odata/v4/core'
// Attachments are uploaded as base64 JSON payloads via uploadAttachment; raise
// the body-parser limit above the default 100kb to fit files up to ~25 MB
// (base64 adds ~33% overhead).
@cds.server.body_parser.limit: '50mb'
service CoreService {
  @readonly entity Users as projection on db.Users;
  @readonly entity Tickets as projection on db.Tickets;
  @readonly entity AuditLogs as projection on db.AuditLogs;
}
