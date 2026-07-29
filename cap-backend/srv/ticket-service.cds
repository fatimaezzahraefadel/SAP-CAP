using from './ticket/ticket.service';
using from './comment/comment.service';

using { sap.performance.dashboard.db as db } from '../db/schema';

@path: '/odata/v4/ticket'
service TicketService {
  @readonly entity Users as projection on db.Users;
  @readonly entity Projects as projection on db.Projects;
}
