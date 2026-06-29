import React, { useState } from 'react';
import { AlertOctagon, MessageSquare, Trash2 } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { Ticket, TicketStatus } from '@/app/types/entities';
import { priorityColor, STATUS_ORDER, statusColor } from '../../ticketView.constants';

interface TicketKanbanViewProps {
  isViewOnly: boolean;
  currentUserId?: string;
  currentUserRole?: string;
  canDelete: boolean;
  filteredTickets: Ticket[];
  onOpenTicketDetails: (ticketId: string) => void;
  onChangeStatus: (ticket: Ticket, newStatus: TicketStatus) => void;
  onDeleteTicket: (ticketId: string) => void;
  resolveUserName: (userId?: string) => string;
}

export const TicketKanbanView: React.FC<TicketKanbanViewProps> = ({
  isViewOnly,
  currentUserId,
  currentUserRole,
  canDelete,
  filteredTickets,
  onOpenTicketDetails,
  onChangeStatus,
  onDeleteTicket,
  resolveUserName,
}) => {
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [isDragOverDelete, setIsDragOverDelete] = useState(false);

  const onDragStart = (event: React.DragEvent, ticketId: string) => {
    event.dataTransfer.setData('text/plain', ticketId);
    setDraggedTicketId(ticketId);
  };

  const onDragEnd = () => {
    setDraggedTicketId(null);
    setIsDragOverDelete(false);
  };

  const onDragOver = (event: React.DragEvent) => event.preventDefault();

  const onDropToStatus = (event: React.DragEvent, targetStatus: TicketStatus) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData('text/plain');
    const ticket = filteredTickets.find((item) => item.id === ticketId);
    if (ticket && ticket.status !== targetStatus) onChangeStatus(ticket, targetStatus);
    onDragEnd();
  };

  const onDragOverDelete = (event: React.DragEvent) => {
    if (!canDelete) return;
    event.preventDefault();
    setIsDragOverDelete(true);
  };

  const onDragLeaveDelete = () => {
    setIsDragOverDelete(false);
  };

  const onDropToDelete = (event: React.DragEvent) => {
    if (!canDelete) return;
    event.preventDefault();
    const ticketId = event.dataTransfer.getData('text/plain');
    if (ticketId) {
      const ticket = filteredTickets.find((item) => item.id === ticketId);
      if (ticket) {
        onDeleteTicket(ticket.id);
      }
    }
    onDragEnd();
  };

  const isTicketDraggable = (ticket: Ticket) => {
    if (currentUserRole === 'CONSULTANT_TECHNIQUE') {
      return ticket.assignedTo === currentUserId;
    }
    return !isViewOnly;
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STATUS_ORDER.map((status) => {
        const columnTickets = filteredTickets.filter((ticket) => ticket.status === status);
        return (
          <div
            key={status}
            className="min-w-[240px] flex-1 rounded-lg border bg-muted/30 p-3"
            onDragOver={isViewOnly ? undefined : onDragOver}
            onDrop={isViewOnly ? undefined : (event) => onDropToStatus(event, status)}
          >
            <div className="mb-3 flex items-center justify-between">
              <Badge className={statusColor[status]}>{status.replace('_', ' ')}</Badge>
              <span className="text-xs text-muted-foreground">{columnTickets.length}</span>
            </div>
            <div className="space-y-2">
              {columnTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  draggable={isTicketDraggable(ticket)}
                  onDragStart={(event) => isTicketDraggable(ticket) && onDragStart(event, ticket.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpenTicketDetails(ticket.id)}
                  className={`rounded-lg border bg-card p-3 shadow-sm hover:shadow transition ${!isTicketDraggable(ticket) ? 'cursor-pointer' : 'cursor-grab'}`}
                >
                  <p className="text-sm font-medium text-foreground">{ticket.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{ticket.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Badge className={`${priorityColor[ticket.priority]} text-[10px]`}>{ticket.priority}</Badge>
                      {(ticket.commentCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                          <MessageSquare className="h-3 w-3" />{ticket.commentCount}
                        </span>
                      )}
                      {ticket.hasUnresolvedBlockers && (
                        <AlertOctagon className="h-3 w-3 text-destructive" />
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{resolveUserName(ticket.assignedTo)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {canDelete && draggedTicketId && (
        <div
          className={`min-w-[240px] flex-1 rounded-lg border border-dashed bg-error/10 p-4 text-center transition ${isDragOverDelete ? 'bg-error/20 border-destructive' : ''}`}
          onDragOver={onDragOverDelete}
          onDragLeave={onDragLeaveDelete}
          onDrop={onDropToDelete}
        >
          <Trash2 className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm font-semibold text-destructive">Drop here to delete</p>
          <p className="text-xs text-muted-foreground">Managers and project managers can remove the dragged ticket</p>
        </div>
      )}
    </div>
  );
};
