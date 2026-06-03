using { sap.performance.dashboard.db as db } from '../../db/schema';
using { TicketService } from '../ticket-service';

extend TicketService with definitions {
  @cds.redirection.target
  entity Tickets as projection on db.Tickets actions {
    action approveTicket(techConsultantId: String, allocatedHours: Decimal) returns TicketService.Tickets;
    action rejectTicket(reason: String) returns TicketService.Tickets;
  };

  @readonly
  entity TechnicalConsultantTickets as projection on db.Tickets where assignedToRole = 'CONSULTANT_TECHNIQUE';

  @readonly
  entity FunctionalConsultantTickets as projection on db.Tickets where assignedToRole = 'CONSULTANT_FONCTIONNEL';

  @readonly
  entity ManagerTickets as projection on db.Tickets;
};

