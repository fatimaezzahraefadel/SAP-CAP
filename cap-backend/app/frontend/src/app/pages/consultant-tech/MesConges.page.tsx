import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';import { LeaveRequestsAPI } from '../../services/odata/leaveRequestsApi';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { LeaveRequest, LeaveStatus } from '../../types/entities';
import { useAuth } from '../../context/AuthContext';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Textarea } from '../../components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

const statusColor: Record<LeaveStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface LeaveForm {
  startDate: string;
  endDate: string;
  reason: string;
}

const EMPTY_FORM: LeaveForm = { startDate: '', endDate: '', reason: '' };

export const MesConges: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<LeaveForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await LeaveRequestsAPI.getByConsultant(currentUser.id);
      setRequests(data.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !form.startDate || !form.endDate) {
      toast.error(t('consultantTech.leaves.errors.dateRequired'));
      return;
    }
    if (form.endDate < form.startDate) {
      toast.error(t('consultantTech.leaves.errors.endAfterStart'));
      return;
    }
    try {
      const created = await LeaveRequestsAPI.create({
        consultantId: currentUser.id,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || undefined,
        status: 'PENDING',
        managerId: 'TBD',
      });
      setRequests((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      toast.success(t('consultantTech.leaves.toasts.requestSuccess'));

      // Notify the manager if setting is enabled
      try {
        const appSettings = JSON.parse(localStorage.getItem('appSettings') ?? '{}') as Record<string, unknown>;
        const notifEnabled = appSettings.leaveRequestNotif !== false; // enabled by default
        if (notifEnabled) {
          const allUsers = await UsersAPI.getAll();
          const manager = allUsers.find((u) => u.role === 'MANAGER' && u.active);
          if (manager) {
            await NotificationsAPI.create({
              userId: manager.id,
              type: 'LEAVE_REQUEST',
              title: 'Nouvelle demande de congé',
              message: `${currentUser.name} a soumis une demande de congé du ${new Date(form.startDate).toLocaleDateString('fr-FR')} au ${new Date(form.endDate).toLocaleDateString('fr-FR')}.`,
              targetPath: '/manager/leave',
              read: false,
            });
          }
        }
      } catch {
        // Notification failure should not block the main action
      }
    } catch {
      toast.error(t('consultantTech.leaves.toasts.requestFailed'));
    }
  };

  const stats = useMemo(() => ({
    total: requests.length,
    pending: requests.filter((r) => r.status === 'PENDING').length,
    approved: requests.filter((r) => r.status === 'APPROVED').length,
    rejected: requests.filter((r) => r.status === 'REJECTED').length,
    daysTaken: requests
      .filter((r) => r.status === 'APPROVED')
      .reduce((sum, r) => {
        const start = new Date(r.startDate);
        const end = new Date(r.endDate);
        const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return sum + diff;
      }, 0),
  }), [requests]);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('consultantTech.leaves.title')}
        subtitle={t('consultantTech.leaves.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: '/consultant-tech/dashboard' },
          { label: t('sidebar.items.Leave') },
        ]}
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.leaves.stats.total')}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-yellow-600">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.leaves.stats.pending')}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-green-600">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.leaves.stats.approved')}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-primary">{stats.daysTaken}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.leaves.stats.daysApproved')}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t('consultantTech.leaves.requestLeave')}
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">{t('consultantTech.leaves.table.startDate')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.leaves.table.endDate')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.leaves.table.days')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.leaves.table.reason')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.leaves.table.status')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.leaves.table.submitted')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => {
                  const days = Math.ceil((new Date(req.endDate).getTime() - new Date(req.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="px-4 py-3 text-sm">{new Date(req.startDate).toLocaleDateString()}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">{new Date(req.endDate).toLocaleDateString()}</TableCell>
                      <TableCell className="px-4 py-3 text-sm font-medium">{days}</TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{req.reason || '-'}</TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={statusColor[req.status]}>{t(`consultantTech.leaves.status.${req.status}`)}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  );
                })}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">{t('consultantTech.leaves.empty')}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('consultantTech.leaves.dialog.title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void submitRequest(e)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('consultantTech.leaves.dialog.startDate')}</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <Label>{t('consultantTech.leaves.dialog.endDate')}</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t('consultantTech.leaves.dialog.reason')}</Label>
              <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} placeholder={t('consultantTech.leaves.dialog.reasonPlaceholder')} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('consultantTech.leaves.submit')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
