import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { CheckCircle, Clock, FileText, XCircle, Search, Filter, Plus, FileUp, ExternalLink, CalendarDays, Paperclip, X, Pencil, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/badge';
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useAuth } from '../../context/AuthContext';import { DeliverablesAPI } from '../../services/odata/deliverablesApi';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { odataFetch } from '../../services/odata/core';
import { Deliverable, Project, UserRole, ValidationStatus } from '../../types/entities';

interface UploadForm {
  projectId: string;
  type: string;
  name: string;
}

const EMPTY_UPLOAD_FORM: UploadForm = {
  projectId: '',
  type: 'Functional Specification',
  name: '',
};

export const Deliverables: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const canReview = useMemo(() => {
    const role = currentUser?.role as UserRole | undefined;
    return role === 'ADMIN' || role === 'MANAGER' || role === 'PROJECT_MANAGER';
  }, [currentUser?.role]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ValidationStatus | 'ALL'>('ALL');
  
  // Dialogs & Forms
  const [isDepositOpen, setIsDepositOpen] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<Deliverable | null>(null);
  const [comment, setComment] = useState('');
  const [uploadForm, setUploadForm] = useState<UploadForm>(EMPTY_UPLOAD_FORM);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);

  // Edit & delete state
  const [editTarget, setEditTarget] = useState<Deliverable | null>(null);
  const [editForm, setEditForm] = useState<UploadForm>(EMPTY_UPLOAD_FORM);
  const [editFile, setEditFile] = useState<File | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Deliverable | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getStatusBadge = (status: ValidationStatus) => {
    switch (status) {
      case 'APPROVED':
        return {
          tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
          icon: CheckCircle,
          label: t('func.deliverables.approved')
        };
      case 'CHANGES_REQUESTED':
        return {
          tone: 'bg-destructive/10 text-destructive border-destructive/20',
          icon: XCircle,
          label: t('func.deliverables.changesRequested')
        };
      case 'PENDING':
        return {
          tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
          icon: Clock,
          label: t('func.deliverables.pendingReview')
        };
    }
  };

  const loadDeliverables = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [data, projectData] = await Promise.all([
        DeliverablesAPI.getAll(),
        ProjectsAPI.getAll(),
      ]);
      setDeliverables(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      setProjects(projectData);
    } catch (error) {
      setDeliverables([]);
      setProjects([]);
      const message = error instanceof Error ? error.message : t('func.deliverables.toasts.loadFailed');
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadDeliverables();
  }, [loadDeliverables]);

  const filteredDeliverables = useMemo(() => {
    return deliverables.filter((d) => {
      const matchStatus = statusFilter === 'ALL' || d.validationStatus === statusFilter;
      const matchSearch =
        searchQuery === '' ||
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.type.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [deliverables, statusFilter, searchQuery]);

  const closeReviewDialog = () => {
    setSelectedDeliverable(null);
    setComment('');
  };

  const updateValidationStatus = async (
    id: string,
    status: ValidationStatus,
    functionalComment?: string
  ) => {
    if (!canReview) {
      toast.error(t('func.deliverables.toasts.notAllowed'));
      return;
    }

    try {
      setIsReviewSubmitting(true);
      const updated = await DeliverablesAPI.update(id, {
        validationStatus: status,
        functionalComment,
      });
      setDeliverables((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));

      const project = projects.find((entry) => entry.id === updated.projectId);
      if (project) {
        await NotificationsAPI.create({
          userId: project.managerId,
          type: 'DELIVERABLE_REVIEWED',
          title: t('notifications.deliverableReviewed.title'),
          message: t('notifications.deliverableReviewed.message', {
            name: updated.name,
            status: t(`entities.validationStatus.${status}`),
          }),
          targetPath: `{roleBasePath}/projects/${updated.projectId}`,
          read: false,
        });
      }

      toast.success(t('func.deliverables.toasts.updated'));
      closeReviewDialog();
    } catch (error) {
      toast.error(t('func.deliverables.toasts.updateFailed'));
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  // Upload a file to the attachments service and link it to a deliverable,
  // returning the refreshed deliverable (or the original if no attachment id).
  const attachFileToDeliverable = async (deliverable: Deliverable, file: File): Promise<Deliverable> => {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const json = await odataFetch<{ ID?: string; id?: string; value?: { ID?: string; id?: string } }>(
      'core',
      '/uploadAttachment',
      {
        method: 'POST',
        body: JSON.stringify({
          parentType: 'DELIVERABLE',
          parentId: deliverable.id,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: base64,
        }),
      }
    );

    const attachment = json?.value ?? json;
    const attachmentId = attachment?.ID || attachment?.id;
    if (attachmentId) {
      return await DeliverablesAPI.update(deliverable.id, { fileRef: `/attachments/${attachmentId}` });
    }
    return deliverable;
  };

  const createSpecification = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) return;
    if (!uploadForm.projectId || !uploadForm.name.trim() || !uploadForm.type.trim()) {
      toast.error(t('func.deliverables.toasts.requiredFields'));
      return;
    }

    try {
      setIsUploading(true);
      let created = await DeliverablesAPI.create({
        projectId: uploadForm.projectId,
        type: uploadForm.type.trim(),
        name: uploadForm.name.trim(),
        validationStatus: 'PENDING',
        functionalComment: '',
      });

      // Upload the attached file (if any) and link it back to the deliverable.
      if (uploadFile) {
        created = await attachFileToDeliverable(created, uploadFile);
      }

      setDeliverables((prev) => [created, ...prev]);

      // The manager notification is generated server-side on deliverable
      // creation; a consultant cannot POST a notification targeting another
      // user (blocked as recipient spoofing).

      setUploadForm(EMPTY_UPLOAD_FORM);
      setUploadFile(null);
      setIsDepositOpen(false);
      toast.success(t('func.deliverables.toasts.submitted'));
    } catch (error) {
      toast.error(t('func.deliverables.toasts.submitFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  const openEdit = (deliverable: Deliverable) => {
    setEditTarget(deliverable);
    setEditForm({
      projectId: deliverable.projectId,
      type: deliverable.type,
      name: deliverable.name,
    });
    setEditFile(null);
  };

  const submitEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;
    if (!editForm.projectId || !editForm.name.trim() || !editForm.type.trim()) {
      toast.error(t('func.deliverables.toasts.requiredFields'));
      return;
    }

    try {
      setIsEditing(true);
      let updated = await DeliverablesAPI.update(editTarget.id, {
        projectId: editForm.projectId,
        type: editForm.type.trim(),
        name: editForm.name.trim(),
      });

      // Optionally replace the attached file.
      if (editFile) {
        updated = await attachFileToDeliverable(updated, editFile);
      }

      setDeliverables((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
      setEditTarget(null);
      setEditFile(null);
      toast.success(t('func.deliverables.toasts.updated'));
    } catch (error) {
      toast.error(t('func.deliverables.toasts.updateFailed'));
    } finally {
      setIsEditing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      await DeliverablesAPI.remove(deleteTarget.id);
      setDeliverables((prev) => prev.filter((entry) => entry.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success(t('func.deliverables.toasts.deleted'));
    } catch (error) {
      toast.error(t('func.deliverables.toasts.deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Metrics
  const pendingCount = deliverables.filter(d => d.validationStatus === 'PENDING').length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('func.deliverables.title')}
        subtitle={t('func.deliverables.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: '/consultant-func/dashboard' },
          { label: t('func.deliverables.title') },
        ]}
      />

      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        {loadError && (
          <Card className="border-destructive/50">
            <CardContent className="pt-4 text-sm text-destructive">{loadError}</CardContent>
          </Card>
        )}
        
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
          <div className="flex flex-1 gap-4 items-center w-full sm:w-auto">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('func.deliverables.search')}
                className="pl-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
               <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
               <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ValidationStatus | 'ALL')}>
                 <SelectTrigger className="w-[180px] bg-background">
                   <SelectValue placeholder={t('func.deliverables.allStatuses')} />
                 </SelectTrigger>
                 <SelectContent>
                   <SelectItem value="ALL">{t('func.deliverables.allStatuses')}</SelectItem>
                   <SelectItem value="PENDING">{t('func.deliverables.pendingReview')}</SelectItem>
                   <SelectItem value="APPROVED">{t('func.deliverables.approved')}</SelectItem>
                   <SelectItem value="CHANGES_REQUESTED">{t('func.deliverables.changesRequested')}</SelectItem>
                 </SelectContent>
               </Select>
            </div>
          </div>
          <Button onClick={() => setIsDepositOpen(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> {t('func.deliverables.deposit')}
          </Button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredDeliverables.length === 0 ? (
          <Card className="bg-card/50 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <FileText className="h-8 w-8 text-primary/60" />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{t('func.deliverables.empty.title')}</h3>
              <p className="mt-2 text-muted-foreground max-w-sm">
                {searchQuery ? t('func.deliverables.empty.descSearch') : t('func.deliverables.empty.descEmpty')}
              </p>
              {!searchQuery && statusFilter === 'ALL' && (
                <Button onClick={() => setIsDepositOpen(true)} variant="outline" className="mt-6">
                  <FileUp className="mr-2 h-4 w-4" /> {t('func.deliverables.empty.upload')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
             {pendingCount > 0 && statusFilter === 'ALL' && !searchQuery && (
                <h3 className="text-sm font-medium text-muted-foreground flex items-center mb-2">
                  <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2"></span>
                  {t('func.deliverables.waitingReview', { count: pendingCount })}
                </h3>
             )}
            <Card className="overflow-hidden border-border/70 shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-4 min-w-[240px] text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.tableHeaders.deliverable')}</TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.project')}</TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.tableHeaders.status')}</TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.reference')}</TableHead>
                      <TableHead className="px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.tableHeaders.date')}</TableHead>
                      <TableHead className="px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDeliverables.map((deliverable) => {
                      const badge = getStatusBadge(deliverable.validationStatus);
                      const StatusIcon = badge.icon;
                      const project = projects.find((p) => p.id === deliverable.projectId);

                      return (
                        <TableRow key={deliverable.id} className="border-border/60 transition-colors hover:bg-muted/40">
                          <TableCell className="px-4 py-3.5 align-top">
                            <div className="font-semibold text-foreground whitespace-normal">{deliverable.name}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">{deliverable.type}</div>
                            {deliverable.functionalComment && (
                              <div className="mt-1.5 text-xs text-foreground/70 line-clamp-2 max-w-xs whitespace-normal">
                                <span className="font-medium text-muted-foreground">{t('func.deliverables.feedback')}: </span>
                                {deliverable.functionalComment}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3.5 text-sm text-foreground">{project?.name ?? deliverable.projectId}</TableCell>
                          <TableCell className="px-4 py-3.5">
                            <Badge variant="outline" className={`font-medium shadow-none ${badge.tone}`}>
                              <StatusIcon className="mr-1.5 h-3 w-3" />
                              {badge.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3.5 max-w-[200px]">
                            {deliverable.fileRef ? (
                              <a href={deliverable.fileRef} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline flex items-center">
                                <ExternalLink className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{deliverable.fileRef}</span>
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <span className="text-xs text-muted-foreground flex items-center whitespace-nowrap">
                              <CalendarDays className="h-3 w-3 mr-1" />
                              {new Date(deliverable.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          </TableCell>
                          <TableCell className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {canReview && deliverable.validationStatus === 'PENDING' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedDeliverable(deliverable);
                                    setComment(deliverable.functionalComment || '');
                                  }}
                                >
                                  {t('func.deliverables.review')}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                title={t('common.edit')}
                                aria-label={t('common.edit')}
                                onClick={() => openEdit(deliverable)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              {(canReview || deliverable.createdBy === currentUser?.id) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive disabled:opacity-40"
                                  title={deliverable.validationStatus === 'APPROVED' ? t('func.deliverables.deleteDialog.approvedBlocked') : t('common.delete')}
                                  aria-label={t('common.delete')}
                                  disabled={deliverable.validationStatus === 'APPROVED'}
                                  onClick={() => setDeleteTarget(deliverable)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Deposit Dialog */}
      <Dialog open={isDepositOpen} onOpenChange={(open) => { setIsDepositOpen(open); if (!open) setUploadFile(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-primary" />
              {t('func.deliverables.depositDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('func.deliverables.depositDialog.desc')}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={createSpecification} id="deposit-form" className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="deliverable-project" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.targetProject')}</Label>
              <Select
                value={uploadForm.projectId}
                onValueChange={(value) => setUploadForm((prev) => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger id="deliverable-project" className="h-11">
                  <SelectValue placeholder={t('func.deliverables.depositDialog.projectPlaceholder')} />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deliverable-type" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.docType')}</Label>
                <Input
                  id="deliverable-type"
                  value={uploadForm.type}
                  className="h-11"
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, type: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deliverable-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.docTitle')}</Label>
                <Input
                  id="deliverable-name"
                  value={uploadForm.name}
                  className="h-11"
                  onChange={(event) => setUploadForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t('func.deliverables.depositDialog.docTitlePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deliverable-file" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.fileUpload')}</Label>
              <input
                ref={fileInputRef}
                id="deliverable-file"
                type="file"
                className="sr-only"
                onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
              />
              {uploadFile ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <Paperclip className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="truncate">{uploadFile.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={t('common.delete')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <FileUp className="h-6 w-6 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{t('func.deliverables.depositDialog.fileUploadCta')}</span>
                  <span className="text-xs text-muted-foreground">{t('func.deliverables.depositDialog.fileUploadHint')}</span>
                </button>
              )}
            </div>
          </form>

          <DialogFooter className="pt-4 border-t border-border/50">
             <Button type="button" variant="ghost" onClick={() => setIsDepositOpen(false)}>{t('common.cancel')}</Button>
             <Button type="submit" form="deposit-form" disabled={isUploading || !uploadForm.projectId || !uploadForm.name}>
               {isUploading ? t('func.deliverables.depositDialog.submitting') : t('func.deliverables.depositDialog.submit')}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={canReview && selectedDeliverable !== null} onOpenChange={(open) => !open && closeReviewDialog()}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('func.deliverables.reviewDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('func.deliverables.reviewDialog.desc')}
            </DialogDescription>
          </DialogHeader>

          {selectedDeliverable && (
            <div className="space-y-5 py-4">
              <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border border-border">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">{t('func.deliverables.reviewDialog.name')}</Label>
                  <div className="text-sm font-medium">{selectedDeliverable.name}</div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">{t('func.deliverables.reviewDialog.type')}</Label>
                  <div className="text-sm font-medium">{selectedDeliverable.type}</div>
                </div>
                {selectedDeliverable.fileRef && (
                   <div className="col-span-2">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">{t('func.deliverables.reviewDialog.link')}</Label>
                      <a href={selectedDeliverable.fileRef} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">{selectedDeliverable.fileRef}</a>
                   </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-comment" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.reviewDialog.feedbackLabel')}</Label>
                <Textarea
                  id="review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows={4}
                  className="resize-none"
                  placeholder={t('func.deliverables.reviewDialog.feedbackPlaceholder')}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between pt-4 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={closeReviewDialog} className="sm:mr-auto">
              {t('common.cancel')}
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
               <Button
                 type="button"
                 variant="destructive"
                 disabled={!selectedDeliverable || isReviewSubmitting}
                 onClick={() =>
                   selectedDeliverable &&
                   void updateValidationStatus(selectedDeliverable.id, 'CHANGES_REQUESTED', comment)
                 }
               >
                 <XCircle className="h-4 w-4 mr-1.5" />
                 {isReviewSubmitting ? t('func.deliverables.reviewDialog.saving') : t('func.deliverables.reviewDialog.requestChanges')}
               </Button>
               <Button
                 type="button"
                 disabled={!selectedDeliverable || isReviewSubmitting}
                 className="bg-emerald-600 hover:bg-emerald-700 text-white"
                 onClick={() =>
                   selectedDeliverable &&
                   void updateValidationStatus(selectedDeliverable.id, 'APPROVED', comment)
                 }
               >
                 <CheckCircle className="h-4 w-4 mr-1.5" />
                 {isReviewSubmitting ? t('func.deliverables.reviewDialog.saving') : t('func.deliverables.reviewDialog.approve')}
               </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editTarget !== null} onOpenChange={(open) => { if (!open) { setEditTarget(null); setEditFile(null); } }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              {t('func.deliverables.editDialog.title')}
            </DialogTitle>
            <DialogDescription>
              {t('func.deliverables.editDialog.desc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitEdit} id="edit-form" className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-deliverable-project" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.targetProject')}</Label>
              <Select
                value={editForm.projectId}
                onValueChange={(value) => setEditForm((prev) => ({ ...prev, projectId: value }))}
              >
                <SelectTrigger id="edit-deliverable-project" className="h-11">
                  <SelectValue placeholder={t('func.deliverables.depositDialog.projectPlaceholder')} />
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-deliverable-type" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.docType')}</Label>
                <Input
                  id="edit-deliverable-type"
                  value={editForm.type}
                  className="h-11"
                  onChange={(event) => setEditForm((prev) => ({ ...prev, type: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-deliverable-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.depositDialog.docTitle')}</Label>
                <Input
                  id="edit-deliverable-name"
                  value={editForm.name}
                  className="h-11"
                  onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder={t('func.deliverables.depositDialog.docTitlePlaceholder')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-deliverable-file" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('func.deliverables.editDialog.replaceFile')}</Label>
              <input
                ref={editFileInputRef}
                id="edit-deliverable-file"
                type="file"
                className="sr-only"
                onChange={(event) => setEditFile(event.target.files?.[0] ?? null)}
              />
              {editFile ? (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <Paperclip className="h-4 w-4 flex-shrink-0 text-primary" />
                    <span className="truncate">{editFile.name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditFile(null);
                      if (editFileInputRef.current) editFileInputRef.current.value = '';
                    }}
                    className="text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={t('common.delete')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => editFileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3 text-center transition-colors hover:border-primary/50 hover:bg-muted/40"
                >
                  <FileUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{t('func.deliverables.editDialog.replaceFileCta')}</span>
                </button>
              )}
              {editTarget?.fileRef && !editFile && (
                <p className="text-xs text-muted-foreground">
                  {t('func.deliverables.editDialog.currentFile')}: <span className="text-foreground">{editTarget.fileRef}</span>
                </p>
              )}
            </div>
          </form>

          <DialogFooter className="pt-4 border-t border-border/50">
             <Button type="button" variant="ghost" onClick={() => setEditTarget(null)}>{t('common.cancel')}</Button>
             <Button type="submit" form="edit-form" disabled={isEditing || !editForm.projectId || !editForm.name.trim()}>
               {isEditing ? t('func.deliverables.editDialog.saving') : t('common.save')}
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="inline-flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('func.deliverables.deleteDialog.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('func.deliverables.deleteDialog.desc', { name: deleteTarget?.name ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
              onClick={(event) => { event.preventDefault(); void confirmDelete(); }}
            >
              {isDeleting ? t('func.deliverables.deleteDialog.deleting') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
