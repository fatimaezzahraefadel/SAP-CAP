import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { FolderKanban, Ticket, AlertTriangle, CheckCircle2, Send } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';import { ImputationPeriodsAPI } from '../../services/odata/imputationPeriodsApi';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { ImputationPeriod, Project, Ticket as TicketType, User, TICKET_STATUS_LABELS, TICKET_NATURE_LABELS } from '../../types/entities';

const ProjectManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [periods, setPeriods] = useState<ImputationPeriod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [p, t, u, periodData] = await Promise.all([
          ProjectsAPI.getAll(),
          TicketsAPI.getAll(),
          UsersAPI.getAll(),
          ImputationPeriodsAPI.getAll(),
        ]);
        setProjects(p);
        setTickets(t);
        setUsers(u);
        setPeriods(periodData);
      } catch {
        setProjects([]);
        setTickets([]);
        setUsers([]);
        setPeriods([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const openTickets = tickets.filter((t) => t.status === 'NEW' || t.status === 'IN_PROGRESS');
  const blockedTickets = tickets.filter((t) => t.status === 'BLOCKED');
  const inTestTickets = tickets.filter((t) => t.status === 'IN_TEST');
  const pendingValidation = periods.filter((period) => period.status === 'SUBMITTED').length;
  const readyToSend = periods.filter(
    (period) => period.status === 'VALIDATED' && !period.sentToStraTIME
  ).length;

  const getUserName = (id?: string) => users.find((u) => u.id === id)?.name ?? '—';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const openTicketFromKeyboard = (
    event: React.KeyboardEvent<HTMLDivElement>,
    ticketId: string
  ) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    navigate(`/project-manager/tickets/${ticketId}`);
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('pm.dashboard.title')}
        subtitle={t('pm.dashboard.subtitle')}
      />

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard title={t('pm.dashboard.kpi.activeProjects')} value={projects.filter((p) => p.status === 'ACTIVE').length} icon={FolderKanban} variant="info" />
        <KPICard title={t('pm.dashboard.kpi.openTickets')} value={openTickets.length} icon={Ticket} variant="warning" />
        <KPICard title={t('pm.dashboard.kpi.inTest')} value={inTestTickets.length} icon={CheckCircle2} variant="success" />
        <KPICard title={t('pm.dashboard.kpi.blocked')} value={blockedTickets.length} icon={AlertTriangle} variant="danger" />
      </div>

      <Card className="border-border/80 bg-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('pm.dashboard.validationPipeline.title')}</CardTitle>
          <Button size="sm" onClick={() => navigate('/project-manager/imputations')}>
            <Send className="mr-1 h-4 w-4" />
            {t('pm.dashboard.validationPipeline.openHub')}
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="relative overflow-hidden rounded-xl border border-amber-500/25 bg-gradient-to-br from-amber-500/10 to-transparent p-4 transition-transform duration-300 hover:-translate-y-0.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-500 to-orange-400" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('pm.dashboard.validationPipeline.submittedPeriods')}</p>
            <p className="mt-1 bg-gradient-to-br from-amber-600 to-orange-500 bg-clip-text text-2xl font-bold text-transparent">{pendingValidation}</p>
            <p className="text-xs text-muted-foreground">{t('pm.dashboard.validationPipeline.waitingForValidation')}</p>
          </div>
          <div className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-4 transition-transform duration-300 hover:-translate-y-0.5">
            <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-400" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('pm.dashboard.validationPipeline.readyForStratime')}</p>
            <p className="mt-1 bg-gradient-to-br from-emerald-600 to-teal-500 bg-clip-text text-2xl font-bold text-transparent">{readyToSend}</p>
            <p className="text-xs text-muted-foreground">{t('pm.dashboard.validationPipeline.readyDescription')}</p>
          </div>
        </CardContent>
      </Card>

      {/* Recent tickets */}
      <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('pm.dashboard.recentTickets.title')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/project-manager/tickets')}>
            {t('pm.dashboard.recentTickets.viewAll')}
          </Button>
        </CardHeader>
        <CardContent>
            <div className="space-y-3">
              {tickets.slice(0, 6).map((ticket) => (
                <div
                  key={ticket.id}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  onClick={() => navigate(`/project-manager/tickets/${ticket.id}`)}
                  onKeyDown={(event) => openTicketFromKeyboard(event, ticket.id)}
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{ticket.title}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{TICKET_NATURE_LABELS[ticket.nature]}</Badge>
                      <Badge variant="secondary">{TICKET_STATUS_LABELS[ticket.status]}</Badge>
                      {ticket.assignedToRole && (
                        <Badge variant="outline" className="text-xs">{t(`roles.${ticket.assignedToRole}`)}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <p>{getUserName(ticket.assignedTo)}</p>
                    <p>{t('pm.dashboard.recentTickets.effort', { hours: ticket.effortHours })}</p>
                  </div>
                </div>
              ))}
            {tickets.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">{t('pm.dashboard.noTickets')}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projects overview */}
      <Card className="border-border/80 bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{t('pm.dashboard.projects.title')}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => navigate('/project-manager/projects')}>
            {t('pm.dashboard.projects.viewAll')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projects.map((project) => {
              const projectTickets = tickets.filter((t) => t.projectId === project.id);
              return (
                <div key={project.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">{project.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{project.progress}%</p>
                    <p className="text-xs text-muted-foreground">
                      {t('pm.dashboard.projects.ticketsCount', { count: projectTickets.length })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectManagerDashboard;
