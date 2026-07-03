import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, UserCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Progress } from '../../components/ui/progress';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { assigneeRecommender } from '../../services/aiRecommender';
import {
  Ticket,
  User,
  AssigneeRecommendation,
} from '../../types/entities';

const AIDispatchPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [recommendations, setRecommendations] = useState<AssigneeRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [recommending, setRecommending] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [tData, uData] = await Promise.all([TicketsAPI.getAll(), UsersAPI.getAll()]);
        setTickets(tData);
        setUsers(uData);
      } catch {
        setTickets([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const unassignedTickets = tickets.filter((ticket) => !ticket.assignedTo && ticket.status === 'NEW');
  const selectedTicket = tickets.find((ticket) => ticket.id === selectedTicketId);

  const runRecommendation = useCallback(async () => {
    if (!selectedTicket) return;
    setRecommending(true);
    try {
      const recs = await assigneeRecommender.recommend(selectedTicket, users, tickets);
      setRecommendations(recs);
    } finally {
      setRecommending(false);
    }
  }, [selectedTicket, users, tickets]);

  const handleAssign = async (userId: string) => {
    if (!selectedTicket) return;
    const user = users.find((candidate) => candidate.id === userId);
    if (!user) return;

    try {
      await TicketsAPI.update(selectedTicket.id, {
        assignedTo: userId,
        assignedToRole: user.role,
        status: selectedTicket.status === 'NEW' ? 'IN_PROGRESS' : selectedTicket.status,
      });

      toast.success(t('coordinator.dispatch.toasts.assigned'), {
        description: t('coordinator.dispatch.toasts.assignedDesc', {
          title: selectedTicket.title,
          name: user.name,
          role: t(`roles.${user.role}`),
        }),
      });

      const refreshed = await TicketsAPI.getAll();
      setTickets(refreshed);
      setSelectedTicketId('');
      setRecommendations([]);
    } catch {
      toast.error(t('coordinator.dispatch.toasts.assignFailed'));
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageHeader
          title={t('coordinator.dispatch.title')}
          subtitle={t('coordinator.dispatch.subtitle')}
        />
      </div>

      <Card className="border-border/80 bg-card">
        <CardHeader>
          <CardTitle className="text-lg">{t('coordinator.dispatch.step1')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedTicketId} onValueChange={setSelectedTicketId}>
            <SelectTrigger>
              <SelectValue placeholder={t('coordinator.dispatch.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {unassignedTickets.map((ticket) => (
                <SelectItem key={ticket.id} value={ticket.id}>
                  [{t(`entities.ticketNature.${ticket.nature}`)}] {ticket.title} ({t(`entities.priority.${ticket.priority}`)})
                </SelectItem>
              ))}
              {unassignedTickets.length === 0 && (
                <SelectItem value="__none" disabled>{t('coordinator.dispatch.noUnassigned')}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {selectedTicket && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
              <p className="font-medium">{selectedTicket.title}</p>
              <p className="text-sm text-muted-foreground">{selectedTicket.description}</p>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline">{t(`entities.ticketNature.${selectedTicket.nature}`)}</Badge>
                <Badge variant="secondary">{t(`entities.priority.${selectedTicket.priority}`)}</Badge>
                <Badge>{t(`entities.ticketStatus.${selectedTicket.status}`)}</Badge>
                {selectedTicket.tags?.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}

          <Button
            disabled={!selectedTicket || recommending}
            onClick={runRecommendation}
            className="w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {recommending ? t('coordinator.dispatch.analyzing') : t('coordinator.dispatch.suggest')}
          </Button>
        </CardContent>
      </Card>

      {recommendations.length > 0 && (
        <Card className="border-border/80 bg-card">
          <CardHeader>
            <CardTitle className="text-lg">{t('coordinator.dispatch.step2')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec, index) => {
                const rawRecId = String((rec as any).userId || (rec as any).id || '').toLowerCase();
                const user = users.find((candidate) => candidate.id.toLowerCase() === rawRecId);
                if (!user) {
                  console.warn('AI recommended an unknown user ID:', (rec as any).userId || (rec as any).id, 'Full rec:', rec);
                  return null;
                }

                return (
                  <div key={rawRecId} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <Badge className="mt-0.5 border border-primary/20 bg-primary/10 text-xs font-medium text-primary">
                            {t(`roles.${user.role}`)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-primary">{(rec.score ?? 0).toFixed(0)}</span>
                        <Button size="sm" onClick={() => handleAssign(rec.userId)}>
                          <UserCheck className="mr-1 h-4 w-4" /> {t('coordinator.dispatch.assign')}
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-muted-foreground">{t('coordinator.dispatch.factors.availability')}</span>
                          <span className="font-semibold">{(rec.factors.availabilityScore ?? 0).toFixed(0)}/100</span>
                        </div>
                        <Progress value={rec.factors.availabilityScore ?? 0} className="h-2.5 bg-emerald-100 dark:bg-emerald-950 [&>[data-slot=progress-indicator]]:bg-emerald-500" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-muted-foreground">{t('coordinator.dispatch.factors.skillsMatch')}</span>
                          <span className="font-semibold">{(rec.factors.skillsMatchScore ?? 0).toFixed(0)}/100</span>
                        </div>
                        <Progress value={rec.factors.skillsMatchScore ?? 0} className="h-2.5 bg-blue-100 dark:bg-blue-950 [&>[data-slot=progress-indicator]]:bg-blue-500" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-muted-foreground">{t('coordinator.dispatch.factors.performance')}</span>
                          <span className="font-semibold">{(rec.factors.performanceScore ?? 0).toFixed(0)}/100</span>
                        </div>
                        <Progress value={rec.factors.performanceScore ?? 0} className="h-2.5 bg-amber-100 dark:bg-amber-950 [&>[data-slot=progress-indicator]]:bg-amber-500" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="text-muted-foreground">{t('coordinator.dispatch.factors.similarTickets')}</span>
                          <span className="font-semibold">{(rec.factors.similarTicketsScore ?? 0).toFixed(0)}/100</span>
                        </div>
                        <Progress value={rec.factors.similarTicketsScore ?? 0} className="h-2.5 bg-violet-100 dark:bg-violet-950 [&>[data-slot=progress-indicator]]:bg-violet-500" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {user.skills.map((skill) => (
                        <Badge key={skill} variant="outline" className="text-xs">{skill}</Badge>
                      ))}
                    </div>

                    {rec.explanation && (
                      <div className="mt-3 rounded bg-primary/5 p-3 text-sm text-muted-foreground border border-primary/20">
                        <p className="flex items-center gap-2 font-semibold text-primary mb-1">
                          <Sparkles className="h-4 w-4" /> AI Recommendation
                        </p>
                        <p className="italic">{rec.explanation}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {recommendations.length > 0 && !recommendations[0]?.explanation && (
        <Card className="border-border/80 bg-card mt-6">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">{t('coordinator.dispatch.algorithm.title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>{t('coordinator.dispatch.algorithm.formula')}</p>
            <p>{t('coordinator.dispatch.algorithm.availability')}</p>
            <p>{t('coordinator.dispatch.algorithm.skillsMatch')}</p>
            <p>{t('coordinator.dispatch.algorithm.performance')}</p>
            <p>{t('coordinator.dispatch.algorithm.similarTickets')}</p>
            <p className="pt-2 italic text-muted-foreground/70">{t('coordinator.dispatch.algorithm.engine')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AIDispatchPage;
