import React, { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
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
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { useAuth } from '../../context/AuthContext';
import { getBaseRouteForRole } from '../../context/roleRouting';
import { Evaluation, Project, User } from '../../types/entities';

const GRID_AXES = ['productivity', 'quality', 'autonomy', 'collaboration', 'innovation'] as const;
type Axis = (typeof GRID_AXES)[number];

const EVALUABLE_ROLES: User['role'][] = ['CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL'];
const MAX_SCORE = 20;
const MAX_RATING = 5;

interface FormState {
  userId: string;
  projectId: string;
  period: string;
  score: string;
  grid: Record<Axis, number>;
  feedback: string;
}

const EMPTY_GRID: Record<Axis, number> = {
  productivity: 3,
  quality: 3,
  autonomy: 3,
  collaboration: 3,
  innovation: 3,
};

const EMPTY_FORM: FormState = {
  userId: '',
  projectId: '',
  period: '',
  score: '',
  grid: { ...EMPTY_GRID },
  feedback: '',
};

export const EvaluationsManagement: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, projectData, evaluationData] = await Promise.all([
        UsersAPI.getAll(),
        ProjectsAPI.getAll(),
        EvaluationsAPI.getAll(),
      ]);
      setUsers(userData);
      setProjects(projectData);
      setEvaluations(evaluationData);
    } catch {
      toast.error(t('evaluations.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const evaluableUsers = useMemo(
    () => users.filter((user) => user.active && EVALUABLE_ROLES.includes(user.role)),
    [users]
  );

  const userName = (id: string) => users.find((user) => user.id === id)?.name ?? '-';
  const projectName = (id: string) => projects.find((project) => project.id === id)?.name ?? '-';

  const sortedEvaluations = useMemo(
    () =>
      [...evaluations].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [evaluations]
  );

  const setGridAxis = (axis: Axis, value: number) =>
    setForm((prev) => ({
      ...prev,
      grid: { ...prev.grid, [axis]: Math.max(0, Math.min(MAX_RATING, value)) },
    }));

  const createEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser) return;

    if (!form.userId || !form.projectId || !form.period.trim()) {
      toast.error(t('evaluations.toasts.requiredFields'));
      return;
    }
    const score = Number(form.score);
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      toast.error(t('evaluations.toasts.invalidScore', { max: MAX_SCORE }));
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await EvaluationsAPI.create({
        userId: form.userId,
        evaluatorId: currentUser.id,
        projectId: form.projectId,
        period: form.period.trim(),
        score,
        qualitativeGrid: form.grid,
        feedback: form.feedback.trim(),
      });
      setEvaluations((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
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
        subtitle={t('evaluations.subtitle')}
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
                <Select
                  value={form.userId}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, userId: val }))}
                >
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

              <div className="space-y-1.5">
                <Label htmlFor="evaluation-project">{t('evaluations.form.project')}</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, projectId: val }))}
                >
                  <SelectTrigger id="evaluation-project">
                    <SelectValue placeholder={t('evaluations.form.selectProject')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
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
                    value={form.period}
                    onChange={(event) => setForm((prev) => ({ ...prev, period: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="evaluation-score">{t('evaluations.form.score', { max: MAX_SCORE })}</Label>
                  <Input
                    id="evaluation-score"
                    type="number"
                    min={0}
                    max={MAX_SCORE}
                    step={0.5}
                    value={form.score}
                    onChange={(event) => setForm((prev) => ({ ...prev, score: event.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-border/70 p-3">
                <p className="text-sm font-medium text-foreground">
                  {t('evaluations.form.gridTitle', { max: MAX_RATING })}
                </p>
                {GRID_AXES.map((axis) => (
                  <div key={axis} className="flex items-center justify-between gap-3">
                    <Label htmlFor={`axis-${axis}`} className="text-sm text-muted-foreground">
                      {t(`evaluations.axes.${axis}`)}
                    </Label>
                    <Input
                      id={`axis-${axis}`}
                      type="number"
                      min={0}
                      max={MAX_RATING}
                      step={1}
                      value={form.grid[axis]}
                      className="h-8 w-20"
                      onChange={(event) => setGridAxis(axis, Number(event.target.value || 0))}
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="evaluation-feedback">{t('evaluations.form.feedback')}</Label>
                <Textarea
                  id="evaluation-feedback"
                  value={form.feedback}
                  onChange={(event) => setForm((prev) => ({ ...prev, feedback: event.target.value }))}
                />
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4" />
                {isSubmitting ? t('evaluations.form.saving') : t('evaluations.form.add')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card/92 xl:col-span-2">
          <CardContent className="p-0">
            <div className="border-b border-border p-4">
              <h3 className="text-lg font-semibold text-foreground">{t('evaluations.list.title')}</h3>
            </div>
            <Table>
              <TableHeader className="bg-muted/65">
                <TableRow>
                  <TableHead className="px-4">{t('evaluations.list.consultant')}</TableHead>
                  <TableHead className="px-4">{t('evaluations.list.project')}</TableHead>
                  <TableHead className="px-4">{t('evaluations.list.period')}</TableHead>
                  <TableHead className="px-4">{t('evaluations.list.score')}</TableHead>
                  <TableHead className="px-4">{t('evaluations.list.grid')}</TableHead>
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
                      <TableCell className="px-4 py-3">{projectName(evaluation.projectId)}</TableCell>
                      <TableCell className="px-4 py-3 text-muted-foreground">{evaluation.period}</TableCell>
                      <TableCell className="px-4 py-3 font-medium">
                        {evaluation.score}/{MAX_SCORE}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        {GRID_AXES.map((axis) => `${t(`evaluations.axes.${axis}`)}: ${evaluation.qualitativeGrid[axis]}`).join(' · ')}
                      </TableCell>
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
  );
};
