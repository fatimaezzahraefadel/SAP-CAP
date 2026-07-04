import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

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
} from '../../components/ui/table';import { AllocationsAPI } from '../../services/odata/allocationsApi';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { useAuth } from '../../context/AuthContext';
import {
  Allocation,
  Project,
  User,
} from '../../types/entities';
import { todayLocalDateKey } from '../../utils/date';

interface NewAllocationForm {
  userId: string;
  projectId: string;
  allocationPercent: number;
  startDate: string;
  endDate: string;
}

const EMPTY_FORM: NewAllocationForm = {
  userId: '',
  projectId: '',
  allocationPercent: 50,
  startDate: todayLocalDateKey(),
  endDate: todayLocalDateKey(),
};

const rangesOverlap = (startA: string, endA: string, startB: string, endB: string) =>
  !(endA < startB || endB < startA);

const getAllocationNotificationTarget = (role?: User['role']): string => {
  switch (role) {
    case 'MANAGER':
    case 'PROJECT_MANAGER':
      return '{roleBasePath}/allocations';
    case 'CONSULTANT_TECHNIQUE':
    case 'CONSULTANT_FONCTIONNEL':
      return '{roleBasePath}/projects';
    default:
      return '{roleBasePath}/dashboard';
  }
};

export const ResourceAllocation: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<NewAllocationForm>(EMPTY_FORM);
  const [projectFilter, setProjectFilter] = useState<string>('ALL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allocationPendingDelete, setAllocationPendingDelete] = useState<Allocation | null>(null);
  const [allocationDrafts, setAllocationDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [userData, projectData, allocationData] = await Promise.all([
        UsersAPI.getAll(),
        ProjectsAPI.getAll(),
        AllocationsAPI.getAll(),
      ]);
      setUsers(userData.filter((user) => user.role !== 'ADMIN'));
      setProjects(projectData);
      setAllocations(allocationData);
      setAllocationDrafts({});
    } finally {
      setLoading(false);
    }
  };

  const filteredAllocations = useMemo(() => {
    if (projectFilter === 'ALL') return allocations;
    return allocations.filter((allocation) => allocation.projectId === projectFilter);
  }, [allocations, projectFilter]);

  const userTotalAllocation = useMemo(() => {
    const totals = new Map<string, number>();
    allocations.forEach((allocation) => {
      totals.set(
        allocation.userId,
        (totals.get(allocation.userId) ?? 0) + allocation.allocationPercent
      );
    });
    return totals;
  }, [allocations]);

  const createAllocation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.userId || !form.projectId) {
      toast.error(t('resourceAllocation.toasts.requiredFields'));
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error(t('resourceAllocation.toasts.invalidDateRange'));
      return;
    }
    if (form.allocationPercent < 0 || form.allocationPercent > 100) {
      toast.error(t('resourceAllocation.toasts.invalidPercent'));
      return;
    }

    const duplicatePeriod = allocations.some(
      (allocation) =>
        allocation.userId === form.userId &&
        allocation.projectId === form.projectId &&
        rangesOverlap(form.startDate, form.endDate, allocation.startDate, allocation.endDate)
    );
    if (duplicatePeriod) {
      toast.error(t('resourceAllocation.toasts.overlappingAllocation'));
      return;
    }

    const currentTotal = userTotalAllocation.get(form.userId) ?? 0;
    const nextTotal = currentTotal + form.allocationPercent;
    if (nextTotal > 100) {
      toast.error(t('resourceAllocation.toasts.exceedsCapacity', { total: nextTotal }));
      return;
    }

    try {
      setIsSubmitting(true);
      const created = await AllocationsAPI.create({ ...form });
      setAllocations((prev) => [created, ...prev]);

      // The allocation is already persisted; a failed notification must not
      // surface as an allocation failure, so it gets its own try/catch.
      try {
        const projectName = projects.find((project) => project.id === form.projectId)?.name ?? t('resourceAllocation.generic.project');
        const allocatedUser = users.find((user) => user.id === form.userId);
        await NotificationsAPI.create({
          userId: form.userId,
          type: 'ALLOCATION_UPDATED',
          title: t('resourceAllocation.notification.title'),
          message: t('resourceAllocation.notification.message', {
            percent: form.allocationPercent,
            project: projectName,
          }),
          targetPath: getAllocationNotificationTarget(allocatedUser?.role),
          read: false,
        });
      } catch {
        // Allocation succeeded — swallow notification errors silently.
      }

      setForm(EMPTY_FORM);
      toast.success(t('resourceAllocation.toasts.created'));
    } catch {
      toast.error(t('resourceAllocation.toasts.createFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updatePercent = async (allocation: Allocation, nextPercent: number) => {
    if (nextPercent < 0 || nextPercent > 100) {
      toast.error(t('resourceAllocation.toasts.invalidPercent'));
      return;
    }

    const currentTotal = userTotalAllocation.get(allocation.userId) ?? 0;
    const totalWithoutCurrent = currentTotal - allocation.allocationPercent;
    const nextTotal = totalWithoutCurrent + nextPercent;
    if (nextTotal > 100) {
      toast.error(t('resourceAllocation.toasts.exceedsCapacity', { total: nextTotal }));
      return;
    }

    try {
      const updated = await AllocationsAPI.update(allocation.id, {
        allocationPercent: nextPercent,
      });
      setAllocations((prev) => prev.map((entry) => (entry.id === allocation.id ? updated : entry)));
    } catch {
      toast.error(t('resourceAllocation.toasts.updateFailed'));
    }
  };

  const removeAllocation = async (id: string) => {
    try {
      await AllocationsAPI.delete(id);
      setAllocations((prev) => prev.filter((entry) => entry.id !== id));
      toast.success(t('resourceAllocation.toasts.deleted'));
    } catch {
      toast.error(t('resourceAllocation.toasts.deleteFailed'));
    } finally {
      setAllocationPendingDelete(null);
    }
  };

  const resolveUser = (userId: string) => users.find((user) => user.id === userId);
  const resolveProject = (projectId: string) => projects.find((project) => project.id === projectId);
  const isProjectManager = currentUser?.role === 'PROJECT_MANAGER';
  const homePath = isProjectManager ? '/project-manager/dashboard' : '/manager/dashboard';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('resourceAllocation.title')}
        subtitle={t('resourceAllocation.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: homePath },
          { label: t('resourceAllocation.title') },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-3 lg:p-8">
        <Card className="h-fit bg-card/92">
          <CardContent className="pt-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">{t('resourceAllocation.form.title')}</h3>
            <form onSubmit={createAllocation} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="allocation-user">{t('resourceAllocation.form.consultant')}</Label>
                <Select
                  value={form.userId}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, userId: val }))}
                >
                  <SelectTrigger id="allocation-user">
                    <SelectValue placeholder={t('resourceAllocation.form.selectUser')} />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name} ({user.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="allocation-project">{t('resourceAllocation.form.project')}</Label>
                <Select
                  value={form.projectId}
                  onValueChange={(val) => setForm((prev) => ({ ...prev, projectId: val }))}
                >
                  <SelectTrigger id="allocation-project">
                    <SelectValue placeholder={t('resourceAllocation.form.selectProject')} />
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

              <div className="space-y-1.5">
                <Label htmlFor="allocation-percent">{t('resourceAllocation.form.allocationPercent')}</Label>
                <Input
                  id="allocation-percent"
                  type="number"
                  min={0}
                  max={100}
                  value={form.allocationPercent}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, allocationPercent: Number(event.target.value || 0) }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="allocation-start">{t('resourceAllocation.form.start')}</Label>
                  <Input
                    id="allocation-start"
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="allocation-end">{t('resourceAllocation.form.end')}</Label>
                  <Input
                    id="allocation-end"
                    type="date"
                    value={form.endDate}
                    onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="w-full">
                <Plus className="h-4 w-4" />
                {isSubmitting ? t('resourceAllocation.form.saving') : t('resourceAllocation.form.add')}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card/92 xl:col-span-2">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-3 border-b border-border p-4">
              <h3 className="text-lg font-semibold text-foreground">{t('resourceAllocation.matrix.title')}</h3>
              <div className="space-y-1">
                <Label htmlFor="allocation-project-filter" className="sr-only">
                  {t('resourceAllocation.matrix.filterByProject')}
                </Label>
                <Select
                  value={projectFilter}
                  onValueChange={(val) => setProjectFilter(val)}
                >
                  <SelectTrigger id="allocation-project-filter" className="w-[180px]">
                    <SelectValue placeholder={t('resourceAllocation.matrix.allProjects')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{t('resourceAllocation.matrix.allProjects')}</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader className="bg-muted/65">
                <TableRow>
                  <TableHead className="px-4">{t('resourceAllocation.matrix.consultant')}</TableHead>
                  <TableHead className="px-4">{t('resourceAllocation.matrix.project')}</TableHead>
                  <TableHead className="px-4">{t('resourceAllocation.matrix.allocation')}</TableHead>
                  <TableHead className="px-4">{t('resourceAllocation.matrix.totalPerUser')}</TableHead>
                  <TableHead className="px-4">{t('resourceAllocation.matrix.period')}</TableHead>
                  <TableHead className="px-4 text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t('resourceAllocation.matrix.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredAllocations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t('resourceAllocation.matrix.empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAllocations.map((allocation) => {
                    const user = resolveUser(allocation.userId);
                    const project = resolveProject(allocation.projectId);
                    const total = userTotalAllocation.get(allocation.userId) ?? 0;

                    return (
                      <TableRow key={allocation.id} className="hover:bg-accent/40">
                        <TableCell className="px-4 py-3 font-medium">{user?.name ?? '-'}</TableCell>
                        <TableCell className="px-4 py-3">{project?.name ?? '-'}</TableCell>
                        <TableCell className="px-4 py-3">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={
                              allocationDrafts[allocation.id] ??
                              String(allocation.allocationPercent)
                            }
                            className="h-8 w-20"
                            onChange={(event) =>
                              setAllocationDrafts((prev) => ({
                                ...prev,
                                [allocation.id]: event.target.value,
                              }))
                            }
                            onBlur={() => {
                              const raw = allocationDrafts[allocation.id];
                              const next = Number(
                                raw !== undefined ? raw : allocation.allocationPercent
                              );
                              setAllocationDrafts((prev) => {
                                const copy = { ...prev };
                                delete copy[allocation.id];
                                return copy;
                              });
                              if (Number.isFinite(next)) {
                                void updatePercent(allocation, next);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                (event.target as HTMLInputElement).blur();
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell
                          className={`px-4 py-3 font-medium ${
                            total > 100 ? 'text-destructive' : 'text-foreground'
                          }`}
                        >
                          {total}%
                        </TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">
                          {t('resourceAllocation.matrix.periodValue', {
                            start: allocation.startDate,
                            end: allocation.endDate,
                          })}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setAllocationPendingDelete(allocation)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span className="sr-only">{t('resourceAllocation.delete.remove')}</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={allocationPendingDelete !== null}
        onOpenChange={(open) => !open && setAllocationPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('resourceAllocation.delete.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {allocationPendingDelete
                ? t('resourceAllocation.delete.description')
                : t('resourceAllocation.delete.fallbackDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => allocationPendingDelete && void removeAllocation(allocationPendingDelete.id)}
            >
              {t('resourceAllocation.delete.remove')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
