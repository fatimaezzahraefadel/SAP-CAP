import React, { useEffect, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, FolderKanban, Ticket as TicketIcon } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { TimesheetsAPI } from '../../services/odata/timesheetsApi';
import { Project, Priority, ProjectStatus, Ticket, Timesheet } from '../../types/entities';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { getFridayOfWeek, getMondayOfWeek, toLocalDateKey } from '../../utils/date';

// Per-KPI colour styling — palette alignée sur les couleurs Inetum (#00aa9b)
const accentStyles = {
  blue:  { value: 'text-primary',          chip: 'bg-primary/10 text-primary',               bar: 'bg-primary' },
  red:   { value: 'text-destructive',       chip: 'bg-destructive/10 text-destructive',        bar: 'bg-destructive' },
  green: { value: 'text-primary',           chip: 'bg-accent text-accent-foreground',          bar: 'bg-primary' },
  amber: { value: 'text-muted-foreground',  chip: 'bg-secondary text-secondary-foreground',    bar: 'bg-muted-foreground' },
} as const;

const priorityColor: Record<Priority, string> = {
  LOW:      'bg-secondary text-secondary-foreground',
  MEDIUM:   'bg-primary/10 text-primary',
  HIGH:     'bg-accent text-accent-foreground',
  CRITICAL: 'bg-destructive/10 text-destructive',
};

const projectStatusColor: Record<ProjectStatus, string> = {
  PLANNED:   'bg-primary/10 text-primary',
  ACTIVE:    'bg-accent text-accent-foreground',
  ON_HOLD:   'bg-secondary text-secondary-foreground',
  COMPLETED: 'bg-muted text-muted-foreground',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export const TechDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const loadDashboardData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [ticketData, allProjects, timesheetData] = await Promise.all([
          TicketsAPI.getByUser(currentUser.id),
          ProjectsAPI.getAll(),
          TimesheetsAPI.getByUser(currentUser.id),
        ]);

        const myProjectIds = new Set(ticketData.map((ticket) => ticket.projectId));
        setTickets(ticketData);
        setProjects(allProjects.filter((project) => myProjectIds.has(project.id)));
        setTimesheets(timesheetData);
      } catch (error) {
        setTickets([]);
        setProjects([]);
        setTimesheets([]);
        const message = error instanceof Error ? error.message : t('common.errors.loadFailed');
        setLoadError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadDashboardData();
  }, [currentUser, t]);

  const myTicketsCount = tickets.length;
  const overdueTickets = tickets.filter(
    (ticket) =>
      ticket.status !== 'DONE' &&
      ticket.status !== 'REJECTED' &&
      Boolean(ticket.dueDate) &&
      new Date(ticket.dueDate as string) < new Date()
  ).length;

  const weekStart = toLocalDateKey(getMondayOfWeek(new Date()));
  const weekEnd = toLocalDateKey(getFridayOfWeek(new Date()));
  const hoursThisWeek = timesheets
    .filter((entry) => entry.date >= weekStart && entry.date <= weekEnd)
    .reduce((sum, entry) => sum + entry.hours, 0);

  const activeProjects = projects.filter((project) => project.status === 'ACTIVE').length;
  const doneTickets = tickets.filter((ticket) => ticket.status === 'DONE').length;
  const completionRate = tickets.length ? (doneTickets / tickets.length) * 100 : 0;

  const progressByStatus: Record<Ticket['status'], number> = {
    PENDING_APPROVAL: 5,
    APPROVED: 10,
    NEW: 0,
    IN_PROGRESS: 50,
    IN_TEST: 80,
    BLOCKED: 40,
    DONE: 100,
    REJECTED: 100,
  };
  const upcomingTickets = tickets
    .filter((ticket) => ticket.status === 'NEW' || ticket.status === 'IN_PROGRESS' || ticket.status === 'IN_TEST')
    .sort(
      (a, b) =>
        new Date(a.dueDate ?? '9999-12-31').getTime() - new Date(b.dueDate ?? '9999-12-31').getTime()
    )
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeader
        title={t('consultant.techDashboard.welcome', { name: currentUser?.name.split(' ')[0] ?? 'Consultant' })}
        subtitle={t('consultant.techDashboard.subtitle')}
        breadcrumbs={[{ label: t('consultant.techDashboard.breadcrumb') }]}
      />

      <div className="space-y-6 p-6 lg:p-8">
        {loadError && (
          <Card className="border-destructive/50">
            <CardContent className="pt-4 text-sm text-destructive">{loadError}</CardContent>
          </Card>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {([
            { key: 'myTickets', label: t('consultant.techDashboard.kpi.myTickets'), value: myTicketsCount, Icon: TicketIcon, accent: 'blue' as const },
            { key: 'overdue', label: t('consultant.techDashboard.kpi.overdueTickets'), value: overdueTickets, Icon: AlertTriangle, accent: 'red' as const },
            { key: 'hours', label: t('consultant.techDashboard.kpi.hoursThisWeek'), value: `${hoursThisWeek}h`, Icon: Clock3, accent: 'green' as const },
            { key: 'projects', label: t('consultant.techDashboard.kpi.activeProjects'), value: activeProjects, Icon: FolderKanban, accent: 'amber' as const },
          ]).map(({ key, label, value, Icon, accent }) => {
            const style = accentStyles[accent];
            return (
              <Card key={key} className="relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                <div className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} />
                <CardContent className="flex items-center justify-between p-5 pl-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className={`mt-2 text-3xl font-semibold tracking-tight ${style.value}`}>{value}</p>
                  </div>
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${style.chip}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
          <Card className="bg-card/92">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{t('consultant.techDashboard.upcomingTickets.title')}</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => navigate('/consultant-tech/tickets')}>
                {t('common.viewAll')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">{t('consultant.techDashboard.upcomingTickets.loading')}</p>
              ) : upcomingTickets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('consultant.techDashboard.upcomingTickets.empty')}</p>
              ) : (
                upcomingTickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => navigate('/consultant-tech/tickets')}
                    className="w-full rounded-xl border border-border/70 bg-surface-1 p-4 text-left transition hover-lift"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{ticket.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{ticket.description}</p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priorityColor[ticket.priority] ?? priorityColor.MEDIUM}`}>
                        {ticket.priority}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {t('consultant.techDashboard.upcomingTickets.due', { date: ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : 'n/a' })}
                      </span>
                      <span>{t('consultant.techDashboard.upcomingTickets.done', { percent: progressByStatus[ticket.status] })}</span>
                    </div>
                    <Progress className="mt-2" value={progressByStatus[ticket.status]} />
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/92">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg">{t('consultant.techDashboard.assignedProjects.title')}</CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/consultant-tech/projects')}
              >
                {t('consultant.techDashboard.assignedProjects.openProjects')}
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('consultant.techDashboard.assignedProjects.empty')}</p>
              ) : (
                projects.map((project) => (
                  <div key={project.id} className="rounded-xl border border-border/70 bg-surface-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{project.name}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {project.description}
                        </p>
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${projectStatusColor[project.status] ?? projectStatusColor.PLANNED}`}>
                        <FolderKanban className="h-3.5 w-3.5" />
                        {project.status}
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t('consultant.techDashboard.assignedProjects.progress')}</span>
                        <span>{project.progress ?? 0}%</span>
                      </div>
                      <Progress value={project.progress ?? 0} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="bg-card/92">
          <CardHeader>
            <CardTitle className="text-lg">{t('consultant.techDashboard.productivity.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/5 p-4 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary" />
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t('consultant.techDashboard.productivity.thisWeek')}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
                <Clock3 className="h-5 w-5 text-primary" />
                {hoursThisWeek}h
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-accent/40 p-4 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary" />
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t('consultant.techDashboard.productivity.ticketsCompleted')}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold text-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {doneTickets}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-primary/5 p-4 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-primary" />
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t('consultant.techDashboard.productivity.completionRate')}</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{completionRate.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
