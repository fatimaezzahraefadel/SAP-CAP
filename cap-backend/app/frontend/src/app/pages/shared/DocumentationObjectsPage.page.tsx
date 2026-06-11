import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { BookOpenText, ExternalLink, FilePlus2, FileText, Paperclip, Pencil, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
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
} from '../../components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
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
import { Textarea } from '../../components/ui/textarea';
import { Checkbox } from '../../components/ui/checkbox';
import { useAuth } from '../../context/AuthContext';
import { DocumentationAPI } from '../../services/odata/documentationApi';
import { ProjectsAPI } from '../../services/odata/projectsApi';
import { sanitizeFileName } from '../../utils/file';
import { TicketsAPI } from '../../services/odata/ticketsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import {
  DocumentationAttachment,
  DocumentationObject,
  DocumentationObjectType,
  Project,
  Ticket,
  User,
  UserRole,
} from '../../types/entities';
import { formatDateTime } from '../../utils/date';

type TypeFilter = DocumentationObjectType | 'ALL';

const homePathByRole: Record<UserRole, string> = {
  ADMIN: '/admin/dashboard',
  MANAGER: '/manager/dashboard',
  PROJECT_MANAGER: '/project-manager/dashboard',
  DEV_COORDINATOR: '/dev-coordinator/dashboard',
  CONSULTANT_TECHNIQUE: '/consultant-tech/dashboard',
  CONSULTANT_FONCTIONNEL: '/consultant-func/dashboard',
};

const DOCUMENTATION_OBJECT_TYPES: DocumentationObjectType[] = ['SFD', 'GUIDE', 'ARCHITECTURE_DOC', 'GENERAL'];

// Per-type colour coding for the Type badge + stat cards.
const typeBadgeColor: Record<DocumentationObjectType, string> = {
  SFD: 'border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  GUIDE: 'border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  ARCHITECTURE_DOC: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  GENERAL: 'border-transparent bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
};

const typeAccent: Record<DocumentationObjectType, string> = {
  SFD: 'text-blue-500',
  GUIDE: 'text-purple-500',
  ARCHITECTURE_DOC: 'text-amber-500',
  GENERAL: 'text-slate-500',
};

const sourceBadgeColor = (sourceSystem?: string): string =>
  sourceSystem === 'WRICEF'
    ? 'border-transparent bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
    : 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const MAX_ATTACHMENT_SIZE_BYTES = 2 * 1024 * 1024;

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unexpected file payload'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

const buildDefaultContent = (title: string) =>
  `# ${title}\n\n## Scope\n-\n\n## Functional Details\n-\n\n## Technical Notes\n-\n`;

interface CreateFormState {
  title: string;
  description: string;
  type: DocumentationObjectType;
  content: string;
  projectId: string;
  relatedTicketIds: string[];
  attachedFiles: DocumentationAttachment[];
}

const EMPTY_FORM: CreateFormState = {
  title: '',
  description: '',
  type: 'GENERAL',
  content: '',
  projectId: '',
  relatedTicketIds: [],
  attachedFiles: [],
};

export const DocumentationObjectsPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [objectPendingDelete, setObjectPendingDelete] = useState<DocumentationObject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [documentationObjects, setDocumentationObjects] = useState<DocumentationObject[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [docData, projectData, ticketData, userData] = await Promise.all([
          DocumentationAPI.getAll(),
          ProjectsAPI.getAll(),
          TicketsAPI.getAll(),
          UsersAPI.getAll(),
        ]);

        setDocumentationObjects(
          [...docData].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
        );
        setProjects(projectData);
        setTickets(ticketData);
        setUsers(userData);
      } catch (error) {
        setDocumentationObjects([]);
        setProjects([]);
        setTickets([]);
        setUsers([]);
        const message = error instanceof Error ? error.message : t('documentation.errors.loadFailed');
        setLoadError(message);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, [t]);

  const projectTickets = useMemo(
    () => tickets.filter((ticket) => ticket.projectId === form.projectId),
    [tickets, form.projectId]
  );

  const filteredObjects = useMemo(() => {
    return documentationObjects.filter((doc) => {
      if (projectFilter !== 'ALL' && doc.projectId !== projectFilter) return false;
      if (typeFilter !== 'ALL' && doc.type !== typeFilter) return false;
      if (!searchQuery.trim()) return true;

      const projectName = projects.find((project) => project.id === doc.projectId)?.name ?? '';
      const query = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.description.toLowerCase().includes(query) ||
        doc.content.toLowerCase().includes(query) ||
        projectName.toLowerCase().includes(query)
      );
    });
  }, [documentationObjects, projectFilter, typeFilter, searchQuery, projects]);

  const countsByType = useMemo(() => {
    const counts: Record<DocumentationObjectType, number> = {
      SFD: 0,
      GUIDE: 0,
      ARCHITECTURE_DOC: 0,
      GENERAL: 0,
    };
    documentationObjects.forEach((doc) => {
      counts[doc.type] += 1;
    });
    return counts;
  }, [documentationObjects]);

  const openCreateDialog = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsCreateOpen(true);
  };

  const openEditDialog = (doc: DocumentationObject) => {
    setEditingId(doc.id);
    setForm({
      title: doc.title,
      description: doc.description,
      type: doc.type,
      content: doc.content,
      projectId: doc.projectId,
      relatedTicketIds: Array.isArray(doc.relatedTicketIds) ? [...doc.relatedTicketIds] : [],
      attachedFiles: Array.isArray(doc.attachedFiles) ? [...doc.attachedFiles] : [],
    });
    setIsCreateOpen(true);
  };

  // Opens an attachment in a new tab regardless of file type. Data URLs are
  // converted to a Blob object URL so the browser renders them inline instead
  // of blocking top-level navigation to a data: URL.
  const openAttachment = (file: DocumentationAttachment) => {
    try {
      if (!file.url || file.url === '#') {
        toast.error(t('documentation.errors.fileUnavailable'));
        return;
      }
      if (file.url.startsWith('data:')) {
        const [meta, base64] = file.url.split(',');
        const mime = meta.match(/data:(.*?)(;base64)?$/)?.[1] || 'application/octet-stream';
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      } else {
        window.open(file.url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      toast.error(t('documentation.errors.fileUnavailable'));
    }
  };

  const confirmDelete = async () => {
    if (!objectPendingDelete) return;
    setIsDeleting(true);
    try {
      await DocumentationAPI.delete(objectPendingDelete.id);
      setDocumentationObjects((prev) => prev.filter((d) => d.id !== objectPendingDelete.id));
      toast.success(t('documentation.success.deleted'));
    } catch {
      toast.error(t('documentation.errors.deleteFailed'));
    } finally {
      setIsDeleting(false);
      setObjectPendingDelete(null);
    }
  };

  const handleFileAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = input.files;
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    const acceptedFiles = selectedFiles.filter((file) => file.size <= MAX_ATTACHMENT_SIZE_BYTES);
    const rejectedCount = selectedFiles.length - acceptedFiles.length;

    if (rejectedCount > 0) {
      toast.error(
        t('documentation.errors.filesSkipped', {
          count: rejectedCount,
          size: formatFileSize(MAX_ATTACHMENT_SIZE_BYTES),
        })
      );
    }

    if (acceptedFiles.length === 0) {
      input.value = '';
      return;
    }

    try {
      const additions: DocumentationAttachment[] = await Promise.all(
        acceptedFiles.map(async (file) => ({
          filename: sanitizeFileName(file.name),
          size: file.size,
          url: await fileToDataUrl(file),
        }))
      );
      setForm((prev) => ({ ...prev, attachedFiles: [...prev.attachedFiles, ...additions] }));
    } catch {
      toast.error(t('documentation.errors.attachFailed'));
    }
    input.value = '';
  };

  const toggleTicket = (ticketId: string, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      relatedTicketIds: checked
        ? [...new Set([...prev.relatedTicketIds, ticketId])]
        : prev.relatedTicketIds.filter((id) => id !== ticketId),
    }));
  };

  const submitCreate = async () => {
    if (!currentUser) return;
    if (!form.title.trim()) {
      toast.error(t('documentation.errors.titleRequired'));
      return;
    }
    if (!form.projectId) {
      toast.error(t('documentation.errors.projectRequired'));
      return;
    }
    if (!form.content.trim()) {
      toast.error(t('documentation.errors.contentRequired'));
      return;
    }

    try {
      setIsCreating(true);

      if (editingId) {
        const updated = await DocumentationAPI.update(editingId, {
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          content: form.content.trim(),
          attachedFiles: form.attachedFiles,
          relatedTicketIds: form.relatedTicketIds,
          projectId: form.projectId,
        });
        setDocumentationObjects((prev) =>
          prev
            .map((d) => (d.id === editingId ? updated : d))
            .sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
        );
        toast.success(t('documentation.success.updated'));
      } else {
        const created = await DocumentationAPI.create({
          title: form.title.trim(),
          description: form.description.trim(),
          type: form.type,
          content: form.content.trim(),
          attachedFiles: form.attachedFiles,
          relatedTicketIds: form.relatedTicketIds,
          projectId: form.projectId,
          authorId: currentUser.id,
          sourceSystem: 'MANUAL',
        });
        setDocumentationObjects((prev) =>
          [created, ...prev].sort((a, b) => (b.updatedAt ?? b.createdAt).localeCompare(a.updatedAt ?? a.createdAt))
        );
        toast.success(t('documentation.success.created'));
      }

      setIsCreateOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (error) {
      // Surface the precise backend reason both in the console and the toast.
      console.error('[DocumentationObjects] save failed:', error);
      const baseMessage = editingId
        ? t('documentation.errors.updateFailed')
        : t('documentation.errors.createFailed');
      const err = (error ?? {}) as {
        message?: unknown;
        status?: unknown;
        details?: Array<{ message?: unknown }>;
      };
      const detail =
        (Array.isArray(err.details) && err.details[0]?.message
          ? String(err.details[0].message)
          : '') || (err.message ? String(err.message) : '');
      toast.error(detail ? `${baseMessage}: ${detail}` : baseMessage);
    } finally {
      setIsCreating(false);
    }
  };

  const userName = (userId: string) => users.find((user) => user.id === userId)?.name ?? userId;
  const projectName = (projectId: string) =>
    projects.find((project) => project.id === projectId)?.name ?? projectId;

  if (currentUser?.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const homePath = currentUser ? homePathByRole[currentUser.role] : '/dashboard';

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('documentation.title')}
        subtitle={t('documentation.subtitle')}
        breadcrumbs={[
          { label: t('documentation.home'), path: homePath },
          { label: t('documentation.objects') },
        ]}
        actions={
          <Button onClick={openCreateDialog}>
            <FilePlus2 className="mr-1 h-4 w-4" />
            {t('documentation.newObject')}
          </Button>
        }
      />

      <div className="space-y-6 p-6 lg:p-8">
        {loadError && (
          <Card className="border-destructive/50">
            <CardContent className="pt-4 text-sm text-destructive">{loadError}</CardContent>
          </Card>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={t('documentation.searchPlaceholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue placeholder={t('documentation.allProjects')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('documentation.allProjects')}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder={t('documentation.allTypes')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('documentation.allTypes')}</SelectItem>
              {DOCUMENTATION_OBJECT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {t(`documentation.types.${type}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 whitespace-nowrap rounded-md border border-border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t('documentation.objects')}</span>
            <span className="font-semibold text-foreground">{filteredObjects.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {DOCUMENTATION_OBJECT_TYPES.map((type) => (
            <Card key={type} className="overflow-hidden">
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <Badge className={`mb-1 ${typeBadgeColor[type]}`}>{t(`documentation.types.${type}`)}</Badge>
                  <p className="text-2xl font-semibold text-foreground">{countsByType[type]}</p>
                </div>
                <BookOpenText className={`h-6 w-6 ${typeAccent[type]}`} />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">{t('documentation.kbObjects')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.title')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.type')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.source')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.project')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.linkedTickets')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.files')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.author')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.updated')}</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('documentation.table.action')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {t('documentation.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredObjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                      {t('documentation.noObjects')}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredObjects.map((doc) => (
                    <TableRow key={doc.id} className="hover:bg-accent/30">
                      <TableCell className="px-4 py-3">
                        <div className="min-w-[200px] max-w-xs">
                          <p className="font-medium text-foreground">{doc.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={typeBadgeColor[doc.type]}>{t(`documentation.types.${doc.type}`)}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={sourceBadgeColor(doc.sourceSystem)}>
                          {doc.sourceSystem === 'WRICEF' ? t('documentation.source.wricef') : t('documentation.manual')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {projectName(doc.projectId)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {(() => {
                          const count = Array.isArray(doc.relatedTicketIds) ? doc.relatedTicketIds.length : 0;
                          return (
                            <Badge
                              className={
                                count > 0
                                  ? 'border-transparent bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300'
                                  : 'border-transparent bg-muted text-muted-foreground'
                              }
                            >
                              {count}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        {Array.isArray(doc.attachedFiles) && doc.attachedFiles.length > 0 ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mx-auto inline-flex h-8 items-center gap-1 text-sm text-primary hover:bg-primary/10 hover:text-primary"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                {doc.attachedFiles.length}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" className="max-w-xs">
                              {doc.attachedFiles.map((file, index) => (
                                <DropdownMenuItem
                                  key={`${file.filename}-${index}`}
                                  onSelect={() => openAttachment(file)}
                                  className="cursor-pointer gap-2"
                                >
                                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                                  <span className="truncate">{file.filename}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                            <Paperclip className="h-3.5 w-3.5" />
                            0
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-sm">{userName(doc.authorId)}</TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(doc.updatedAt ?? doc.createdAt, i18n.language)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                            onClick={() => navigate(`/shared/documentation/${doc.id}`)}
                            title={t('documentation.open')}
                            aria-label={t('documentation.open')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditDialog(doc)}
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setObjectPendingDelete(doc)}
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingId(null);
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('documentation.editTitle') : t('documentation.createTitle')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="new-object-title">{t('documentation.titleLabel')}</Label>
                <Input
                  id="new-object-title"
                  value={form.title}
                  onChange={(event) => {
                    const value = event.target.value;
                    setForm((prev) => ({
                      ...prev,
                      title: value,
                      content: prev.content || buildDefaultContent(value || t('documentation.defaultTitle')),
                    }));
                  }}
                  placeholder={t('documentation.titlePlaceholder')}
                />
              </div>
              <div>
                <Label htmlFor="new-object-type">{t('documentation.typeLabel')}</Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, type: value as DocumentationObjectType }))
                  }
                >
                  <SelectTrigger id="new-object-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENTATION_OBJECT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`documentation.types.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="new-object-project">{t('documentation.projectLabel')}</Label>
              <Select
                value={form.projectId}
                onValueChange={(value) =>
                  setForm((prev) => ({
                    ...prev,
                    projectId: value,
                    relatedTicketIds: prev.relatedTicketIds.filter(
                      (ticketId) => tickets.find((ticket) => ticket.id === ticketId)?.projectId === value
                    ),
                  }))
                }
              >
                <SelectTrigger id="new-object-project">
                  <SelectValue placeholder={t('documentation.selectProject')} />
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

            <div>
              <Label htmlFor="new-object-description">{t('documentation.overviewLabel')}</Label>
              <Textarea
                id="new-object-description"
                rows={2}
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder={t('documentation.overviewPlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="new-object-content">{t('documentation.contentLabel')}</Label>
              <Textarea
                id="new-object-content"
                rows={12}
                className="font-mono text-sm"
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder={t('documentation.contentPlaceholder')}
              />
            </div>

            <div>
              <Label htmlFor="new-object-files">{t('documentation.attachedFilesLabel')}</Label>
              <Input id="new-object-files" type="file" multiple onChange={handleFileAttach} />
              {form.attachedFiles.length > 0 && (
                <div className="mt-2 space-y-1 rounded-md border border-border/70 bg-muted/20 p-2">
                  {form.attachedFiles.map((file, index) => (
                    <div key={`${file.filename}-${index}`} className="text-xs text-muted-foreground">
                      {file.filename} ({formatFileSize(file.size)})
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>{t('documentation.relatedTicketsLabel')}</Label>
              {!form.projectId ? (
                <p className="text-xs text-muted-foreground">{t('documentation.selectProjectFirst')}</p>
              ) : projectTickets.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t('documentation.noTicketsFound')}</p>
              ) : (
                <div className="mt-1 max-h-40 space-y-2 overflow-y-auto rounded-md border border-border/70 bg-muted/20 p-2">
                  {projectTickets.map((ticket) => (
                    <label
                      key={ticket.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-accent/30"
                    >
                      <Checkbox
                        checked={form.relatedTicketIds.includes(ticket.id)}
                        onCheckedChange={(checked) => toggleTicket(ticket.id, Boolean(checked))}
                      />
                      <span className="text-xs text-foreground">
                        {ticket.ticketCode} - {ticket.title}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              {t('documentation.cancel')}
            </Button>
            <Button onClick={() => void submitCreate()} disabled={isCreating}>
              {isCreating
                ? editingId
                  ? t('documentation.saving')
                  : t('documentation.creating')
                : editingId
                  ? t('common.save')
                  : t('documentation.createObject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={objectPendingDelete !== null}
        onOpenChange={(open) => { if (!open) setObjectPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('documentation.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('documentation.deleteConfirm.description', { title: objectPendingDelete?.title ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('documentation.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
              disabled={isDeleting}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

