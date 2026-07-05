import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Plus, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
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
  LATE_POINTS,
  ON_TIME_POINTS,
  OVERDUE_OPEN_POINTS,
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

const CUSTOM_PERIOD = '__custom__';

const todayKey = () => new Date().toISOString().slice(0, 10);

const formatPoints = (points: number): string => (points > 0 ? `+${points}` : String(points));

const formatDate = (value?: string): string => (value ? value.slice(0, 10) : '-');

/** Semesters and quarters around today, most recent first (e.g. "2026-S2"). */
const buildPeriodOptions = (): string[] => {
  const now = new Date();
  const year = now.getFullYear();
  const semester = now.getMonth() < 6 ? 'S1' : 'S2';
  const options = [
    `${year}-${semester}`,
    `${year}-${semester === 'S1' ? 'S2' : 'S1'}`,
    `${year - 1}-S2`,
    `${year - 1}-S1`,
    `${year}-Q1`,
    `${year}-Q2`,
    `${year}-Q3`,
    `${year}-Q4`,
  ];
  return [...new Set(options)];
};

/** Numbered step label used to guide the manager through the form. */
const StepLabel: React.FC<{ step: number; htmlFor?: string; children: React.ReactNode }> = ({
  step,
  htmlFor,
  children,
}) => (
  <Label htmlFor={htmlFor} className="flex items-center gap-2">
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
      {step}
    </span>
    {children}
  </Label>
);

export const EvaluationsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const periodOptions = useMemo(buildPeriodOptions, []);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [periodChoice, setPeriodChoice] = useState(periodOptions[0]);
  const [customPeriod, setCustomPeriod] = useState('');
  const [manualScore, setManualScore] = useState(false);
  const [scoreInput, setScoreInput] = useState('0');
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

  // Keep the editable field in sync with the computed total until the manager
  // explicitly chooses to override it.
  useEffect(() => {
    if (!manualScore) setScoreInput(String(score.total));
  }, [score.total, manualScore]);

  const evaluableUsers = useMemo(
    () => users.filter((user) => user.active && EVALUABLE_ROLES.includes(user.role)),
    [users]
  );

  const userName = (id: string) => users.find((user) => user.id === id)?.name ?? '-';

  const sortedEvaluations = useMemo(
    () => [...evaluations].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [evaluations]
  );

  const period = periodChoice === CUSTOM_PERIOD ? customPeriod.trim() : periodChoice;
  const selectedUser = users.find((user) => user.id === selectedUserId);
  const finalScore = manualScore ? Number(scoreInput) : score.total;

  const duplicateEvaluation = useMemo(
    () =>
      Boolean(selectedUserId && period) &&
      evaluations.some(
        (evaluation) => evaluation.userId === selectedUserId && evaluation.period === period
      ),
    [evaluations, selectedUserId, period]
  );

  const missingSteps = [
    !selectedUserId ? t('evaluations.form.consultant') : null,
    !period ? t('evaluations.form.period') : null,
  ].filter((step): step is string => Boolean(step));

  const canSubmit = missingSteps.length === 0 && Number.isFinite(finalScore) && !isSubmitting;

  const resetForm = () => {
    setSelectedUserId('');
    setPeriodChoice(periodOptions[0]);
    setCustomPeriod('');
    setManualScore(false);
    setScoreInput('0');
    setFeedback('');
    setConsultantTickets([]);
  };

  const createEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || !canSubmit) return;

    try {
      setIsSubmitting(true);
      const created = await EvaluationsAPI.create({
        userId: selectedUserId,
        evaluatorId: currentUser.id,
        period,
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
            <h3 className="text-lg font-semibold text-foreground">{t('evaluations.form.title')}</h3>
            <p className="mb-4 mt-1 text-sm text-muted-foreground">{t('evaluations.form.intro')}</p>

            <form onSubmit={createEvaluation} className="space-y-5">
              {/* Step 1 — who is being evaluated */}
              <div className="space-y-1.5">
                <StepLabel step={1} htmlFor="evaluation-user">
                  {t('evaluations.form.consultant')}
                </StepLabel>
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

              {/* Step 2 — which period the evaluation covers */}
              <div className="space-y-1.5">
                <StepLabel step={2} htmlFor="evaluation-period">
                  {t('evaluations.form.period')}
                </StepLabel>
                <Select value={periodChoice} onValueChange={setPeriodChoice}>
                  <SelectTrigger id="evaluation-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_PERIOD}>{t('evaluations.form.periodCustom')}</SelectItem>
                  </SelectContent>
                </Select>
                {periodChoice === CUSTOM_PERIOD && (
                  <Input
                    aria-label={t('evaluations.form.periodCustom')}
                    placeholder={t('evaluations.form.periodPlaceholder')}
                    value={customPeriod}
                    onChange={(event) => setCustomPeriod(event.target.value)}
                  />
                )}
              </div>

              {/* Step 3 — the score, computed from the consultant's tickets */}
              <div className="space-y-2">
                <StepLabel step={3}>{t('evaluations.form.scoreTitle')}</StepLabel>
                <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                  {!selectedUserId ? (
                    <p className="text-sm text-muted-foreground">
                      {t('evaluations.form.scorePlaceholder')}
                    </p>
                  ) : ticketsLoading ? (
                    <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
                  ) : (
                    <>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-3xl font-bold ${
                            score.total > 0
                              ? 'text-emerald-600'
                              : score.total < 0
                                ? 'text-destructive'
                                : 'text-foreground'
                          }`}
                        >
                          {formatPoints(score.total)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {t('evaluations.form.scoreBasis', { count: consultantTickets.length })}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{t('evaluations.summary.onTime', { count: score.counts.onTime })}</span>
                        <span>{t('evaluations.summary.late', { count: score.counts.late })}</span>
                        <span>{t('evaluations.summary.overdueOpen', { count: score.counts.overdueOpen })}</span>
                        <span>{t('evaluations.summary.pending', { count: score.counts.pending })}</span>
                      </div>
                    </>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <Label htmlFor="evaluation-manual-score" className="text-xs font-normal text-muted-foreground">
                      {t('evaluations.form.manualOverride')}
                    </Label>
                    <Switch
                      id="evaluation-manual-score"
                      checked={manualScore}
                      onCheckedChange={(checked) => {
                        setManualScore(checked);
                        if (!checked) setScoreInput(String(score.total));
                      }}
                    />
                  </div>
                  {manualScore && (
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        id="evaluation-score"
                        aria-label={t('evaluations.form.manualScore')}
                        type="number"
                        step={1}
                        value={scoreInput}
                        onChange={(event) => setScoreInput(event.target.value)}
                        className="h-8"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 shrink-0 gap-1 px-2 text-xs"
                        onClick={() => setScoreInput(String(score.total))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t('evaluations.form.resetScore')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4 — optional feedback */}
              <div className="space-y-1.5">
                <StepLabel step={4} htmlFor="evaluation-feedback">
                  {t('evaluations.form.feedbackOptional')}
                </StepLabel>
                <Textarea
                  id="evaluation-feedback"
                  placeholder={t('evaluations.form.feedbackPlaceholder')}
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                />
              </div>

              {duplicateEvaluation && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {t('evaluations.form.duplicateWarning', {
                    name: selectedUser?.name ?? '',
                    period,
                  })}
                </div>
              )}

              <div className="space-y-1.5">
                <Button type="submit" disabled={!canSubmit} className="w-full">
                  <Plus className="h-4 w-4" />
                  {isSubmitting ? t('evaluations.form.saving') : t('evaluations.form.add')}
                </Button>
                {missingSteps.length > 0 && (
                  <p className="text-center text-xs text-muted-foreground">
                    {t('evaluations.form.missing', { fields: missingSteps.join(', ') })}
                  </p>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          {/* Ticket-by-ticket breakdown for the selected consultant */}
          <Card className="overflow-hidden bg-card/92">
            <CardContent className="p-0">
              <div className="border-b border-border p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold text-foreground">
                    {selectedUser
                      ? t('evaluations.breakdown.titleFor', { name: selectedUser.name })
                      : t('evaluations.breakdown.title')}
                  </h3>
                  {selectedUser && !ticketsLoading && (
                    <span className="text-sm font-medium text-muted-foreground">
                      {t('evaluations.summary.computedTotal', { total: formatPoints(score.total) })}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t('evaluations.breakdown.rules', {
                    onTime: formatPoints(ON_TIME_POINTS),
                    late: formatPoints(LATE_POINTS),
                    overdue: formatPoints(OVERDUE_OPEN_POINTS),
                  })}
                </p>
              </div>
              <Table>
                <TableHeader className="bg-muted/65">
                  <TableRow>
                    <TableHead className="px-4">{t('evaluations.breakdown.ticket')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.breakdown.complexity')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.breakdown.nature')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.breakdown.status')}</TableHead>
                    <TableHead className="px-4 text-right">{t('evaluations.breakdown.points')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedUserId ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {t('evaluations.breakdown.selectPrompt')}
                      </TableCell>
                    </TableRow>
                  ) : ticketsLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  ) : score.lines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
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
                        <TableCell className="px-4 py-3 text-sm">{line.nature}</TableCell>
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
                    <TableHead className="px-4">{t('evaluations.list.evaluator')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.list.date')}</TableHead>
                    <TableHead className="px-4">{t('evaluations.list.feedback')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {t('common.loading')}
                      </TableCell>
                    </TableRow>
                  ) : sortedEvaluations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        {t('evaluations.list.empty')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    sortedEvaluations.map((evaluation) => (
                      <TableRow key={evaluation.id} className="hover:bg-accent/40">
                        <TableCell className="px-4 py-3 font-medium">{userName(evaluation.userId)}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{evaluation.period}</TableCell>
                        <TableCell
                          className={`px-4 py-3 font-medium ${
                            evaluation.score > 0
                              ? 'text-emerald-600'
                              : evaluation.score < 0
                                ? 'text-destructive'
                                : ''
                          }`}
                        >
                          {formatPoints(evaluation.score)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {userName(evaluation.evaluatorId)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(evaluation.createdAt)}
                        </TableCell>
                        <TableCell className="max-w-xs px-4 py-3 text-sm text-muted-foreground">
                          <span className="line-clamp-2">{evaluation.feedback || '-'}</span>
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
