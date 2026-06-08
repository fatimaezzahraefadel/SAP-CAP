import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle,
  Edit,
  Save,
  Search,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PageHeader } from '../../components/common/PageHeader';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { UsersAPI } from '../../services/odata/usersApi';
import { User, UserRole } from '../../types/entities';

interface UserForm {
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  skills: string;
  certifications: string;
  availabilityPercent: number;
}

const EMPTY_FORM: UserForm = {
  name: '',
  email: '',
  role: 'CONSULTANT_TECHNIQUE',
  active: true,
  skills: '',
  certifications: '',
  availabilityPercent: 100,
};

const getRoleBadgeTone = (role: UserRole) => {
  const styles: Record<UserRole, string> = {
    ADMIN: 'bg-destructive/12 text-destructive',
    MANAGER: 'bg-primary/12 text-primary',
    PROJECT_MANAGER: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    DEV_COORDINATOR: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    CONSULTANT_TECHNIQUE: 'bg-accent text-accent-foreground',
    CONSULTANT_FONCTIONNEL: 'bg-secondary text-secondary-foreground',
  };
  return styles[role];
};

export const UsersManagement: React.FC = () => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | 'ALL'>('ALL');
  const [showDialog, setShowDialog] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await UsersAPI.getAll();
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  const resetDialog = () => {
    setShowDialog(false);
    setEditingUserId(null);
    setForm(EMPTY_FORM);
  };

  const openEdit = (user: User) => {
    setEditingUserId(user.id);
    setForm({
      name: user.name,
      email: user.email,
      role: user.role,
      active: user.active,
      skills: user.skills.join(', '),
      certifications: user.certifications.map((c) => typeof c === 'string' ? c : c.name).join(', '),
      availabilityPercent: user.availabilityPercent,
    });
    setShowDialog(true);
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error(t('admin.users.toasts.requiredFields'));
      return;
    }
    if (form.availabilityPercent < 0 || form.availabilityPercent > 100) {
      toast.error(t('admin.users.toasts.invalidAvailability'));
      return;
    }

    const payload = {
      name: form.name.trim(),
      skills: form.skills
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      certifications: form.certifications
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((name, i) => ({ id: `cert_${Date.now()}_${i}`, name, issuingBody: 'N/A', dateObtained: new Date().toISOString().slice(0, 10), status: 'VALID' as const })),
      availabilityPercent: form.availabilityPercent,
    };

    try {
      setIsSubmitting(true);
      if (editingUserId) {
        const updated = await UsersAPI.update(editingUserId, payload);
        setUsers((prev) => prev.map((entry) => (entry.id === editingUserId ? updated : entry)));
        toast.success(t('admin.users.toasts.updated'));
      }
      resetDialog();
    } catch (error) {
      toast.error(t('admin.users.toasts.saveFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query || user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query);
      const matchesRole = filterRole === 'ALL' || user.role === filterRole;
      return matchesSearch && matchesRole;
    });
  }, [users, searchQuery, filterRole]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('admin.users.title')}
        subtitle={t('admin.users.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: '/admin/dashboard' },
          { label: t('admin.users.title') },
        ]}
      />

      <div className="space-y-6 p-6 lg:p-8">
        <Card className="bg-card/92">
          <CardContent className="grid grid-cols-1 gap-3 pt-6 md:grid-cols-[1fr_240px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Label htmlFor="users-search" className="sr-only">
                {t('admin.users.searchPlaceholder')}
              </Label>
              <Input
                id="users-search"
                placeholder={t('admin.users.searchPlaceholder')}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="users-role-filter">{t('admin.users.role')}</Label>
              <Select
                value={filterRole}
                onValueChange={(val) => setFilterRole(val as UserRole | 'ALL')}
              >
                <SelectTrigger id="users-role-filter">
                  <SelectValue placeholder={t('admin.users.allRoles')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('admin.users.allRoles')}</SelectItem>
                  <SelectItem value="ADMIN">{t('entities.userRole.ADMIN')}</SelectItem>
                  <SelectItem value="MANAGER">{t('entities.userRole.MANAGER')}</SelectItem>
                  <SelectItem value="PROJECT_MANAGER">{t('entities.userRole.PROJECT_MANAGER')}</SelectItem>
                  <SelectItem value="DEV_COORDINATOR">{t('entities.userRole.DEV_COORDINATOR')}</SelectItem>
                  <SelectItem value="CONSULTANT_TECHNIQUE">{t('entities.userRole.CONSULTANT_TECHNIQUE')}</SelectItem>
                  <SelectItem value="CONSULTANT_FONCTIONNEL">{t('entities.userRole.CONSULTANT_FONCTIONNEL')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden bg-card/92">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/65">
                <TableRow>
                  <TableHead className="px-6">{t('admin.users.table.user')}</TableHead>
                  <TableHead className="px-6">{t('admin.users.table.role')}</TableHead>
                  <TableHead className="px-6">{t('admin.users.table.skills')}</TableHead>
                  <TableHead className="px-6">{t('admin.users.table.availability')}</TableHead>
                  <TableHead className="px-6">{t('admin.users.table.status')}</TableHead>
                  <TableHead className="px-6 text-right">{t('admin.users.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {t('admin.users.table.loading')}
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <Users className="h-8 w-8 text-muted-foreground/50" />
                        <p className="text-muted-foreground">{t('admin.users.table.empty')}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{user.name}</p>
                            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge className={getRoleBadgeTone(user.role)}>{t(`entities.userRole.${user.role}`)}</Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {user.skills.slice(0, 2).map((skill, index) => (
                            <Badge key={`${user.id}-${index}`} variant="secondary">
                              {skill}
                            </Badge>
                          ))}
                          {user.skills.length > 2 && (
                            <Badge variant="secondary">+{user.skills.length - 2}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="w-40 space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t('admin.users.table.rate')}</span>
                            <span>{user.availabilityPercent}%</span>
                          </div>
                          <Progress value={user.availabilityPercent} />
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <Badge variant={user.active ? 'default' : 'secondary'} className="gap-1">
                          {user.active && <CheckCircle className="h-3.5 w-3.5" />}
                          {user.active ? t('admin.users.table.active') : t('admin.users.table.inactive')}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEdit(user)}
                            title={`${t('common.edit')} ${user.name}`}
                            aria-label={`${t('common.edit')} ${user.name}`}
                          >
                            <Edit className="h-4 w-4" />
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
        open={showDialog}
        onOpenChange={(open) => {
          if (!open) {
            resetDialog();
            return;
          }
          setShowDialog(true);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.users.dialog.editTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.users.dialog.desc')}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveUser} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user-name">{t('admin.users.dialog.name')}</Label>
                <Input
                  id="user-name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email">{t('admin.users.dialog.email')}</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="user-role">{t('admin.users.dialog.role')}</Label>
                <Select
                  value={form.role}
                  disabled
                >
                  <SelectTrigger id="user-role">
                    <SelectValue placeholder={t('admin.users.dialog.selectRole')} />
                  </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ADMIN">{t('entities.userRole.ADMIN')}</SelectItem>
                      <SelectItem value="MANAGER">{t('entities.userRole.MANAGER')}</SelectItem>
                      <SelectItem value="PROJECT_MANAGER">{t('entities.userRole.PROJECT_MANAGER')}</SelectItem>
                      <SelectItem value="DEV_COORDINATOR">{t('entities.userRole.DEV_COORDINATOR')}</SelectItem>
                      <SelectItem value="CONSULTANT_TECHNIQUE">{t('entities.userRole.CONSULTANT_TECHNIQUE')}</SelectItem>
                      <SelectItem value="CONSULTANT_FONCTIONNEL">{t('entities.userRole.CONSULTANT_FONCTIONNEL')}</SelectItem>
                    </SelectContent>
                  </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-availability">{t('admin.users.dialog.availability')}</Label>
                <Input
                  id="user-availability"
                  type="number"
                  min={0}
                  max={100}
                  value={form.availabilityPercent}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      availabilityPercent: Number(event.target.value || 0),
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-skills">{t('admin.users.dialog.skills')}</Label>
              <Textarea
                id="user-skills"
                rows={3}
                value={form.skills}
                onChange={(event) => setForm((prev) => ({ ...prev, skills: event.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="user-certifications">{t('admin.users.dialog.certifications')}</Label>
              <Textarea
                id="user-certifications"
                rows={2}
                value={form.certifications}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, certifications: event.target.value }))
                }
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4" />
                {isSubmitting ? t('admin.users.dialog.saving') : t('common.edit')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
};

