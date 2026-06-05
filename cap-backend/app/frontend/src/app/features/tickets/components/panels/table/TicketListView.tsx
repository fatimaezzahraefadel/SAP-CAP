import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, MessageSquare, Plus, Ticket as TicketIcon, Trash2 } from 'lucide-react';
import { EmptyState } from '@/app/components/common/EmptyState';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/app/components/ui/table';
import {
  Ticket,
  TicketStatus,
} from '@/app/types/entities';
import { TicketActions } from '../../TicketActions';
import { priorityColor, statusColor } from '../../ticketView.constants';

interface TicketListViewProps {
  isViewOnly: boolean;
  canDeleteTicket: boolean;
  filteredTickets: Ticket[];
  onOpenTicketDetails: (ticketId: string) => void;
  onCreateTicket: () => void;
  onChangeStatus: (ticket: Ticket, newStatus: TicketStatus) => void;
  onDeleteTicket: (ticketId: string) => void;
  resolveProjectName: (projectId: string) => string;
  resolveUserName: (userId?: string) => string;
}

const getAssignedBy = (ticket: Ticket, resolveUserName: (userId?: string) => string): string | null => {
  if (!ticket.history || ticket.history.length === 0) return null;
  const assignEvents = ticket.history.filter((event) => event.action === 'ASSIGNED');
  const assignEvent = assignEvents.length > 0 ? assignEvents[assignEvents.length - 1] : null;
  return assignEvent ? resolveUserName(assignEvent.userId) : null;
};

export const TicketListView: React.FC<TicketListViewProps> = ({
  isViewOnly,
  canDeleteTicket,
  filteredTickets,
  onOpenTicketDetails,
  onCreateTicket,
  onChangeStatus,
  onDeleteTicket,
  resolveProjectName,
  resolveUserName,
}) => {
  const { t } = useTranslation();

  const openTicketFromKeyboard = (
    event: React.KeyboardEvent<HTMLElement>,
    ticketId: string
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    onOpenTicketDetails(ticketId);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        {filteredTickets.map((ticket) => {
          const assignedBy = getAssignedBy(ticket, resolveUserName);

          return (
            <div key={ticket.id} className="rounded-lg border bg-card p-4 shadow-sm">
              <div
                role="button"
                tabIndex={0}
                onClick={() => onOpenTicketDetails(ticket.id)}
                onKeyDown={(event) => openTicketFromKeyboard(event, ticket.id)}
                className="w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{ticket.ticketCode}</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{ticket.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{resolveProjectName(ticket.projectId)}</p>
                  </div>
                  <Badge className={statusColor[ticket.status]}>{t(`entities.ticketStatus.${ticket.status}`)}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge className={priorityColor[ticket.priority]}>{t(`tickets.priority.${ticket.priority}`)}</Badge>
                  <Badge variant="outline">{ticket.module ? t(`entities.sapModule.${ticket.module}`) : '-'}</Badge>
                  <Badge variant="outline">{t(`entities.ticketNature.${ticket.nature}`)}</Badge>
                  <Badge
                    variant="outline"
                    className={
                      ticket.complexity === 'TRES_COMPLEXE'
                        ? 'border-red-300 text-red-700 dark:text-red-400'
                        : ticket.complexity === 'COMPLEXE'
                          ? 'border-orange-300 text-orange-700 dark:text-orange-400'
                          : undefined
                    }
                  >
                    {t(`entities.ticketComplexity.${ticket.complexity}`)}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('tickets.list.table.assigned')}
                    </p>
                    <p className="font-medium text-foreground">{resolveUserName(ticket.assignedTo)}</p>
                    {ticket.assignedToRole && (
                      <p className="text-xs text-muted-foreground">{t(`roles.${ticket.assignedToRole}`)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('tickets.list.table.due')}
                    </p>
                    <p className="font-medium text-foreground">
                      {ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('tickets.list.table.estimation')}
                    </p>
                    <p className="font-medium text-foreground">{ticket.estimationHours}h</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {t('tickets.list.table.actual')}
                    </p>
                    <p className="font-medium text-foreground">{ticket.effortHours}h</p>
                  </div>
                </div>

                {(assignedBy || (ticket.commentCount ?? 0) > 0 || ticket.hasUnresolvedBlockers) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {assignedBy && <span>{t('tickets.details.assignedBy')}: {assignedBy}</span>}
                    {(ticket.commentCount ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {ticket.commentCount}
                      </span>
                    )}
                    {ticket.hasUnresolvedBlockers && (
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <AlertOctagon className="h-3.5 w-3.5" />
                        {t('dashboard.manager.kpi.risks.title')}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-3 border-t border-border/60 pt-3" onClick={(event) => event.stopPropagation()}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <TicketActions
                    mode="quick-complete"
                    ticket={ticket}
                    isViewOnly={isViewOnly}
                    onChangeStatus={onChangeStatus}
                  />
                  {canDeleteTicket && !isViewOnly && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteTicket(ticket.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t('common.delete')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredTickets.length === 0 && (
          <EmptyState
            icon={TicketIcon}
            title={t('tickets.list.empty.title')}
            description={t('tickets.list.empty.description')}
            action={
              <Button onClick={onCreateTicket} variant="outline" className="mt-2">
                <Plus className="mr-2 h-4 w-4" />
                {t('tickets.list.empty.createTicket')}
              </Button>
            }
          />
        )}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="px-4">{t('tickets.list.table.code')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.title')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.wricef')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.module')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.complexity')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.nature')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.project')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.status')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.priority')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.estimation')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.actual')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.due')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.assigned')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.indicators')}</TableHead>
              <TableHead className="px-4">{t('tickets.list.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTickets.map((ticket) => {
              const assignedBy = getAssignedBy(ticket, resolveUserName);
              return (
                <TableRow
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${t('tickets.list.table.title')}: ${ticket.title}`}
                  className="cursor-pointer hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => onOpenTicketDetails(ticket.id)}
                  onKeyDown={(event) => openTicketFromKeyboard(event, ticket.id)}
                >
                  <TableCell className="px-4 py-3 text-xs font-mono text-muted-foreground">{ticket.ticketCode}</TableCell>
                  <TableCell className="max-w-[200px] px-4 py-3 truncate font-medium">{ticket.title}</TableCell>
                  <TableCell className="px-4 py-3 text-xs font-mono">{ticket.wricefId ?? '-'}</TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">{ticket.module ? t(`entities.sapModule.${ticket.module}`) : '-'}</Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant="outline" className={`text-[10px] ${ticket.complexity === 'TRES_COMPLEXE' ? 'border-red-300 text-red-700 dark:text-red-400' : ticket.complexity === 'COMPLEXE' ? 'border-orange-300 text-orange-700 dark:text-orange-400' : ''}`}>
                      {t(`entities.ticketComplexity.${ticket.complexity}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3"><Badge variant="outline">{t(`entities.ticketNature.${ticket.nature}`)}</Badge></TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{resolveProjectName(ticket.projectId)}</TableCell>
                  <TableCell className="px-4 py-3"><Badge className={statusColor[ticket.status]}>{t(`entities.ticketStatus.${ticket.status}`)}</Badge></TableCell>
                  <TableCell className="px-4 py-3"><Badge className={priorityColor[ticket.priority]}>{t(`tickets.priority.${ticket.priority}`)}</Badge></TableCell>
                  <TableCell className="px-4 py-3 text-sm">{ticket.estimationHours}h</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{ticket.effortHours}h</TableCell>
                  <TableCell className="px-4 py-3 text-sm">{ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : '-'}</TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    <div>{resolveUserName(ticket.assignedTo)}</div>
                    {ticket.assignedToRole && <span className="block text-xs text-muted-foreground">{t(`roles.${ticket.assignedToRole}`)}</span>}
                    {assignedBy && <span className="mt-0.5 block border-t border-border/50 pt-0.5 text-[10px] text-muted-foreground">{t('tickets.details.assignedBy')}: {assignedBy}</span>}
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {(ticket.commentCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground" title={`${ticket.commentCount} comment(s)`}>
                          <MessageSquare className="h-3.5 w-3.5" />
                          {ticket.commentCount}
                        </span>
                      )}
                      {ticket.hasUnresolvedBlockers && (
                        <span className="inline-flex items-center text-destructive" title="Has unresolved blockers">
                          <AlertOctagon className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      <TicketActions mode="quick-complete" ticket={ticket} isViewOnly={isViewOnly} onChangeStatus={onChangeStatus} />
                      {canDeleteTicket && !isViewOnly && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteTicket(ticket.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredTickets.length === 0 && (
              <TableRow>
                <TableCell colSpan={15} className="h-64 text-center">
                  <EmptyState
                    icon={TicketIcon}
                    title={t('tickets.list.empty.title')}
                    description={t('tickets.list.empty.description')}
                    action={
                      <Button onClick={onCreateTicket} variant="outline" className="mt-2">
                        <Plus className="mr-2 h-4 w-4" />
                        {t('tickets.list.empty.createTicket')}
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
