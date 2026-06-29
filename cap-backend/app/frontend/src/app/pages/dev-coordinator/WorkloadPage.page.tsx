import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { Ticket, User } from '../../types/entities';

const WorkloadPage: React.FC = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [t, u] = await Promise.all([TicketsAPI.getAll(), UsersAPI.getAll()]);
        setTickets(t);
        setUsers(u);
      } catch {
        setTickets([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const consultants = useMemo(
    () => users.filter((u) => u.role === 'CONSULTANT_TECHNIQUE' || u.role === 'CONSULTANT_FONCTIONNEL'),
    [users]
  );

  const workload = useMemo(() => {
    return consultants.map((c) => {
      const allAssigned = tickets.filter((t) => t.assignedTo === c.id);
      const active = allAssigned.filter((t) => t.status !== 'DONE' && t.status !== 'REJECTED');
      const done = allAssigned.filter((t) => t.status === 'DONE');
      const totalEffort = allAssigned.reduce((sum, t) => sum + (Number(t.effortHours) || 0), 0);
      const activeEffort = active.reduce((sum, t) => sum + (Number(t.effortHours) || 0), 0);

      // Nature breakdown
      const natures = active.reduce<Record<string, number>>((acc, t) => {
        acc[t.nature] = (acc[t.nature] || 0) + 1;
        return acc;
      }, {});

      return {
        user: c,
        activeCount: active.length,
        doneCount: done.length,
        totalEffort,
        activeEffort,
        natures,
        loadPercent: Math.min(100, (active.length / Math.max(1, 5)) * 100), // assume 5 tickets = 100%
      };
    }).sort((a, b) => b.activeCount - a.activeCount);
  }, [consultants, tickets]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title={t('coordinator.workload.title')}
        subtitle={t('coordinator.workload.subtitle')}
      />

      <div className="space-y-4">
        {workload.map(({ user, activeCount, doneCount, totalEffort, activeEffort, natures, loadPercent }) => (
          <Card key={user.id} className="border-border/80 bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">{user.name}</CardTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{t(`roles.${user.role}`)}</Badge>
                  <span className={`text-xs ${user.availabilityPercent >= 80 ? 'text-green-600' : user.availabilityPercent >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {t('coordinator.workload.available', { percent: user.availabilityPercent })}
                  </span>
                </div>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold">{t('coordinator.workload.counts', { active: activeCount, done: doneCount })}</p>
                <p className="text-xs text-muted-foreground">{t('coordinator.workload.effort', { total: totalEffort, active: activeEffort })}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Load bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('coordinator.workload.ticketLoad')}</span>
                  <span>{loadPercent.toFixed(0)}%</span>
                </div>
                <Progress value={loadPercent} className="h-2" />
              </div>

              {/* Nature breakdown */}
              {Object.keys(natures).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {Object.entries(natures).map(([nature, count]) => (
                    <Badge key={nature} variant="secondary" className="text-xs">
                      {t(`entities.ticketNature.${nature}`)} ({count})
                    </Badge>
                  ))}
                </div>
              )}

              {/* Skills */}
              <div className="flex flex-wrap gap-1">
                {user.skills.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {workload.length === 0 && (
          <Card className="border-border/80 bg-card">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="mb-2 h-10 w-10" />
              <p>{t('coordinator.workload.noConsultants')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WorkloadPage;
