import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FileUp,
  Layers,
  PackagePlus,
  Plus,
  Send,
  Trash2,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Separator } from '../../components/ui/separator';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { WricefsAPI } from '../../services/odata/wricefsApi';
import { WricefObjectsAPI } from '../../services/odata/wricefObjectsApi';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { AttachmentsAPI } from '../../services/odata/attachmentsApi';
import {
  type Project,
  type Ticket,
  type Wricef,
  type WricefObject,
  type WricefType,
  type WricefValidationStatus,
  type SAPModule,
  type TicketComplexity,
} from '../../types/entities';

// ── helpers ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<WricefValidationStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  PENDING_VALIDATION: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  VALIDATED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const ALL_WRICEF_TYPES: WricefType[] = ['W', 'R', 'I', 'C', 'E', 'F'];
const ALL_SAP_MODULES: SAPModule[] = [
  'FI',
  'CO',
  'MM',
  'SD',
  'PP',
  'PM',
  'QM',
  'HR',
  'PS',
  'WM',
  'BASIS',
  'ABAP',
  'FIORI',
  'BW',
  'OTHER',
];
const ALL_COMPLEXITIES: TicketComplexity[] = ['SIMPLE', 'MOYEN', 'COMPLEXE', 'TRES_COMPLEXE'];
const WRICEF_UPLOAD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt';

// ── New-object form state ──────────────────────────────────────────────────

interface NewObjectForm {
  type: WricefType;
  title: string;
  description: string;
  complexity: TicketComplexity;
  module: SAPModule;
}

const EMPTY_OBJECT: NewObjectForm = {
  type: 'E',
  title: '',
  description: '',
  complexity: 'SIMPLE',
  module: 'FI',
};

const STATUS_ORDER: Record<WricefValidationStatus, number> = {
  DRAFT: 0,
  PENDING_VALIDATION: 1,
  VALIDATED: 2,
  REJECTED: 3,
};

// ════════════════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════════════════

export const WricefManagement: React.FC = () => {
  const { t } = useTranslation();

  // ── data state ──
  const [wricefs, setWricefs] = useState<Wricef[]>([]);
  const [objectsByWricef, setObjectsByWricef] = useState<Record<string, WricefObject[]>>({});
  const [ticketsByWricef, setTicketsByWricef] = useState<Record<string, Ticket[]>>({});
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // ── creation state ──
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProjectId, setNewProjectId] = useState('');
  const [newSourceFile, setNewSourceFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // ── add-object state ──
  const [addObjectTarget, setAddObjectTarget] = useState<string | null>(null);
  const [objectForm, setObjectForm] = useState<NewObjectForm>({ ...EMPTY_OBJECT });
  const [addingObject, setAddingObject] = useState(false);

  // ── submit state ──
  const [submitting, setSubmitting] = useState<string | null>(null);

  // ── expanded WRICEFs ──
  const [expandedWricefs, setExpandedWricefs] = useState<Set<string>>(new Set());

  // ── data loading ──
  const loadData = useCallback(async () => {
    try {
      const [w, p, allObjects, allTickets] = await Promise.all([
        WricefsAPI.getAll(),
        ProjectsAPI.getAll(),
        WricefObjectsAPI.getAll(),
        TicketsAPI.getAll(),
      ]);
      setWricefs(w);
      setProjects(p);

      // Group objects by wricefId
      const objMap: Record<string, WricefObject[]> = {};
      for (const obj of allObjects) {
        (objMap[obj.wricefId] ??= []).push(obj);
      }
      setObjectsByWricef(objMap);

      // Group tickets by wricefId (Ticket.wricefId may reference either wricef or object id)
      const tickMap: Record<string, Ticket[]> = {};
      for (const t of allTickets) {
        if (t.wricefId) {
          (tickMap[t.wricefId] ??= []).push(t);
        }
      }
      setTicketsByWricef(tickMap);
    } catch {
      toast.error(t('dashboard.wricef.toasts.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const projectName = useCallback(
    (id: string) => projects.find((p) => p.id === id)?.name ?? id,
    [projects]
  );

  // ── create WRICEF ──
  const handleCreateWricef = async () => {
    if (!newProjectId) {
      toast.error(t('dashboard.wricef.toasts.validation.selectProject'));
      return;
    }
    if (!newSourceFile) {
      toast.error(t('dashboard.wricef.toasts.validation.enterSourceFile'));
      return;
    }
    setCreating(true);
    try {
      const created = await WricefsAPI.create({
        projectId: newProjectId,
        sourceFileName: newSourceFile.name,
        importedAt: new Date().toISOString(),
        status: 'DRAFT',
        autoCreated: false,
      });
      try {
        await AttachmentsAPI.upload('WRICEF', created.id, newSourceFile);
      } catch (uploadError) {
        await WricefsAPI.delete(created.id);
        throw uploadError;
      }
      toast.success(t('dashboard.wricef.toasts.createSuccess'));
      setCreateDialogOpen(false);
      setNewProjectId('');
      setNewSourceFile(null);
      await loadData();
    } catch {
      toast.error(t('dashboard.wricef.toasts.createError'));
    } finally {
      setCreating(false);
    }
  };

  // ── add object to wricef ──
  const handleAddObject = async (wricefId: string) => {
    if (!objectForm.title.trim()) {
      toast.error(t('dashboard.wricef.toasts.validation.enterObjectTitle'));
      return;
    }
    const wricef = wricefs.find((w) => w.id === wricefId);
    if (!wricef) return;

    setAddingObject(true);
    try {
      await WricefObjectsAPI.create({
        wricefId,
        projectId: wricef.projectId,
        type: objectForm.type,
        title: objectForm.title.trim(),
        description: objectForm.description.trim(),
        complexity: objectForm.complexity,
        module: objectForm.module,
        status: 'DRAFT',
      });
      toast.success(t('dashboard.wricef.toasts.objectAdded'));
      setAddObjectTarget(null);
      setObjectForm({ ...EMPTY_OBJECT });
      await loadData();
    } catch {
      toast.error(t('dashboard.wricef.toasts.objectAddError'));
    } finally {
      setAddingObject(false);
    }
  };

  // ── delete object ──
  const handleDeleteObject = async (objId: string) => {
    try {
      await WricefObjectsAPI.delete(objId);
      toast.success(t('dashboard.wricef.toasts.objectDeleted'));
      await loadData();
    } catch {
      toast.error(t('dashboard.wricef.toasts.objectDeleteError'));
    }
  };

  // ── submit WRICEF for validation ──
  const handleSubmit = async (wricef: Wricef) => {
    const objects = objectsByWricef[wricef.id] ?? [];
    if (objects.length === 0) {
      toast.error(t('dashboard.wricef.toasts.validation.minOneObject'));
      return;
    }
    setSubmitting(wricef.id);
    try {
      await WricefsAPI.submitWricef(wricef.id);
      toast.success(t('dashboard.wricef.toasts.submitSuccess'), {
        description: t('dashboard.wricef.toasts.submitDescription', { name: wricef.sourceFileName }),
      });
      await loadData();
    } catch (error) {
      // Surface the real backend reason (e.g. insufficient role, wrong status)
      // instead of a generic message so failures are actually diagnosable.
      const reason = (error as { message?: string })?.message;
      toast.error(t('dashboard.wricef.toasts.submitError'), {
        ...(reason ? { description: reason } : {}),
      });
    } finally {
      setSubmitting(null);
    }
  };

  // ── delete WRICEF ──
  const handleDeleteWricef = async (wricef: Wricef) => {
    try {
      await WricefsAPI.delete(wricef.id);
      toast.success(t('dashboard.wricef.toasts.deleteSuccess'));
      await loadData();
    } catch {
      toast.error(t('dashboard.wricef.toasts.deleteError'));
    }
  };

  // ── toggle expand ──
  const toggleExpand = (id: string) => {
    setExpandedWricefs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── sorting: draft first, then pending, then validated, then rejected ──
  const sortedWricefs = useMemo(
    () => [...wricefs].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [wricefs]
  );

  // ── counts ──
  const drafts = wricefs.filter((w) => w.status === 'DRAFT').length;
  const pending = wricefs.filter((w) => w.status === 'PENDING_VALIDATION').length;
  const validated = wricefs.filter((w) => w.status === 'VALIDATED').length;
  const rejected = wricefs.filter((w) => w.status === 'REJECTED').length;

  // ── loading ──
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <PageHeader
        title={t('dashboard.wricef.title')}
        subtitle={t('dashboard.wricef.subtitle')}
        breadcrumbs={[
          { label: t('documentation.home'), path: '/manager/dashboard' },
          { label: t('dashboard.wricef.title') },
        ]}
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('dashboard.wricef.actions.newWricef')}
          </Button>
        }
      />

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 sm:p-6 lg:p-8">
        {[
          {
            label: t('dashboard.wricef.stats.draft'),
            count: drafts,
            icon: FileText,
            color: 'text-slate-500',
          },
          {
            label: t('dashboard.wricef.stats.pending'),
            count: pending,
            icon: Clock,
            color: 'text-amber-500',
          },
          {
            label: t('dashboard.wricef.stats.validated'),
            count: validated,
            icon: CheckCircle2,
            color: 'text-emerald-500',
          },
          {
            label: t('dashboard.wricef.stats.rejected'),
            count: rejected,
            icon: XCircle,
            color: 'text-red-500',
          },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="flex items-center gap-3 p-4">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{kpi.count}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── WRICEF list ── */}
      <div className="space-y-3 px-4 pb-8 sm:px-6 lg:px-8">
        {sortedWricefs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Layers className="mb-3 h-10 w-10 text-primary/40" />
              <p className="text-sm font-medium">{t('dashboard.wricef.list.empty')}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('dashboard.wricef.list.emptyDescription')}
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedWricefs.map((w) => {
            const isDraft = w.status === 'DRAFT';
            const isExpanded = expandedWricefs.has(w.id);
            const objects = objectsByWricef[w.id] ?? [];
            const wricefTickets = ticketsByWricef[w.id] ?? [];

            return (
              <Card key={w.id} className="border-border/80">
                {/* ── WRICEF header row ── */}
                <CardHeader className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => toggleExpand(w.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <CardTitle className="text-sm font-semibold">
                          {w.sourceFileName || t('dashboard.wricef.list.untitled')}
                        </CardTitle>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge className={`text-[10px] ${STATUS_COLORS[w.status]}`}>
                            {t(`entities.wricefValidationStatus.${w.status}`)}
                          </Badge>
                          <span>{t('dashboard.wricef.list.project', { name: projectName(w.projectId) })}</span>
                          <span>{t('dashboard.wricef.list.objects', { count: objects.length })}</span>
                          {wricefTickets.length > 0 && (
                            <span>{t('dashboard.wricef.list.tickets', { count: wricefTickets.length })}</span>
                          )}
                          {w.importedAt && (
                            <span>{t('dashboard.wricef.list.created', { date: new Date(w.importedAt).toLocaleDateString() })}</span>
                          )}
                        </div>
                        {w.status === 'REJECTED' && w.rejectionReason && (
                          <div className="mt-1.5 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                            <span>{t('dashboard.wricef.list.rejected', { reason: w.rejectionReason })}</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* ── Actions ── */}
                    <div className="flex shrink-0 items-center gap-1.5">
                      {isDraft && (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            disabled={submitting === w.id || objects.length === 0}
                            onClick={() => void handleSubmit(w)}
                          >
                            {submitting === w.id ? (
                              t('dashboard.wricef.buttons.submitting')
                            ) : (
                              <>
                                <Send className="mr-1 h-3.5 w-3.5" /> {t('dashboard.wricef.buttons.submit')}
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => void handleDeleteWricef(w)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {/* ── Expanded content: objects ── */}
                {isExpanded && (
                  <CardContent className="border-t px-4 pb-4 pt-3">
                    {objects.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        {t('wricefValidation.noObjects')}{' '}
                        {isDraft && t('dashboard.wricef.list.emptyDescription')}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {objects.map((obj) => {
                          // Find tickets linked to this object
                          const objTickets = ticketsByWricef[obj.id] ?? [];
                          return (
                            <div
                              key={obj.id}
                              className="rounded-lg border border-border/60 bg-muted/30 p-3"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="shrink-0 text-[10px]">
                                      {t(`entities.wricefType.${obj.type}`)}
                                    </Badge>
                                    <span className="text-sm font-medium">{obj.title}</span>
                                    <Badge className={`text-[10px] ${STATUS_COLORS[obj.status]}`}>
                                      {t(`entities.wricefValidationStatus.${obj.status}`)}
                                    </Badge>
                                  </div>
                                  {obj.description && (
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                      {obj.description}
                                    </p>
                                  )}
                                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                                    <span>{t('wricefValidation.moduleLabel')} {obj.module ? t(`entities.sapModule.${obj.module}`) : '—'}</span>
                                    <span>{t('wricefValidation.complexityLabel')} {t(`entities.ticketComplexity.${obj.complexity}`)}</span>
                                    {objTickets.length > 0 && (
                                      <span>{t('dashboard.wricef.list.tickets', { count: objTickets.length })}</span>
                                    )}
                                  </div>
                                  {obj.status === 'REJECTED' && obj.rejectionReason && (
                                    <div className="mt-1 flex items-start gap-1 text-xs text-red-600 dark:text-red-400">
                                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                                      <span>{obj.rejectionReason}</span>
                                    </div>
                                  )}
                                </div>
                                {isDraft && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="shrink-0 text-red-500 hover:text-red-600"
                                    onClick={() => void handleDeleteObject(obj.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>

                              {/* Tickets under this object */}
                              {objTickets.length > 0 && (
                                <div className="mt-2 space-y-1 border-t pt-2">
                                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                    {t('wricefValidation.linkedTickets')}
                                  </p>
                                  {objTickets.map((t) => (
                                    <div
                                      key={t.id}
                                      className="flex items-center gap-2 rounded bg-background/80 px-2 py-1 text-xs"
                                    >
                                      <Badge variant="outline" className="text-[9px]">
                                        {t.ticketCode}
                                      </Badge>
                                      <span className="truncate">{t.title}</span>
                                      <Badge variant="secondary" className="ml-auto text-[9px]">
                                        {t.status}
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Add Object button / inline form */}
                    {isDraft && (
                      <>
                        <Separator className="my-3" />
                        {addObjectTarget === w.id ? (
                          <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
                            <p className="text-xs font-semibold text-primary">
                              {t('dashboard.wricef.form.addObjectTitle', { name: w.sourceFileName })}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">{t('dashboard.wricef.form.type')}</Label>
                                <Select
                                  value={objectForm.type}
                                  onValueChange={(v) =>
                                    setObjectForm((p) => ({ ...p, type: v as WricefType }))
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_WRICEF_TYPES.map((t_code) => (
                                      <SelectItem key={t_code} value={t_code}>
                                        {t(`entities.wricefType.${t_code}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">{t('dashboard.wricef.form.title')}</Label>
                                <Input
                                  className="h-8 text-xs"
                                  placeholder={t('dashboard.wricef.form.title')}
                                  value={objectForm.title}
                                  onChange={(e) =>
                                    setObjectForm((p) => ({ ...p, title: e.target.value }))
                                  }
                                />
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">{t('dashboard.wricef.form.module')}</Label>
                                <Select
                                  value={objectForm.module}
                                  onValueChange={(v) =>
                                    setObjectForm((p) => ({ ...p, module: v as SAPModule }))
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_SAP_MODULES.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {t(`entities.sapModule.${m}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-xs">{t('dashboard.wricef.form.complexity')}</Label>
                                <Select
                                  value={objectForm.complexity}
                                  onValueChange={(v) =>
                                    setObjectForm((p) => ({
                                      ...p,
                                      complexity: v as TicketComplexity,
                                    }))
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ALL_COMPLEXITIES.map((c) => (
                                      <SelectItem key={c} value={c}>
                                        {t(`entities.ticketComplexity.${c}`)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1 sm:col-span-2">
                                <Label className="text-xs">{t('dashboard.wricef.form.description')}</Label>
                                <Textarea
                                  className="text-xs"
                                  rows={2}
                                  placeholder={t('dashboard.wricef.form.descriptionPlaceholder')}
                                  value={objectForm.description}
                                  onChange={(e) =>
                                    setObjectForm((p) => ({
                                      ...p,
                                      description: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setAddObjectTarget(null);
                                  setObjectForm({ ...EMPTY_OBJECT });
                                }}
                              >
                                {t('dashboard.wricef.buttons.cancel')}
                              </Button>
                              <Button
                                size="sm"
                                disabled={addingObject}
                                onClick={() => void handleAddObject(w.id)}
                              >
                                {addingObject ? t('dashboard.wricef.buttons.adding') : t('dashboard.wricef.buttons.addObject')}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              setObjectForm({ ...EMPTY_OBJECT });
                              setAddObjectTarget(w.id);
                            }}
                          >
                            <PackagePlus className="mr-1.5 h-3.5 w-3.5" />
                            {t('dashboard.wricef.buttons.addObject')}
                          </Button>
                        )}
                      </>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          Create WRICEF Dialog
         ════════════════════════════════════════════════════════════════════ */}
      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open && !creating) {
            setNewProjectId('');
            setNewSourceFile(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dashboard.wricef.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('dashboard.wricef.dialog.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="wricef-project">{t('dashboard.wricef.dialog.project')}</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger id="wricef-project">
                  <SelectValue placeholder={t('dashboard.wricef.dialog.projectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wricef-source-file">{t('dashboard.wricef.dialog.sourceFile')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="wricef-source-file"
                  type="file"
                  accept={WRICEF_UPLOAD_ACCEPT}
                  className="hidden"
                  onChange={(e) => setNewSourceFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => document.getElementById('wricef-source-file')?.click()}
                >
                  <FileUp className="mr-1.5 h-4 w-4" />
                  {t('dashboard.wricef.dialog.chooseFile')}
                </Button>
                <span className="min-w-0 truncate text-sm text-muted-foreground">
                  {newSourceFile?.name ?? t('dashboard.wricef.dialog.noFileSelected')}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              disabled={creating}
            >
              {t('dashboard.wricef.buttons.cancel')}
            </Button>
            <Button onClick={() => void handleCreateWricef()} disabled={creating}>
              {creating ? t('dashboard.wricef.dialog.creating') : t('dashboard.wricef.dialog.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
