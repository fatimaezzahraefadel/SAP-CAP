import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';import { DeliverablesAPI } from '../../services/odata/deliverablesApi';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { ProjectFeedbackAPI } from '../../services/odata/projectFeedbackApi';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { Deliverable, Project, ProjectFeedback, Ticket, User } from '../../types/entities';
import { useAuth } from '../../context/AuthContext';
import { Textarea } from '../../components/ui/textarea';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { AlertCircle, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

const COUNT_STYLES = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
} as const;

const renderCount = (value: number, tone: keyof typeof COUNT_STYLES) => (
  <span
    className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-semibold ${
      value > 0 ? COUNT_STYLES[tone] : 'bg-muted text-muted-foreground'
    }`}
  >
    {value}
  </span>
);

export const FuncProjects: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [feedbackHistory, setFeedbackHistory] = useState<Record<string, ProjectFeedback[]>>({});
  const [errorPopup, setErrorPopup] = useState<string | null>(null);
  const [feedbackTarget, setFeedbackTarget] = useState<{ project: Project; manager?: User } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [projectData, deliverableData, ticketData, userData] = await Promise.all([
        ProjectsAPI.getAll(),
        DeliverablesAPI.getAll(),
        TicketsAPI.getAll(),
        UsersAPI.getAll(),
      ]);
      setProjects(projectData);
      setDeliverables(deliverableData);
      setTickets(ticketData);
      setUsers(userData);

      // Load feedback history for all projects
      const feedbackResults = await Promise.all(
        projectData.map((p) => ProjectFeedbackAPI.getByProject(p.id))
      );
      const historyMap: Record<string, ProjectFeedback[]> = {};
      projectData.forEach((p, i) => {
        if (feedbackResults[i].length > 0) {
          historyMap[p.id] = feedbackResults[i];
        }
      });
      setFeedbackHistory(historyMap);
    } catch (error) {
      setProjects([]);
      setDeliverables([]);
      setTickets([]);
      setUsers([]);
      const message = error instanceof Error ? error.message : t('func.deliverables.toasts.loadFailed');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rows = useMemo(() => {
    return projects.map((project) => {
      const projectDeliverables = deliverables.filter((deliverable) => deliverable.projectId === project.id);
      const pending = projectDeliverables.filter((deliverable) => deliverable.validationStatus === 'PENDING').length;
      const changes = projectDeliverables.filter(
        (deliverable) => deliverable.validationStatus === 'CHANGES_REQUESTED'
      ).length;
      const projectTickets = tickets.filter((ticket) => ticket.projectId === project.id);
      const blocked = projectTickets.filter((ticket) => ticket.status === 'BLOCKED').length;
      const manager = users.find((user) => user.id === project.managerId);
      const technicalConsultant = users.find(
        (user) =>
          user.role === 'CONSULTANT_TECHNIQUE' &&
          projectTickets.some((ticket) => ticket.assignedTo === user.id)
      );
      return { project, pending, changes, blocked, manager, technicalConsultant };
    });
  }, [deliverables, projects, tickets, users]);

  const submitFeedback = async (project: Project, manager?: User) => {
    if (!currentUser) return;
    const content = (feedbackDrafts[project.id] ?? '').trim();

    if (content.length < 10) {
      setErrorPopup(t('func.projects.feedback.errorShort'));
      return;
    }

    try {
      const created = await ProjectFeedbackAPI.create({
        projectId: project.id,
        authorId: currentUser.id,
        content,
      });

      setFeedbackHistory((prev) => ({
        ...prev,
        [project.id]: [created, ...(prev[project.id] ?? [])],
      }));
      setFeedbackDrafts((prev) => ({ ...prev, [project.id]: '' }));

      if (manager) {
        try {
          await NotificationsAPI.create({
            userId: manager.id,
            type: 'PROJECT_FEEDBACK',
            title: t('notifications.projectFeedback.title'),
            message: t('notifications.projectFeedback.message', {
              author: currentUser.name,
              project: project.name,
              content: content.slice(0, 200),
            }),
            targetPath: `{roleBasePath}/projects/${project.id}`,
            read: false,
          });
        } catch {
          // Silent fallback for notification.
        }
      }

      toast.success(t('func.projects.feedback.success'));
      setFeedbackTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('func.projects.feedback.saveFailed');
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('func.projects.title')}
        subtitle={t('func.projects.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: '/consultant-func/dashboard' },
          { label: t('func.projects.title') },
        ]}
      />

      <div className="p-6">
        {loadError && (
          <Card className="mb-6 border-destructive/50">
            <CardContent className="pt-4 text-sm text-destructive">{loadError}</CardContent>
          </Card>
        )}
        {loading ? (
          <div className="text-muted-foreground">{t('func.projects.loading')}</div>
        ) : rows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('func.projects.empty')}
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/70 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-4 min-w-[240px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.projects.columns.project')}</TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.projects.manager')}</TableHead>
                    <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.projects.techContact')}</TableHead>
                    <TableHead className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.projects.pending')}</TableHead>
                    <TableHead className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.projects.changesReq')}</TableHead>
                    <TableHead className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.projects.blockedTickets')}</TableHead>
                    <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ project, pending, changes, blocked, manager, technicalConsultant }) => (
                    <TableRow key={project.id} className="border-border/60 transition-colors hover:bg-muted/40">
                      <TableCell className="px-4 py-3.5 align-top">
                        <div className="font-semibold text-foreground whitespace-normal">{project.name}</div>
                        {project.description && (
                          <div className="mt-0.5 text-xs text-muted-foreground whitespace-normal line-clamp-2 max-w-xs">
                            {project.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-sm text-foreground">{manager?.name ?? 'Unknown'}</TableCell>
                      <TableCell className="px-4 py-3.5 text-sm">
                        {technicalConsultant ? (
                          <span className="text-foreground">{technicalConsultant.name}</span>
                        ) : (
                          <span className="text-muted-foreground italic">{t('func.projects.notAssigned')}</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3.5 text-center">{renderCount(pending, 'blue')}</TableCell>
                      <TableCell className="px-4 py-3.5 text-center">{renderCount(changes, 'red')}</TableCell>
                      <TableCell className="px-4 py-3.5 text-center">{renderCount(blocked, 'amber')}</TableCell>
                      <TableCell className="px-4 py-3.5 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => setFeedbackTarget({ project, manager })}
                        >
                          <MessageSquarePlus className="h-4 w-4" />
                          {t('func.projects.feedback.submit')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={feedbackTarget !== null} onOpenChange={(open) => !open && setFeedbackTarget(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('func.projects.feedback.title')}</DialogTitle>
            <DialogDescription>{feedbackTarget?.project.name}</DialogDescription>
          </DialogHeader>

          {feedbackTarget && (
            <div className="space-y-4">
              <Textarea
                value={feedbackDrafts[feedbackTarget.project.id] ?? ''}
                onChange={(event) =>
                  setFeedbackDrafts((prev) => ({ ...prev, [feedbackTarget.project.id]: event.target.value }))
                }
                rows={4}
                placeholder={t('func.projects.feedback.placeholder')}
              />

              {(feedbackHistory[feedbackTarget.project.id] ?? []).length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {t('func.projects.feedback.history')}
                  </p>
                  {(feedbackHistory[feedbackTarget.project.id] ?? []).map((feedback, index) => (
                    <div key={`${feedbackTarget.project.id}-feedback-${index}`} className="rounded bg-surface-2 p-2 text-xs">
                      <p className="font-medium text-foreground">
                        {users.find((u) => u.id === feedback.authorId)?.name ?? 'Unknown'}
                      </p>
                      <p className="mt-1 text-muted-foreground">{feedback.content}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(feedback.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setFeedbackTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() =>
                feedbackTarget && void submitFeedback(feedbackTarget.project, feedbackTarget.manager)
              }
            >
              {t('func.projects.feedback.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={errorPopup !== null} onOpenChange={(open) => !open && setErrorPopup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="inline-flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              {t('func.projects.feedback.errorTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>{errorPopup}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorPopup(null)}>
              {t('common.ok')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
