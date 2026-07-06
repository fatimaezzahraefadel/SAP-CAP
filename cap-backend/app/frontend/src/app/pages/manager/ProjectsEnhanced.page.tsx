import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Edit3, Plus, RefreshCcw, Trash2, FolderSearch, FileUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';
import { useAuth } from '../../context/AuthContext';import { ProjectsAPI } from '../../services/odata/projectsApi';
import {
  Priority,
  Project,
  ProjectDeliveryType,
  ProjectStatus,
} from '../../types/entities';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { parseWricefExcel, type ParsedWricefResult } from '../../utils/wricefExcel';
import { getWricefObjectRef } from '../../features/projects/model';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const STATUS_OPTIONS: ProjectStatus[] = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
const PRIORITY_OPTIONS: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const PROJECT_TYPE_OPTIONS: ProjectDeliveryType[] = ['TMA', 'BUILD'];

type DialogMode = 'create' | 'edit' | null;

interface ProjectFormState {
  name: string;
  projectType: ProjectDeliveryType;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  endDate: string;
  progress: number;
  wricef?: ParsedWricefResult;
}

const DEFAULT_FORM: ProjectFormState = {
  name: '',
  projectType: 'BUILD',
  description: '',
  status: 'PLANNED',
  priority: 'MEDIUM',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  progress: 0,
};

const statusStyles: Record<ProjectStatus, string> = {
  PLANNED: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-primary/12 text-primary',
  ON_HOLD: 'bg-accent text-accent-foreground',
  COMPLETED: 'bg-secondary text-secondary-foreground',
  CANCELLED: 'bg-destructive/12 text-destructive',
};

const priorityStyles: Record<Priority, string> = {
  LOW: 'bg-secondary text-secondary-foreground',
  MEDIUM: 'bg-accent text-accent-foreground',
  HIGH: 'bg-primary/12 text-primary',
  CRITICAL: 'bg-destructive/12 text-destructive',
};

export const ProjectsEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { t } = useTranslation();
  const roleBasePath = currentUser?.role === 'PROJECT_MANAGER' ? '/project-manager' : '/manager';

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'ALL'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'ALL'>('ALL');

  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);
  const [wricefFile, setWricefFile] = useState<File | null>(null);
  const [isParsingWricef, setIsParsingWricef] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadProjects = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await ProjectsAPI.getAll();
      setProjects(data);
    } catch (error) {
      toast.error(t('projects.toasts.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        project.name.toLowerCase().includes(query) ||
        project.description.toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter;
      const matchesPriority = priorityFilter === 'ALL' || project.priority === priorityFilter;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [projects, priorityFilter, searchQuery, statusFilter]);

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
    setPriorityFilter('ALL');
  };

  const openCreateDialog = () => {
    setSelectedProject(null);
    setForm(DEFAULT_FORM);
    setDialogMode('create');
  };

  const openEditDialog = (project: Project) => {
    setSelectedProject(project);
    setForm({
      name: project.name,
      projectType: project.projectType ?? 'BUILD',
      description: project.description,
      status: project.status,
      priority: project.priority,
      startDate: project.startDate,
      endDate: project.endDate,
      progress: project.progress ?? 0,
      wricef: project.wricef,
    });
    setWricefFile(null);
    setDialogMode('edit');
  };

  const closeDialog = () => {
    setDialogMode(null);
    setSelectedProject(null);
    setForm(DEFAULT_FORM);
    setWricefFile(null);
    setIsParsingWricef(false);
  };

  const handleWricefUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast.error(t('projects.toasts.invalidFile'));
      return;
    }

    setIsParsingWricef(true);
    try {
      const parsedWricef = await parseWricefExcel(file);
      setWricefFile(file);
      setForm((prev) => ({ ...prev, wricef: parsedWricef }));
      toast.success(t('projects.toasts.wricefImported', { count: parsedWricef.objects.length }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('projects.toasts.parseFailed'));
      setWricefFile(null);
    } finally {
      setIsParsingWricef(false);
    }
  };

  const removeWricef = () => {
    setWricefFile(null);
    setForm((prev) => ({ ...prev, wricef: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const saveProject = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim()) {
      toast.error(t('projects.toasts.nameRequired'));
      return;
    }

    if (!form.startDate || !form.endDate) {
      toast.error(t('projects.toasts.datesRequired'));
      return;
    }

    if (form.endDate < form.startDate) {
      toast.error(t('projects.toasts.invalidDates'));
      return;
    }

    const progress = Math.max(0, Math.min(100, Number(form.progress) || 0));

    const payload = {
      name: form.name.trim(),
      projectType: form.projectType,
      description: form.description.trim(),
      status: form.status,
      priority: form.priority,
      startDate: form.startDate,
      endDate: form.endDate,
      progress,
      managerId: selectedProject?.managerId ?? currentUser?.id ?? 'u2',
    };

    try {
      setSaving(true);
      if (dialogMode === 'create') {
        const created = await ProjectsAPI.create(payload);
        setProjects((prev) => [created, ...prev]);
        toast.success(t('projects.toasts.created'));
      } else if (dialogMode === 'edit' && selectedProject) {
        const updated = await ProjectsAPI.update(selectedProject.id, payload);
        setProjects((prev) =>
          prev.map((project) => (project.id === selectedProject.id ? updated : project))
        );
        toast.success(t('projects.toasts.updated'));
      }
      closeDialog();
    } catch (error) {
      toast.error(t('projects.toasts.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await ProjectsAPI.delete(projectId);
      setProjects((prev) => prev.filter((project) => project.id !== projectId));
      toast.success(t('projects.toasts.deleted'));
    } catch (error) {
      toast.error(t('projects.toasts.deleteFailed'));
    } finally {
      setProjectPendingDelete(null);
    }
  };

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeader
        title={t('projects.title')}
        subtitle={t('projects.subtitle')}
        breadcrumbs={[
          { label: t('projects.breadcrumbHome'), path: `${roleBasePath}/dashboard` },
          { label: t('projects.title') },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadProjects()}>
              <RefreshCcw className="h-4 w-4" />
              {t('projects.refresh')}
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t('projects.newProject')}
            </Button>
          </div>
        }
      />

      <div className="space-y-6 p-6 lg:p-8">
        <Card className="bg-card/92">
          <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-[2fr_1fr_1fr_auto]">
            <div className="space-y-1">
              <Label htmlFor="projects-search" className="sr-only">
                {t('projects.searchPlaceholder')}
              </Label>
              <Input
                id="projects-search"
                placeholder={t('projects.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="projects-status-filter" className="sr-only">
                {t('projects.allStatuses')}
              </Label>
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as ProjectStatus | 'ALL')}
              >
                <SelectTrigger id="projects-status-filter">
                  <SelectValue placeholder={t('projects.allStatuses')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('projects.allStatuses')}</SelectItem>
                  {STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t('entities.projectStatus.' + status, { defaultValue: status })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="projects-priority-filter" className="sr-only">
                {t('projects.allPriorities')}
              </Label>
              <Select
                value={priorityFilter}
                onValueChange={(value) => setPriorityFilter(value as Priority | 'ALL')}
              >
                <SelectTrigger id="projects-priority-filter">
                  <SelectValue placeholder={t('projects.allPriorities')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('projects.allPriorities')}</SelectItem>
                  {PRIORITY_OPTIONS.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {t('entities.priority.' + priority, { defaultValue: priority })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button variant="secondary" onClick={resetFilters}>
              {t('projects.reset')}
            </Button>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card/92">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-muted/65">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.project')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.type')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.status')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.priority')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.timeline')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.progress')}
                    </th>
                    <th className="px-4 py-3 text-left text-xs uppercase tracking-[0.08em] text-muted-foreground">
                      {t('projects.table.actions')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                        {t('projects.loading')}
                      </td>
                    </tr>
                  ) : filteredProjects.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                        <div className="mx-auto flex max-w-sm flex-col items-center gap-2 text-sm text-muted-foreground">
                          <FolderSearch className="h-8 w-8 text-muted-foreground" />
                          <p>{t('projects.noProjects')}</p>
                          <Button variant="secondary" size="sm" onClick={openCreateDialog}>
                            <Plus className="h-4 w-4" />
                            {t('projects.createProject')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((project) => (
                      <tr key={project.id} className="border-t border-border/60 transition hover:bg-accent/35">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => navigate(`${roleBasePath}/projects/${project.id}`)}
                            className="text-left font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {project.name}
                          </button>
                          <p className="mt-1 line-clamp-2 max-w-[360px] text-xs text-muted-foreground">
                            {project.description}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline">
                            {t('entities.projectDeliveryType.' + (project.projectType ?? 'BUILD'))}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusStyles[project.status]}>
                            {t('entities.projectStatus.' + project.status, { defaultValue: project.status })}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={priorityStyles[project.priority]}>
                            {t('entities.priority.' + project.priority, { defaultValue: project.priority })}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          <div>{new Date(project.startDate).toLocaleDateString()}</div>
                          <div>{new Date(project.endDate).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-44">
                            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                              <span>{project.progress ?? 0}%</span>
                            </div>
                            <Progress value={project.progress ?? 0} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => openEditDialog(project)}
                              aria-label={t('projects.table.edit', { name: project.name })}
                            >
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => setProjectPendingDelete(project)}
                              aria-label={t('projects.table.delete', { name: project.name })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{dialogMode === 'create' ? t('projects.dialog.createTitle') : t('projects.dialog.editTitle')}</DialogTitle>
            <DialogDescription>
              {t('projects.dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={saveProject}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="project-name">{t('projects.dialog.nameLabel')}</Label>
                <Input
                  id="project-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t('projects.dialog.namePlaceholder')}
                  required
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="project-description">{t('projects.dialog.descLabel')}</Label>
                <Textarea
                  id="project-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, description: event.target.value }))
                  }
                  placeholder={t('projects.dialog.descPlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-type">{t('projects.dialog.typeLabel')}</Label>
                <Select
                  value={form.projectType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, projectType: value as ProjectDeliveryType }))
                  }
                >
                  <SelectTrigger id="project-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPE_OPTIONS.map((projectType) => (
                      <SelectItem key={projectType} value={projectType}>
                        {t('entities.projectDeliveryType.' + projectType)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-status">{t('projects.dialog.statusLabel')}</Label>
                <Select
                  value={form.status}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, status: value as ProjectStatus }))
                  }
                >
                  <SelectTrigger id="project-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {t('entities.projectStatus.' + status, { defaultValue: status })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-priority">{t('projects.dialog.priorityLabel')}</Label>
                <Select
                  value={form.priority}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, priority: value as Priority }))
                  }
                >
                  <SelectTrigger id="project-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {t('entities.priority.' + priority, { defaultValue: priority })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-start-date">{t('projects.dialog.startDateLabel')}</Label>
                <Input
                  id="project-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-end-date">{t('projects.dialog.endDateLabel')}</Label>
                <Input
                  id="project-end-date"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="project-progress">{t('projects.dialog.progressLabel')}</Label>
                <Input
                  id="project-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, progress: Number(event.target.value || 0) }))
                  }
                />
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">{t('projects.dialog.wricefImport')}</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('projects.dialog.wricefImportDesc')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isParsingWricef}
                >
                  <FileUp className="h-4 w-4 mr-2" />
                  {isParsingWricef ? t('projects.dialog.parsing') : t('projects.dialog.uploadExcel')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleWricefUpload}
                />
              </div>

              {form.wricef && (
                <div className="rounded border border-border bg-background p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {t('projects.dialog.objects', { count: form.wricef.objects.length })}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {t('projects.dialog.tickets', { count: form.wricef.tickets.length })}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {wricefFile?.name || form.wricef.sourceFileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('wricefValidation.imported')}: {new Date(form.wricef.importedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={removeWricef}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {form.wricef.objects.slice(0, 5).map((obj) => {
                      const objectRef = getWricefObjectRef(obj);
                      return (
                        <div key={objectRef} className="text-xs p-1.5 rounded bg-muted/50">
                          <span className="font-medium">{objectRef}</span> - {obj.title} ({t('projects.dialog.ticketCount', { count: form.wricef?.tickets.filter((ticket) => ticket.wricefId === objectRef).length || 0 })})
                        </div>
                      );
                    })}
                    {form.wricef.objects.length > 5 && (
                      <p className="text-xs text-muted-foreground italic">
                        {t('projects.dialog.moreObjects', { count: form.wricef.objects.length - 5 })}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {!form.wricef && !isParsingWricef && (
                <p className="text-xs text-muted-foreground italic">
                  {t('projects.dialog.noWricef')}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('projects.dialog.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {saving
                  ? dialogMode === 'create'
                    ? t('projects.dialog.creating')
                    : t('projects.dialog.saving')
                  : dialogMode === 'create'
                    ? t('projects.dialog.createButton')
                    : t('projects.dialog.updateButton')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={projectPendingDelete !== null}
        onOpenChange={(open) => !open && setProjectPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('projects.deleteDialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {projectPendingDelete
                ? t('projects.deleteDialog.description', { name: projectPendingDelete.name })
                : t('projects.deleteDialog.fallbackDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('projects.dialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => projectPendingDelete && void deleteProject(projectPendingDelete.id)}
            >
              {t('projects.deleteDialog.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
