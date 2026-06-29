import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { EvaluationsAPI } from '../../services/odata/evaluationsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { useAuth } from '../../context/AuthContext';
import { getBaseRouteForRole } from '../../context/roleRouting';
import { Evaluation, Ticket, User } from '../../types/entities';
import {
  ConsultantScore,
  TicketScoreCategory,
  scoreConsultantTickets,
} from '../../features/evaluations/scoring';

const EVALUABLE_ROLES: User['role'][] = ['CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL'];

const CATEGORY_BADGE: Record<TicketScoreCategory, string> = {
  ON_TIME: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  LATE: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  OVERDUE_OPEN: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
  PENDING: 'bg-muted text-muted-foreground',
  NO_DUE_DATE: 'bg-muted text-muted-foreground',
  EXCLUDED: 'bg-muted text-muted-foreground',
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatPoints = (points: number): string => (points > 0 ? `+${points}` : String(points));

export const EvaluationsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState('');
  const [period, setPeriod] = useState('');
  const [scoreInput, setScoreInput] = useState('');
  const [feedback, setFeedback] = useState('');

  const [consultantTickets, setConsultantTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, evaluationData] = await Promise.all([
        UsersAPI.getAll(),
        EvaluationsAPI.getAll(),
      ]);
      setUsers(userData);
      setEvaluations(evaluationData);
    } catch {
      toast.error(t('evaluations.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Load the selected consultant's tickets to compute the score.
  useEffect(() => {
    if (!selectedUserId) {
      setConsultantTickets([]);
      return;
    }
    let cancelled = false;
    setTicketsLoading(true);
    TicketsAPI.getByUser(selectedUserId)
      .then((tickets) => {
        if (!cancelled) setConsultantTickets(tickets);
      })
      .catch(() => {
        if (!cancelled) {
          setConsultantTickets([]);
          toast.error(t('evaluations.toasts.ticketsFailed'));
        }
      })
      .finally(() => {
        if (!cancelled) setTicketsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, t]);

  const score: ConsultantScore = useMemo(
    () => scoreConsultantTickets(consultantTickets, todayKey()),
    [consultantTickets]
  );

  // Pre-fill the (editable) score field with the computed total.
  useEffect(() => {
    setScoreInput(String(score.total));
  }, [score.total]);

  const evaluableUsers = useMemo(
    () => users.filter((user) => user.active && EVALUABLE_ROLES.includes(user.role)),
    [users]
  );

  const userName = (id: string) => users.find((user) => user.id === id)?.name ?? '-';

  const sortedEvaluations = useMemo(
    () => [...evaluations].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [evaluations]
  );

  const resetForm = () => {
    setSelectedUserId('');
    setPeriod('');
    setFeedback('');
    setScoreInput('');
    setConsultantTickets([]);
  };

  const createEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;

    if (!selectedUserId || !period.trim()) {
      toast.error(t('evaluations.toasts.requiredFields'));
      return;
    }
    const finalScore = Number(scoreInput);
    if (!Number.isFinite(finalScore)) {
      toast.error(t('evaluations.toasts.invalidScore'));
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await EvaluationsAPI.create({
        userId: selectedUserId,
        evaluatorId: currentUser.id,
        period: period.trim(),
        score: finalScore,
        feedback: feedback.trim(),
      });
      setEvaluations((prev) => [created, ...prev]);
      resetForm();
      toast.success(t('evaluations.toasts.created'));
    } catch (error) {
      const reason = (error as { message?: string })?.message;
      toast.error(t('evaluations.toasts.createFailed'), {
        ...(reason ? { description: reason } : {}),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleBasePath = currentUser ? getBaseRouteForRole(currentUser.role) : '';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('evaluations.title')}
        subtitle={t('evaluations.subtitleTickets')}
        breadcrumbs={[
          { label: t('common.home'), path: `${roleBasePath}/dashboard` },
          { label: t('evaluations.title') },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3 lg:p-8">
        <Card className="h-fit bg-card/92">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">{t('evaluations.form.title')}</h3>
            <form onSubmit={createEvaluation} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="evaluation-user">{t('evaluations.form.consultant')}</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="evaluation-user">
                    <SelectValue placeholder={t('evaluations.form.selectConsultant')} />
                  </SelectTrigger>
                  <SelectContent>
                    {evaluableUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({t(`roles.${user.role}`)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="evaluation-period">{t('evaluations.form.period')}</Label>
                  <Input
                    id="evaluation-period"
                    placeholder={t('evaluations.form.periodPlaceholder')}
                    value={period}
                    onChange={(event) => setPeriod(event.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evaluation-score">{t('evaluations.form.computedScore')}</Label>
                  <Input
                    id="evaluation-score"
                    type="number"
                    step={1}
                    value={scoreInput}
                    onChange={(event) => setScoreInput(event.target.value)}
                  />
                </div>
              </div>

              {selectedUserId && (
                <div className="rounded-md border border-border/70 p-3 text-xs text-muted-foreground">
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    <span>{t('evaluations.summary.onTime', { count: score.counts.onTime })}</span>
                    <span>{t('evaluations.summary.late', { count: score.counts.late })}</span>
                    <span>{t('evaluations.summary.overdueOpen', { count: score.counts.overdueOpen })}</span>
                    <span>{t('evaluations.summary.pending', { count: score.counts.pending })}</span>
                  </div>
                  <div className="mt-1 font-medium text-foreground">
                    {t('evaluations.summary.computedTotal', { total: formatPoints(score.total) })}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="evaluation-feedback">{t('evaluations.form.feedback')}</Label>
                <Textarea
                  id="evaluation-feedback"
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                />
              </div>

              <Button type="submit" disabled={isSubmitting || !selectedUserId} className="w-full">
                <Plus className="h-4 w-4" />
                {isSubmitting ? t('evaluations.form.saving') : t('evaluations.form.add')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          {/* Ticket-by-ticket breakdown for the selected consultant */}
          <Card className="overflow-hidden bg-card/92">
            <CardContent className="p-0">
              <div className="border-b border-border p-4">
                <h3 className="text-lg font-semibold text-foreground">
                  {t('evaluations.breakdown.title')}
                </h3>
              </div>
              <Table>
                <TableHeader className="bg-muted/65">
                  <TableRow>
                    <TableHead className="px-4">{t('evaluations.breakdown.ticket')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.breakdown.complexity')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.breakdown.status')}</TableHead>
                    <TableHead className="px-4 text-right">{t('evaluations.breakdown.points')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedUserId ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('evaluations.breakdown.selectPrompt')}
                      </TableCell>
                    </TableRow>
                  ) : ticketsLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  ) : score.lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('evaluations.breakdown.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    score.lines.map((line) => (
                      <TableRow key={line.ticketId} className="hover:bg-accent/40">
                        <TableCell className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">{line.ticketCode}</span>{' '}
                          {line.title}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">{line.complexity}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant="outline" className={CATEGORY_BADGE[line.category]}>
                            {t(`evaluations.categories.${line.category}`)}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`px-4 py-3 text-right font-medium ${
                            line.points > 0
                              ? 'text-emerald-600'
                              : line.points < 0
                                ? 'text-destructive'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {formatPoints(line.points)}
                          {line.bonus > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({t('evaluations.breakdown.bonus', { bonus: line.bonus })})
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Saved evaluations history */}
          <Card className="overflow-hidden bg-card/92">
            <CardContent className="p-0">
              <div className="border-b border-border p-4">
                <h3 className="text-lg font-semibold text-foreground">{t('evaluations.list.title')}</h3>
              </div>
              <Table>
                <TableHeader className="bg-muted/65">
                  <TableRow>
                    <TableHead className="px-4">{t('evaluations.list.consultant')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.list.period')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.list.score')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.list.feedback')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  ) : sortedEvaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                        {t('evaluations.list.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEvaluations.map((evaluation) => (
                      <TableRow key={evaluation.id} className="hover:bg-accent/40">
                        <TableCell className="px-4 py-3 font-medium">{userName(evaluation.userId)}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{evaluation.period}</TableCell>
                        <TableCell className="px-4 py-3 font-medium">{formatPoints(evaluation.score)}</TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {evaluation.feedback || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
