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
  SAPModule,
  Ticket,
  TicketComplexity,
  TicketEvent,
  TicketNature,
  TicketStatus,
  TICKET_COMPLEXITY_LABELS,
  TICKET_NATURE_LABELS,
  User,
} from '../../types/entities';
import { formatDate, formatDateTime } from '../../utils/date';

// Mirrors the backend ticket state machine (srv/ticket/tickets.validation.js)
// so the status dropdown only offers transitions the server will accept.
const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  PENDING_APPROVAL: ['NEW', 'REJECTED'],
  APPROVED: ['NEW', 'IN_PROGRESS', 'REJECTED'],
  NEW: ['IN_PROGRESS', 'BLOCKED', 'REJECTED'],
  IN_PROGRESS: ['IN_TEST', 'BLOCKED', 'DONE', 'REJECTED'],
  IN_TEST: ['DONE', 'IN_PROGRESS', 'REJECTED'],
  BLOCKED: ['IN_PROGRESS', 'REJECTED'],
  DONE: [],
  REJECTED: ['NEW', 'PENDING_APPROVAL'],
};

const SELECT_CLASS =
  'mt-1 block w-full rounded-md border border-input bg-input-background px-3 py-2 text-base transition focus-visible:border-ring focus-visible:ring-ring/50';

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
    nature: 'PROGRAMME' as TicketNature,
    module: '' as SAPModule | '',
    complexity: 'SIMPLE' as TicketComplexity,
    status: 'NEW' as TicketStatus,
    assignedTo: '',
    estimationHours: '0',
    effortHours: '0',
    effortComment: '',
    wricefId: '',
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

  const buildEditValues = useCallback(
    (source: Ticket) => ({
      title: source.title,
      description: source.description,
      dueDate: source.dueDate ? source.dueDate.split('T')[0] : '',
      priority: source.priority,
      nature: source.nature,
      module: (source.module ?? '') as SAPModule | '',
      complexity: source.complexity,
      status: source.status,
      assignedTo: source.assignedTo ?? '',
      estimationHours: String(source.estimationHours ?? 0),
      effortHours: String(source.effortHours ?? 0),
      effortComment: source.effortComment ?? '',
      wricefId: source.wricefId ?? '',
    }),
    []
  );

  useEffect(() => {
    if (!ticket) return;
    setEditValues(buildEditValues(ticket));
  }, [ticket, buildEditValues]);

  const handleSaveTicket = async () => {
    if (!ticket) return;

    if (!editValues.title.trim()) {
      toast.error(t('tickets.details.titleRequired') || 'Title is required');
      return;
    }

    setIsSaving(true);
    try {
      const assignedUser = editValues.assignedTo
        ? users.find((user) => user.id === editValues.assignedTo)
        : undefined;

      const payload: Partial<Ticket> = {
        title: editValues.title.trim(),
        description: editValues.description.trim(),
        dueDate: editValues.dueDate || undefined,
        priority: editValues.priority,
        nature: editValues.nature,
        module: editValues.module || null,
        complexity: editValues.complexity,
        estimationHours: Number(editValues.estimationHours) || 0,
        effortHours: Number(editValues.effortHours) || 0,
        effortComment: editValues.effortComment.trim() || undefined,
        wricefId: editValues.wricefId.trim() || null,
        assignedTo: editValues.assignedTo || undefined,
        assignedToRole: editValues.assignedTo ? assignedUser?.role : undefined,
      };

      // Status follows the backend state machine — only send it when it changed.
      if (editValues.status !== ticket.status) {
        payload.status = editValues.status;
      }

      const updated = await TicketsAPI.update(ticket.id, payload);
      setTicket(updated);
      toast.success(t('tickets.details.updateSuccess') || 'Ticket updated successfully');
      setIsEditMode(false);
    } catch {
      toast.error(t('tickets.details.updateFailed') || 'Failed to update ticket');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (!ticket) return;
    setEditValues(buildEditValues(ticket));
    setIsEditMode(false);
  };

  useEffect(() => {
    if (!ticketId || !currentUser) return;

    const load = async () => {
      setLoading(true);
      try {
        const [found, allProjects, allUsers] = await Promise.all([
          TicketsAPI.getById(ticketId),
          ProjectsAPI.getAll(),
          UsersAPI.getAll(),
        ]);
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
  const statusOptions: TicketStatus[] = [ticket.status, ...STATUS_TRANSITIONS[ticket.status]];
  const assignableUsers = users.filter((user) => user.active);

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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.status') || 'Status'}
                  </label>
                  <select
                    value={editValues.status}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, status: event.target.value as TicketStatus }))}
                    className={SELECT_CLASS}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{t(`tickets.status.${option}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.priority')}
                  </label>
                  <select
                    value={editValues.priority}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, priority: event.target.value as Priority }))}
                    className={SELECT_CLASS}
                  >
                    <option value="LOW">{t('tickets.priority.LOW')}</option>
                    <option value="MEDIUM">{t('tickets.priority.MEDIUM')}</option>
                    <option value="HIGH">{t('tickets.priority.HIGH')}</option>
                    <option value="CRITICAL">{t('tickets.priority.CRITICAL')}</option>
                  </select>
                </div>
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
                    {t('common.nature') || t('tickets.details.nature') || 'Nature'}
                  </label>
                  <select
                    value={editValues.nature}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, nature: event.target.value as TicketNature }))}
                    className={SELECT_CLASS}
                  >
                    {(Object.keys(TICKET_NATURE_LABELS) as TicketNature[]).map((option) => (
                      <option key={option} value={option}>{TICKET_NATURE_LABELS[option]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('common.module') || 'Module'}
                  </label>
                  <select
                    value={editValues.module}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, module: event.target.value as SAPModule | '' }))}
                    className={SELECT_CLASS}
                  >
                    <option value="">-</option>
                    {(Object.keys(SAP_MODULE_LABELS) as SAPModule[]).map((option) => (
                      <option key={option} value={option}>{SAP_MODULE_LABELS[option]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('common.complexity') || 'Complexity'}
                  </label>
                  <select
                    value={editValues.complexity}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, complexity: event.target.value as TicketComplexity }))}
                    className={SELECT_CLASS}
                  >
                    {(Object.keys(TICKET_COMPLEXITY_LABELS) as TicketComplexity[]).map((option) => (
                      <option key={option} value={option}>{TICKET_COMPLEXITY_LABELS[option]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.assignedTo')}
                  </label>
                  <select
                    value={editValues.assignedTo}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, assignedTo: event.target.value }))}
                    className={SELECT_CLASS}
                  >
                    <option value="">-</option>
                    {assignableUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name} ({t(`roles.${user.role}`)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.estimation')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editValues.estimationHours}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, estimationHours: event.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.effort')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={editValues.effortHours}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, effortHours: event.target.value }))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground">
                    {t('tickets.details.wricef')}
                  </label>
                  <Input
                    value={editValues.wricefId}
                    onChange={(event) => setEditValues((prev) => ({ ...prev, wricefId: event.target.value }))}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground">
                  {t('tickets.details.effortNote')}
                </label>
                <Textarea
                  value={editValues.effortComment}
                  onChange={(event) => setEditValues((prev) => ({ ...prev, effortComment: event.target.value }))}
                  className="mt-1"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground sm:grid-cols-3">
                <div>{t('tickets.details.project')} {project?.name ?? ticket.projectId}</div>
                <div>{t('tickets.details.ticketId')} {ticket.ticketCode}</div>
                <div>{t('tickets.details.createdBy')} {userName(ticket.createdBy)}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{ticket.description || '-'}</div>
          )}

          {!isEditMode && (
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
          )}

          {!isEditMode && ticket.effortComment && (
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
