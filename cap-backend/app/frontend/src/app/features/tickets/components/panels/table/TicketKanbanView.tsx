import React, { useMemo, useState } from 'react';
import { AlertOctagon, MessageSquare, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/app/components/ui/badge';
import { Ticket, TicketStatus } from '@/app/types/entities';
import { isStatusTransitionAllowed, priorityColor, STATUS_ORDER, statusColor } from '../../ticketView.constants';

interface TicketKanbanViewProps {
  canDrag: boolean;
  canDelete: boolean;
  /**
   * Role-aware gate deciding whether the current user may move `ticket` to
   * `target`. Falls back to plain workflow validity when not provided.
   */
  canMoveTicket?: (ticket: Ticket, target: TicketStatus) => boolean;
  hideApprovalColumns?: boolean;
  filteredTickets: Ticket[];
  onOpenTicketDetails: (ticketId: string) => void;
  onChangeStatus: (ticket: Ticket, newStatus: TicketStatus) => void;
  onDeleteTicket: (ticketId: string) => void;
  resolveUserName: (userId?: string) => string;
}

const APPROVAL_STATUSES: TicketStatus[] = ['PENDING_APPROVAL', 'APPROVED'];

export const TicketKanbanView: React.FC<TicketKanbanViewProps> = ({
  canDrag,
  canDelete,
  canMoveTicket,
  hideApprovalColumns = false,
  filteredTickets,
  onOpenTicketDetails,
  onChangeStatus,
  onDeleteTicket,
  resolveUserName,
}) => {
  const columns = hideApprovalColumns
    ? STATUS_ORDER.filter((status) => !APPROVAL_STATUSES.includes(status))
    : STATUS_ORDER;
  const [draggedTicketId, setDraggedTicketId] = useState<string | null>(null);
  const [isDragOverDelete, setIsDragOverDelete] = useState(false);

  const draggedTicket = useMemo(
    () => filteredTickets.find((item) => item.id === draggedTicketId) ?? null,
    [filteredTickets, draggedTicketId]
  );

  // A column is a valid drop target when the dragged ticket can transition to
  // it AND the current user's role is allowed to perform that move.
  const canDropOn = (targetStatus: TicketStatus): boolean => {
    if (!draggedTicket) return true;
    if (canMoveTicket) return canMoveTicket(draggedTicket, targetStatus);
    return isStatusTransitionAllowed(draggedTicket.status, targetStatus);
  };

  const onDragStart = (event: React.DragEvent, ticketId: string) => {
    event.dataTransfer.setData('text/plain', ticketId);
    setDraggedTicketId(ticketId);
  };

  const onDragEnd = () => {
    setDraggedTicketId(null);
    setIsDragOverDelete(false);
  };

  const onDragOver = (event: React.DragEvent, targetStatus: TicketStatus) => {
    // Only show a drop affordance on columns the ticket can actually move to.
    if (canDropOn(targetStatus)) event.preventDefault();
  };

  const onDropToStatus = (event: React.DragEvent, targetStatus: TicketStatus) => {
    event.preventDefault();
    const ticketId = event.dataTransfer.getData('text/plain');
    const ticket = filteredTickets.find((item) => item.id === ticketId);
    onDragEnd();
    if (!ticket || ticket.status === targetStatus) return;
    const allowed = canMoveTicket
      ? canMoveTicket(ticket, targetStatus)
      : isStatusTransitionAllowed(ticket.status, targetStatus);
    if (!allowed) {
      toast.error(`Cannot move ${ticket.status.replace('_', ' ')} → ${targetStatus.replace('_', ' ')}`);
      return;
    }
    onChangeStatus(ticket, targetStatus);
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

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {columns.map((status) => {
        const columnTickets = filteredTickets.filter((ticket) => ticket.status === status);
        const isDragging = canDrag && Boolean(draggedTicket);
        const isValidTarget = isDragging && status !== draggedTicket?.status && canDropOn(status);
        const isInvalidTarget = isDragging && status !== draggedTicket?.status && !canDropOn(status);
        return (
          <div
            key={status}
            className={`min-w-[240px] flex-1 rounded-lg border bg-muted/30 p-3 transition-colors ${
              isValidTarget ? 'border-primary/60 bg-primary/5 ring-1 ring-primary/30' : ''
            } ${isInvalidTarget ? 'opacity-50' : ''}`}
            onDragOver={canDrag ? (event) => onDragOver(event, status) : undefined}
            onDrop={canDrag ? (event) => onDropToStatus(event, status) : undefined}
          >
            <div className="mb-3 flex items-center justify-between">
              <Badge className={statusColor[status]}>{status.replace('_', ' ')}</Badge>
              <span className="text-xs text-muted-foreground">{columnTickets.length}</span>
            </div>
            <div className="space-y-2">
              {columnTickets.map((ticket) => (
                <div
                  key={ticket.id}
                  draggable={canDrag}
                  onDragStart={(event) => canDrag && onDragStart(event, ticket.id)}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpenTicketDetails(ticket.id)}
                  className={`rounded-lg border bg-card p-3 shadow-sm hover:shadow transition ${canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
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
