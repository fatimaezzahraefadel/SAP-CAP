using { sap.performance.dashboard.db as db } from '../../db/schema';
using { TicketService } from '../ticket-service';

extend TicketService with definitions {
  entity Tickets as projection on db.Tickets actions {
    action approveTicket(techConsultantId: String, allocatedHours: Decimal, functionalTesterId: String) returns TicketService.Tickets;
    action rejectTicket(reason: String) returns TicketService.Tickets;
    action startTicket() returns TicketService.Tickets;
    action startTesting() returns TicketService.Tickets;
    action completeTicket() returns TicketService.Tickets;
  };
};

