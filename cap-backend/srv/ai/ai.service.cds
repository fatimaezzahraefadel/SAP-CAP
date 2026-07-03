using { TicketService } from '../ticket-service';

extend TicketService with definitions {
  type AiFactor {
    availabilityScore: Integer;
    skillsMatchScore: Integer;
    performanceScore: Integer;
    similarTicketsScore: Integer;
  }

  type AssigneeRecommendation {
    userId: String;
    userName: String;
    userRole: String;
    score: Decimal;
    factors: AiFactor;
    explanation: String;
  }

  action recommendAssignees(ticketId: UUID) returns array of AssigneeRecommendation;
}
