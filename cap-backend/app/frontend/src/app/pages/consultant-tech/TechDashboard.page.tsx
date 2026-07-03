import React, { useEffect, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock3, FolderKanban } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { useAuth } from '../../context/AuthContext';import { ProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { TimesheetsAPI } from '../../services/odata/timesheetsApi';
import { Project, Ticket, Timesheet } from '../../types/entities';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { getFridayOfWeek, getMondayOfWeek, toLocalDateKey } from '../../utils/date';

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
          <KPICard title={t('consultant.techDashboard.kpi.myTickets')} value={myTicketsCount} icon="ticket" color="blue" />
          <KPICard title={t('consultant.techDashboard.kpi.overdueTickets')} value={overdueTickets} icon="alert" color="red" />
          <KPICard title={t('consultant.techDashboard.kpi.hoursThisWeek')} value={hoursThisWeek} icon="timesheet" color="green" />
          <KPICard
            title={t('consultant.techDashboard.kpi.activeProjects')}
            value={activeProjects}
            icon="project-definition-triangle-2"
            color="yellow"
          />
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
                      <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2 py-1 text-xs font-medium text-primary">
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
            <div className="relative overflow-hidden rounded-xl border border-blue-500/25 bg-gradient-to-br from-blue-500/10 to-transparent p-4 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-400" />
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t('consultant.techDashboard.productivity.thisWeek')}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-blue-600 dark:text-blue-400">
                <Clock3 className="h-5 w-5" />
                {hoursThisWeek}h
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-transparent p-4 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-500 to-teal-400" />
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t('consultant.techDashboard.productivity.ticketsCompleted')}</p>
              <p className="mt-2 inline-flex items-center gap-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                {doneTickets}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-purple-500/25 bg-gradient-to-br from-purple-500/10 to-transparent p-4 transition-transform duration-300 hover:-translate-y-0.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-purple-500 to-fuchsia-400" />
              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{t('consultant.techDashboard.productivity.completionRate')}</p>
              <p className="mt-2 bg-gradient-to-br from-purple-600 to-fuchsia-500 bg-clip-text text-2xl font-bold text-transparent">{completionRate.toFixed(0)}%</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
