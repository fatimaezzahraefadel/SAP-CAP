import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';import { UsersAPI } from '../../services/odata/usersApi';
import { Certification, CertificationStatus, User } from '../../types/entities';
import { useAuth } from '../../context/AuthContext';
import { Award, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
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

const statusColor: Record<CertificationStatus, string> = {
  VALID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  EXPIRING_SOON: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface CertForm {
  name: string;
  issuingBody: string;
  dateObtained: string;
  expiryDate: string;
  status: CertificationStatus;
}

const EMPTY_FORM: CertForm = {
  name: '',
  issuingBody: '',
  dateObtained: '',
  expiryDate: '',
  status: 'VALID',
};

export const MyCertifications: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CertForm>(EMPTY_FORM);

  const loadProfile = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const all = await UsersAPI.getAll();
      setProfile(all.find((u) => u.id === currentUser.id) ?? null);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const addCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !form.name || !form.dateObtained) {
      toast.error(t('consultantTech.certifications.toasts.addFailed'));
      return;
    }
    const cert: Certification = {
      id: `cert${Date.now()}`,
      name: form.name,
      issuingBody: form.issuingBody || 'N/A',
      dateObtained: form.dateObtained,
      expiryDate: form.expiryDate || undefined,
      status: form.status,
    };
    try {
      await UsersAPI.update(profile.id, {
        certifications: [...profile.certifications, cert],
      });
      await loadProfile();
      setForm(EMPTY_FORM);
      setShowAdd(false);
      toast.success(t('consultantTech.certifications.toasts.addSuccess'));
    } catch {
      toast.error(t('consultantTech.certifications.toasts.addFailed'));
    }
  };

  const removeCertification = async (certId: string) => {
    if (!profile) return;
    try {
      await UsersAPI.update(profile.id, {
        certifications: profile.certifications.filter((c) => c.id !== certId),
      });
      await loadProfile();
      toast.success(t('consultantTech.certifications.toasts.deleteSuccess'));
    } catch {
      toast.error(t('consultantTech.certifications.toasts.deleteFailed'));
    }
  };

  const certs = (profile?.certifications ?? []).filter(
    (c): c is Certification => typeof c === 'object' && c !== null && 'id' in c
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('consultantTech.certifications.title')}
        subtitle={t('consultantTech.certifications.subtitle')}
        breadcrumbs={[
          { label: t('common.home'), path: '/consultant-tech/dashboard' },
          { label: t('sidebar.items.Certifications') },
        ]}
      />

      <div className="p-6 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-primary">{certs.length}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.certifications.stats.total')}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-green-600">{certs.filter((c) => c.status === 'VALID').length}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.certifications.stats.valid')}</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-red-600">{certs.filter((c) => c.status === 'EXPIRED').length}</div>
            <div className="text-xs text-muted-foreground">{t('consultantTech.certifications.stats.expired')}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> {t('consultantTech.certifications.addCta')}
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t('common.loading')}</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">{t('consultantTech.certifications.table.name')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.certifications.table.issuingBody')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.certifications.table.obtained')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.certifications.table.expires')}</TableHead>
                  <TableHead className="px-4">{t('consultantTech.certifications.table.status')}</TableHead>
                  <TableHead className="px-4">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        {cert.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">{cert.issuingBody}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{new Date(cert.dateObtained).toLocaleDateString()}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">{cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : '-'}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className={statusColor[cert.status]}>{t(`consultantTech.certifications.status.${cert.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => void removeCertification(cert.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {certs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t('consultantTech.certifications.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('consultantTech.certifications.dialog.title')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void addCertification(e)} className="space-y-4">
            <div>
              <Label>{t('consultantTech.certifications.dialog.certificateName')}</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('consultantTech.certifications.dialog.certificateNamePlaceholder')} />
            </div>
            <div>
              <Label>{t('consultantTech.certifications.dialog.issuingBody')}</Label>
              <Input value={form.issuingBody} onChange={(e) => setForm({ ...form, issuingBody: e.target.value })} placeholder={t('consultantTech.certifications.dialog.issuingBodyPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('consultantTech.certifications.dialog.dateObtained')}</Label>
                <Input type="date" value={form.dateObtained} onChange={(e) => setForm({ ...form, dateObtained: e.target.value })} />
              </div>
              <div>
                <Label>{t('consultantTech.certifications.dialog.expiryDate')}</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>{t('consultantTech.certifications.dialog.status')}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as CertificationStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VALID">{t('consultantTech.certifications.status.VALID')}</SelectItem>
                  <SelectItem value="EXPIRING_SOON">{t('consultantTech.certifications.status.EXPIRING_SOON')}</SelectItem>
                  <SelectItem value="EXPIRED">{t('consultantTech.certifications.status.EXPIRED')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
              <Button type="submit">{t('consultantTech.certifications.add')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
