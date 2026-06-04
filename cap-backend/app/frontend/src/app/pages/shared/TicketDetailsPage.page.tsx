import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { TicketDocumentationSection } from '../../components/business/TicketDocumentationSection';
import { TicketCommentThread } from '../../features/comments/components/TicketCommentThread';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Textarea } from '../../components/ui/textarea';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { getBaseRouteForRole } from '../../context/roleRouting';
import { useAuth } from '../../context/AuthContext';
import {
  ticketStatusColor as statusColor,
  ticketPriorityColor as priorityColor,
} from '../../utils/ticketColors';
import {
  Priority,
  Project,
  SAP_MODULE_LABELS,
  Ticket,
  TicketEvent,
  TICKET_COMPLEXITY_LABELS,
  TICKET_NATURE_LABELS,
  User,
} from '../../types/entities';
import { formatDate, formatDateTime } from '../../utils/date';

const canAccessTicket = (ticket: Ticket, userId: string, role: User['role']): boolean => {
  if (role === 'CONSULTANT_TECHNIQUE') {
    return ticket.createdBy === userId || ticket.assignedTo === userId;
  }
  if (role === 'CONSULTANT_FONCTIONNEL') {
    return ticket.createdBy === userId || ticket.assignedTo === userId;
  }
  return true;
};

export const TicketDetailsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { currentUser } = useAuth();
  const { ticketId } = useParams();
  const navigate = useNavigate();

  const roleBasePath = currentUser ? getBaseRouteForRole(currentUser.role) : '';
  const ticketsPath = `${roleBasePath}/tickets`;
  const canEditTicket = currentUser?.role === 'MANAGER' || currentUser?.role === 'PROJECT_MANAGER';

  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM' as Priority,
  });
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  const userName = useCallback(
    (id?: string) => users.find((user) => user.id === id)?.name ?? '-',
    [users]
  );

  const renderEventText = useCallback((event: TicketEvent, userName: (id?: string) => string): React.ReactNode => {
    if (event.action === 'CREATED') return t('tickets.details.events.created');
    if (event.action === 'STATUS_CHANGE') {
      return (
        <>
          {t('tickets.details.events.changedStatus', {
            from: '',
            to: '',
          }).split('  ').map((part, index) => (
            <React.Fragment key={index}>
              {part}
              {index === 0 && (
                <Badge variant="outline" className="text-[10px] mx-0.5">
                  {event.fromValue ? t(`tickets.status.${event.fromValue}`) : '-'}
                </Badge>
              )}
              {index === 1 && (
                <Badge variant="outline" className="text-[10px] mx-0.5">
                  {event.toValue ? t(`tickets.status.${event.toValue}`) : '-'}
                </Badge>
              )}
            </React.Fragment>
          ))}
        </>
      );
    }
    if (event.action === 'ASSIGNED') return t('tickets.details.events.assigned', { user: userName(event.toValue) });
    if (event.action === 'EFFORT_CHANGE') {
      return t('tickets.details.events.updatedEffort', { from: event.fromValue ?? '-', to: event.toValue ?? '-' });
    }
    if (event.action === 'PRIORITY_CHANGE') {
      return t('tickets.details.events.changedPriority', {
        from: event.fromValue ? t(`tickets.priority.${event.fromValue}`) : '-',
        to: event.toValue ? t(`tickets.priority.${event.toValue}`) : '-',
      });
    }
    if (event.action === 'SENT_TO_TEST') return t('tickets.details.events.sentToTest');
    if (event.action === 'COMMENT') return event.comment ? t('tickets.details.events.commented', { comment: event.comment }) : t('tickets.details.events.addedComment');
    return event.action;
  }, [t]);

  const sortedHistory = useMemo(
    () =>
      [...(ticket?.history ?? [])].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    [ticket]
  );

  const handleDocumentationChanged = useCallback((targetTicketId: string, documentationIds: string[]) => {
    setTicket((prev) => {
      if (!prev || prev.id !== targetTicketId) return prev;
      return {
        ...prev,
        documentationObjectIds: documentationIds.length > 0 ? documentationIds : undefined,
      };
    });
  }, []);

  useEffect(() => {
    if (!ticket) return;
    setEditValues({
      title: ticket.title,
      description: ticket.description,
      dueDate: ticket.dueDate ? ticket.dueDate.split('T')[0] : '',
      priority: ticket.priority,
    });
  }, [ticket]);

  const handleSaveTicket = async () => {
    if (!ticket) return;

    setIsSaving(true);
    try {
      const updated = await TicketsAPI.update(ticket.id, {
        title: editValues.title.trim(),
        description: editValues.description.trim(),
        dueDate: editValues.dueDate || undefined,
        priority: editValues.priority,
      });
      setTicket(updated);
      toast.success('Ticket updated successfully');
      setIsEditMode(false);
    } catch {
      toast.error('Failed to update ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!ticket) return;
    setEditValues({
      title: ticket.title,
      description: ticket.description,
      dueDate: ticket.dueDate ? ticket.dueDate.split('T')[0] : '',
      priority: ticket.priority,
    });
    setIsEditMode(false);
  };

  useEffect(() => {
    if (!ticketId || !currentUser) return;

    const load = async () => {
      setLoading(true);
      try {
        const [allTickets, allProjects, allUsers] = await Promise.all([
          TicketsAPI.getAll(),
          ProjectsAPI.getAll(),
          UsersAPI.getAll(),
        ]);
        const found = allTickets.find((item) => item.id === ticketId);
        if (!found) {
          toast.error(t('tickets.details.notFound'));
          navigate(ticketsPath, { replace: true });
          return;
        }
        if (!canAccessTicket(found, currentUser.id, currentUser.role)) {
          toast.error(t('tickets.details.noAccess'));
          navigate(ticketsPath, { replace: true });
          return;
        }

        setTicket(found);
        setProject(allProjects.find((item) => item.id === found.projectId) ?? null);
        setUsers(allUsers);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [currentUser, navigate, ticketId, ticketsPath, t]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="p-8 text-muted-foreground">{t('tickets.details.loading')}</div>
      </div>
    );
  }

  if (!ticket || !currentUser) {
    return (
      <div className="min-h-screen bg-background">
        <PageHeader
          title={t('tickets.details.title')}
          subtitle={t('tickets.details.unableToLoad')}
          breadcrumbs={[
            { label: t('common.home'), path: `${roleBasePath}/dashboard` },
            { label: t('common.tickets'), path: ticketsPath },
          ]}
        />
        <div className="p-6">
          <div className="rounded-lg border bg-card p-5">
            <p className="text-sm text-muted-foreground">{t('tickets.details.couldNotBeLoaded')}</p>
            <Button className="mt-3" variant="outline" onClick={() => navigate(ticketsPath)}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t('tickets.details.backToTickets')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const canEditDocumentation = ticket.status !== 'DONE' && ticket.status !== 'REJECTED';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={`${ticket.ticketCode} - ${ticket.title}`}
        subtitle={t('tickets.details.detailedView')}
        breadcrumbs={[
          { label: t('common.home'), path: `${roleBasePath}/dashboard` },
          { label: t('common.tickets'), path: ticketsPath },
          { label: ticket.ticketCode },
        ]}
      />

      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ticketsPath)}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('tickets.details.backToTickets')}
          </Button>
          {canEditTicket && !isEditMode && (
            <Button size="sm" onClick={() => setIsEditMode(true)}>
              {t('common.edit') || 'Modifier'}
            </Button>
          )}
          {isEditMode && (
            <>
              <Button size="sm" onClick={handleSaveTicket} disabled={isSaving}>
                {isSaving ? t('common.saving') || 'Saving...' : t('common.save') || 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                {t('common.cancel') || 'Cancel'}
              </Button>
            </>
          )}
        </div>

        <section className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge className={statusColor[ticket.status]}>{t(`tickets.status.${ticket.status}`)}</Badge>
            <Badge className={priorityColor[ticket.priority]}>{t(`tickets.priority.${ticket.priority}`)}</Badge>
            <Badge variant="outline">{TICKET_NATURE_LABELS[ticket.nature]}</Badge>
            <Badge variant="outline">{ticket.module ? SAP_MODULE_LABELS[ticket.module] : '-'}</Badge>
            <Badge variant="outline">{TICKET_COMPLEXITY_LABELS[ticket.complexity]}</Badge>
          </div>

          {isEditMode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  {t('tickets.details.title')}
                </label>
                <Input
                  value={editValues.title}
                  onChange={(event) => setEditValues((prev) => ({ ...prev, title: event.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  {t('tickets.details.description')}
                </label>
                <Textarea
                  value={editValues.description}
                  onChange={(event) => setEditValues((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.dueDate')}
                  </label>
                  <Input
                    type="date"
                    value={editValues.dueDate}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, dueDate: event.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.priority')}
                  </label>
                  <select
                    value={editValues.priority}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, priority: event.target.value as Priority }))}
                    className="mt-1 block w-full rounded-md border border-input bg-input-background px-3 py-2 text-base transition focus-visible:border-ring focus-visible:ring-ring/50"
                  >
                    <option value="LOW">{t('tickets.priority.LOW')}</option>
                    <option value="MEDIUM">{t('tickets.priority.MEDIUM')}</option>
                    <option value="HIGH">{t('tickets.priority.HIGH')}</option>
                    <option value="CRITICAL">{t('tickets.priority.CRITICAL')}</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{ticket.description || '-'}</div>
          )}

          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div><span className="text-muted-foreground">{t('tickets.details.project')}</span> {project?.name ?? ticket.projectId}</div>
            <div><span className="text-muted-foreground">{t('tickets.details.wricef')}</span> {ticket.wricefId ?? '-'}</div>
            <div><span className="text-muted-foreground">{t('tickets.details.ticketId')}</span> {ticket.ticketCode}</div>
            <div><span className="text-muted-foreground">{t('tickets.details.createdBy')}</span> {userName(ticket.createdBy)}</div>
            <div><span className="text-muted-foreground">{t('tickets.details.assignedTo')}</span> {userName(ticket.assignedTo)}</div>
            <div>
              <span className="text-muted-foreground">{t('tickets.details.assignedRole')}</span>{' '}
              {ticket.assignedToRole ? t(`roles.${ticket.assignedToRole}`) : '-'}
            </div>
            <div><span className="text-muted-foreground">{t('tickets.details.estimation')}</span> {ticket.estimationHours}h</div>
            <div><span className="text-muted-foreground">{t('tickets.details.effort')}</span> {ticket.effortHours}h</div>
            <div><span className="text-muted-foreground">{t('tickets.details.dueDate')}</span> {ticket.dueDate ? formatDate(ticket.dueDate, i18n.language) : '-'}</div>
            <div><span className="text-muted-foreground">{t('tickets.details.createdAt')}</span> {formatDateTime(ticket.createdAt, i18n.language)}</div>
            <div><span className="text-muted-foreground">{t('tickets.details.updatedAt')}</span> {ticket.updatedAt ? formatDateTime(ticket.updatedAt, i18n.language) : '-'}</div>
            <div>
              <span className="text-muted-foreground">{t('tickets.details.estimatedViaAbaque')}</span>{' '}
              {ticket.estimatedViaAbaque ? t('tickets.details.yes') : t('tickets.details.no')}
            </div>
          </div>

          {ticket.effortComment && (
            <div className="text-sm">
              <span className="text-muted-foreground">{t('tickets.details.effortNote')}</span> {ticket.effortComment}
            </div>
          )}

          <TicketDocumentationSection
            ticket={ticket}
            currentUserId={currentUser.id}
            canEdit={canEditDocumentation}
            resolveUserName={userName}
            onDocumentationChanged={handleDocumentationChanged}
          />

          <TicketCommentThread
            ticketId={ticket.id}
            currentUserId={currentUser.id}
            currentRole={currentUser.role}
            users={users}
          />
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('tickets.details.history')}</h3>
          <div className="space-y-2">
            {sortedHistory.map((event) => (
              <div
                key={event.id}
                className="rounded-md border-l-2 border-primary/30 bg-muted/20 px-3 py-2 text-xs"
              >
                <div className="text-[11px] text-muted-foreground">
                  {formatDateTime(event.timestamp, i18n.language)}
                </div>
                <div className="mt-1">
                  <span className="font-medium">{userName(event.userId)}</span>{' '}
                  {renderEventText(event, userName)}
                </div>
                {event.comment && event.action !== 'COMMENT' && event.action !== 'SENT_TO_TEST' && (
                  <div className="mt-1 text-[11px] text-muted-foreground">{event.comment}</div>
                )}
              </div>
            ))}
            {sortedHistory.length === 0 && (
              <p className="text-xs text-muted-foreground">{t('tickets.details.noHistory')}</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
