import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { KPICard } from '../../components/common/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { AllocationsAPI } from '../../services/odata/allocationsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { Allocation, Ticket, TicketStatus, User } from '../../types/entities';
import { computeProductivityMetrics, computeTace } from '../../features/dashboard/model';

export const ManagerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [fetchedTickets, fetchedUsers, fetchedAllocations] = await Promise.all([
        TicketsAPI.getAll(),
        UsersAPI.getAll(),
        AllocationsAPI.getAll(),
      ]);
      setTickets(fetchedTickets);
      setUsers(fetchedUsers);
      setAllocations(fetchedAllocations);
    } catch {
      setLoadError(t('dashboard.manager.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const tace = useMemo(
    () => computeTace(users, allocations, new Date().toISOString().slice(0, 10)),
    [users, allocations]
  );

  const productivityMetrics = useMemo(() => computeProductivityMetrics(tickets), [tickets]);

  const ticketBreakdown = useMemo(() => {
    const counts = tickets.reduce<Record<TicketStatus, number>>(
      (acc, ticket) => {
        acc[ticket.status] += 1;
        return acc;
      },
      {
        PENDING_APPROVAL: 0,
        APPROVED: 0,
        NEW: 0,
        IN_PROGRESS: 0,
        IN_TEST: 0,
        BLOCKED: 0,
        DONE: 0,
        REJECTED: 0,
      }
    );

    return (Object.entries(counts) as Array<[TicketStatus, number]>)
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({
        label: t(`entities.ticketStatus.${status}`),
        count,
      }));
  }, [tickets, t]);

  const criticalAlerts = useMemo(() => {
    const today = new Date();
    const blocked = tickets
      .filter((ticket) => ticket.status === 'BLOCKED')
      .slice(0, 3)
      .map((ticket) => ({
        type: 'blocked' as const,
        label: t('dashboard.manager.criticalAlerts.labels.blocked'),
        message: ticket.title,
      }));

    const overdue = tickets
      .filter(
        (ticket) =>
          ticket.status !== 'DONE' &&
          ticket.status !== 'REJECTED' &&
          Boolean(ticket.dueDate) &&
          new Date(ticket.dueDate as string) < today
      )
      .slice(0, 3)
      .map((ticket) => ({
        type: 'deadline' as const,
        label: t('dashboard.manager.criticalAlerts.labels.deadline'),
        message: `${ticket.title} - ${t('dashboard.manager.criticalAlerts.messages.overdue', {
          date: new Date(ticket.dueDate as string).toLocaleDateString(),
        })}`,
      }));

    return [...blocked, ...overdue].slice(0, 4);
  }, [tickets, t]);

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeader
        title={t('dashboard.manager.title')}
        subtitle={t('dashboard.manager.subtitle')}
        breadcrumbs={[
          { label: t('documentation.home'), path: '/manager/dashboard' },
          { label: t('dashboard.manager.title') },
        ]}
      />

      <div className="space-y-4 p-4 sm:space-y-6 sm:p-6 lg:p-8">
        {loadError && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" variant="outline" onClick={() => void loadData()}>
                {t('dashboard.manager.retry')}
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <>
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="border-border/80 bg-card">
                  <CardContent className="space-y-3 p-6">
                    <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                    <div className="h-8 w-16 animate-pulse rounded bg-muted" />
                    <div className="h-2 w-full animate-pulse rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </section>

            <div className="grid items-start gap-4 sm:gap-6 xl:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Card key={index} className="border-border/80 bg-card">
                  <CardHeader>
                    <CardTitle className="text-lg">{t('common.loading')}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.from({ length: 3 }).map((__, rowIndex) => (
                      <div key={rowIndex} className="rounded-md border border-border/70 p-3">
                        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                        <div className="mt-2 h-3 w-20 animate-pulse rounded bg-muted" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : (
          <>
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            title={t('dashboard.manager.kpi.tace.title')}
            value={tace}
            unit="%"
            subtitle={t('dashboard.manager.kpi.tace.subtitle')}
            icon="performance"
            state={tace >= 80 ? 'Positive' : tace >= 50 ? 'Warning' : 'Error'}
            progress={tace}
          />
          <KPICard
            title={t('dashboard.manager.kpi.sla.title')}
            value={Math.round(productivityMetrics.slaRate)}
            unit="%"
            subtitle={t('dashboard.manager.kpi.sla.subtitle', {
              onTime: productivityMetrics.slaOnTime,
              total: productivityMetrics.slaTotal,
            })}
            icon="accept"
            state={
              productivityMetrics.slaRate >= 90
                ? 'Positive'
                : productivityMetrics.slaRate >= 70
                ? 'Warning'
                : 'Error'
            }
            progress={productivityMetrics.slaRate}
          />
          <KPICard
            title={t('dashboard.manager.kpi.throughput.title')}
            value={Math.round(productivityMetrics.throughputRate)}
            unit="%"
            subtitle={t('dashboard.manager.kpi.throughput.subtitle')}
            icon="trend-up"
            state={productivityMetrics.throughputRate >= 70 ? 'Positive' : 'Warning'}
            progress={productivityMetrics.throughputRate}
          />
          <KPICard
            title={t('dashboard.manager.kpi.risks.title')}
            value={productivityMetrics.criticalIssues}
            subtitle={t('dashboard.manager.kpi.risks.subtitle')}
            icon="warning"
            state={productivityMetrics.criticalIssues > 0 ? 'Error' : 'Positive'}
          />
        </section>

        <div className="grid items-start gap-4 sm:gap-6 xl:grid-cols-2">
          <Card className="border-border/80 bg-card">
            <CardHeader>
              <CardTitle className="text-lg">{t('dashboard.manager.deliverySnapshot.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('dashboard.manager.deliverySnapshot.noData')}</p>
              ) : (
                ticketBreakdown.map((entry) => (
                  <div key={entry.label} className="flex items-center justify-between rounded-md border border-border/70 p-3">
                    <span className="text-sm text-foreground">{entry.label}</span>
                    <span className="text-sm font-semibold text-foreground">{entry.count}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <aside className="space-y-4 sm:space-y-6">
            <Card className="border-border/80 bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  {t('dashboard.manager.criticalAlerts.title')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {criticalAlerts.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <CheckCircle2 className="h-4 w-4" />
                    {t('dashboard.manager.criticalAlerts.noAlerts')}
                  </div>
                ) : (
                  criticalAlerts.map((alert, index) => (
                    <div
                      key={index}
                      className={
                        alert.type === 'blocked'
                          ? 'rounded-lg border border-destructive/30 bg-destructive/5 p-3'
                          : 'rounded-lg border border-accent bg-accent/40 p-3'
                      }
                    >
                      <p
                        className={`font-semibold text-xs uppercase tracking-wide ${
                          alert.type === 'blocked' ? 'text-destructive' : 'text-accent-foreground'
                        }`}
                      >
                        {alert.label}
                      </p>
                      <p className="mt-1 text-sm text-foreground">{alert.message}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-primary">{t('dashboard.manager.quickActions.title')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 sm:space-y-3">
                <Button
                  className="w-full justify-start"
                  variant="default"
                  onClick={() => navigate('/manager/pending-approvals')}
                >
                  {t('dashboard.manager.quickActions.pendingApprovals', {
                    count: tickets.filter((t) => t.status === 'PENDING_APPROVAL').length,
                  })}
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  onClick={() => navigate('/manager/allocations')}
                >
                  {t('dashboard.manager.quickActions.viewAllocations')}
                </Button>
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  onClick={() => navigate('/manager/risks')}
                >
                  {t('dashboard.manager.quickActions.openRisks')}
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>
          </>
        )}
      </div>
    </div>
  );
};
