import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router';
import { BookOpenText, ExternalLink, FilePlus2, Paperclip, Search } from 'lucide-react';
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
          [...docData].sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))
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
    setForm(EMPTY_FORM);
    setIsCreateOpen(true);
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
        [created, ...prev].sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))
      );
      setIsCreateOpen(false);
      setForm(EMPTY_FORM);
      toast.success(t('documentation.success.created'));
    } catch {
      toast.error(t('documentation.errors.createFailed'));
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <Card className="md:col-span-2">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  placeholder={t('documentation.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger>
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as TypeFilter)}>
                <SelectTrigger>
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
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('documentation.objects')}</p>
              <p className="text-2xl font-semibold text-foreground">{filteredObjects.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {DOCUMENTATION_OBJECT_TYPES.map((type) => (
            <Card key={type}>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t(`documentation.types.${type}`)}
                  </p>
                  <p className="text-lg font-semibold text-foreground">{countsByType[type]}</p>
                </div>
                <BookOpenText className="h-4 w-4 text-primary" />
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
              <TableHeader className="bg-muted/55">
                <TableRow>
                  <TableHead className="px-4">{t('documentation.table.title')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.type')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.source')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.project')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.linkedTickets')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.files')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.author')}</TableHead>
                  <TableHead className="px-4">{t('documentation.table.updated')}</TableHead>
                  <TableHead className="px-4 text-right">{t('documentation.table.action')}</TableHead>
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
                        <div>
                          <p className="font-medium text-foreground">{doc.title}</p>
                          <p className="line-clamp-2 text-xs text-muted-foreground">{doc.description}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="outline">{t(`documentation.types.${doc.type}`)}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant={doc.sourceSystem === 'WRICEF' ? 'secondary' : 'outline'}>
                          {doc.sourceSystem === 'WRICEF' ? t('documentation.source.wricef') : t('documentation.manual')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {projectName(doc.projectId)}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge variant="secondary">
                          {Array.isArray(doc.relatedTicketIds) ? doc.relatedTicketIds.length : 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <Paperclip className="h-3.5 w-3.5" />
                          {Array.isArray(doc.attachedFiles) ? doc.attachedFiles.length : 0}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">{userName(doc.authorId)}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDateTime(doc.updatedAt ?? doc.createdAt, i18n.language)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/shared/documentation/${doc.id}`)}
                        >
                          <ExternalLink className="mr-1 h-3.5 w-3.5" />
                          {t('documentation.open')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('documentation.createTitle')}</DialogTitle>
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
              {isCreating ? t('documentation.creating') : t('documentation.createObject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

