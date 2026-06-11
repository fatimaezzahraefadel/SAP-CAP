using from './user/user.service';
using from './auth/auth.service';
using from './allocation/allocation.service';
using from './leave-request/leave-request.service';
using from './notification/notification.service';
using from './certificate/certificate.service';

using { sap.performance.dashboard.db as db } from '../db/schema';

@path: '/odata/v4/user'
// Certificate documents are uploaded as base64 JSON payloads via
// uploadCertificateDocument; raise the body-parser limit above the default
// 100kb to fit files up to ~25 MB (base64 adds ~33% overhead).
@cds.server.body_parser.limit: '50mb'
service UserService {
  @readonly entity Projects as projection on db.Projects;
  @readonly entity Tickets as projection on db.Tickets;
}
