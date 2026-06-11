import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';
import { CertificatesAPI } from '../../services/odata/certificatesApi';
import type { CertificateDocument } from '../../services/odata/certificatesApi';
import { Certification, CertificationStatus } from '../../types/entities';
import { useAuth } from '../../context/AuthContext';
import { Award, FileText, Pencil, Plus, Trash2, Upload } from 'lucide-react';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';

const statusColor: Record<CertificationStatus, string> = {
  VALID: 'border-transparent bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  EXPIRING_SOON: 'border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  EXPIRED: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

// Award-icon tint per status so each row carries its own colour cue.
const statusIconColor: Record<CertificationStatus, string> = {
  VALID: 'text-green-600',
  EXPIRING_SOON: 'text-yellow-600',
  EXPIRED: 'text-red-600',
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

const certToForm = (cert: Certification): CertForm => ({
  name: cert.name,
  issuingBody: cert.issuingBody,
  dateObtained: cert.dateObtained,
  expiryDate: cert.expiryDate ?? '',
  status: cert.status,
});

// Reads a File into a pure base64 string (without the data: prefix).
const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const MyCertifications: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser } = useAuth();
  const [certs, setCerts] = useState<Certification[]>([]);
  const [docsByCert, setDocsByCert] = useState<Record<string, CertificateDocument[]>>({});
  const [loading, setLoading] = useState(true);

  // Add dialog
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<CertForm>(EMPTY_FORM);
  const [addFile, setAddFile] = useState<File | null>(null);

  // Edit dialog
  const [editingCert, setEditingCert] = useState<Certification | null>(null);
  const [editForm, setEditForm] = useState<CertForm>(EMPTY_FORM);
  const [editFile, setEditFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [certPendingDelete, setCertPendingDelete] = useState<Certification | null>(null);

  const loadCerts = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const data = await CertificatesAPI.getByUser(currentUser.id);
      setCerts(data);

      // Fetch the attached documents for every certificate in parallel.
      const docEntries = await Promise.all(
        data.map(async (cert) => {
          try {
            const docs = await CertificatesAPI.listDocuments(cert.id);
            return [cert.id, docs] as const;
          } catch {
            return [cert.id, [] as CertificateDocument[]] as const;
          }
        })
      );
      setDocsByCert(Object.fromEntries(docEntries));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadCerts();
  }, [loadCerts]);

  // ---- Add ----------------------------------------------------------------
  const addCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !addForm.name || !addForm.issuingBody || !addForm.dateObtained) {
      toast.error(t('consultantTech.certifications.toasts.addFailed'));
      return;
    }
    setSaving(true);
    try {
      const created = await CertificatesAPI.create(currentUser.id, {
        name: addForm.name,
        issuingBody: addForm.issuingBody,
        dateObtained: addForm.dateObtained,
        expiryDate: addForm.expiryDate || undefined,
        status: addForm.status,
      });

      if (addFile) {
        const base64 = await readFileAsBase64(addFile);
        await CertificatesAPI.uploadDocument(
          created.id,
          addFile.name,
          addFile.type || 'application/octet-stream',
          base64
        );
      }

      await loadCerts();
      setAddForm(EMPTY_FORM);
      setAddFile(null);
      setShowAdd(false);
      toast.success(t('consultantTech.certifications.toasts.addSuccess'));
    } catch {
      toast.error(t('consultantTech.certifications.toasts.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ---- Edit ---------------------------------------------------------------
  const openEdit = (cert: Certification) => {
    setEditingCert(cert);
    setEditForm(certToForm(cert));
    setEditFile(null);
  };

  const closeEdit = () => {
    setEditingCert(null);
    setEditForm(EMPTY_FORM);
    setEditFile(null);
  };

  const updateCertification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCert || !editForm.name || !editForm.issuingBody || !editForm.dateObtained) {
      toast.error(t('consultantTech.certifications.toasts.addFailed'));
      return;
    }
    setSaving(true);
    try {
      await CertificatesAPI.update(editingCert.id, {
        name: editForm.name,
        issuingBody: editForm.issuingBody,
        dateObtained: editForm.dateObtained,
        expiryDate: editForm.expiryDate || undefined,
        status: editForm.status,
      });

      if (editFile) {
        const base64 = await readFileAsBase64(editFile);
        await CertificatesAPI.uploadDocument(
          editingCert.id,
          editFile.name,
          editFile.type || 'application/octet-stream',
          base64
        );
      }

      await loadCerts();
      closeEdit();
      toast.success(t('consultantTech.certifications.toasts.addSuccess'));
    } catch {
      toast.error(t('consultantTech.certifications.toasts.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  // ---- Delete -------------------------------------------------------------
  const removeCertification = async (certId: string) => {
    try {
      await CertificatesAPI.delete(certId);
      await loadCerts();
      toast.success(t('consultantTech.certifications.toasts.deleteSuccess'));
    } catch {
      toast.error(t('consultantTech.certifications.toasts.deleteFailed'));
    } finally {
      setCertPendingDelete(null);
    }
  };

  // ---- View document (inline in a new tab) --------------------------------
  const viewDocument = async (doc: CertificateDocument) => {
    try {
      const res = await fetch(`/attachments/${doc.id}`);
      if (!res.ok) throw new Error('download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // Give the browser time to load before revoking.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t('consultantTech.certifications.toasts.deleteFailed'));
    }
  };

  // ---- Shared form fields renderer ----------------------------------------
  const renderFormFields = (
    form: CertForm,
    setForm: React.Dispatch<React.SetStateAction<CertForm>>,
    file: File | null,
    setFile: React.Dispatch<React.SetStateAction<File | null>>
  ) => (
    <>
      <div>
        <Label>{t('consultantTech.certifications.dialog.certificateName')}</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder={t('consultantTech.certifications.dialog.certificateNamePlaceholder')}
        />
      </div>
      <div>
        <Label>{t('consultantTech.certifications.dialog.issuingBody')}</Label>
        <Input
          value={form.issuingBody}
          onChange={(e) => setForm({ ...form, issuingBody: e.target.value })}
          placeholder={t('consultantTech.certifications.dialog.issuingBodyPlaceholder')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{t('consultantTech.certifications.dialog.dateObtained')}</Label>
          <Input
            type="date"
            value={form.dateObtained}
            onChange={(e) => setForm({ ...form, dateObtained: e.target.value })}
          />
        </div>
        <div>
          <Label>{t('consultantTech.certifications.dialog.expiryDate')}</Label>
          <Input
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
          />
        </div>
      </div>
      <div>
        <Label>{t('consultantTech.certifications.dialog.status')}</Label>
        <Select
          value={form.status}
          onValueChange={(v) => setForm({ ...form, status: v as CertificationStatus })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="VALID">{t('consultantTech.certifications.status.VALID')}</SelectItem>
            <SelectItem value="EXPIRING_SOON">{t('consultantTech.certifications.status.EXPIRING_SOON')}</SelectItem>
            <SelectItem value="EXPIRED">{t('consultantTech.certifications.status.EXPIRED')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Document upload */}
      <div>
        <Label>{t('consultantTech.certifications.dialog.document')}</Label>
        <div className="flex items-center gap-2">
          <Input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,image/*,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="cursor-pointer"
          />
        </div>
        {file && (
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Upload className="h-3 w-3" /> {file.name}
          </p>
        )}
      </div>
    </>
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
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consultantTech.certifications.table.name')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consultantTech.certifications.table.issuingBody')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consultantTech.certifications.table.obtained')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consultantTech.certifications.table.expires')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consultantTech.certifications.table.status')}</TableHead>
                  <TableHead className="h-11 whitespace-nowrap px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('consultantTech.certifications.table.document')}</TableHead>
                  <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {certs.map((cert) => {
                  const docs = docsByCert[cert.id] ?? [];
                  return (
                    <TableRow key={cert.id}>
                      <TableCell className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-2">
                          <Award className={`h-4 w-4 ${statusIconColor[cert.status]}`} />
                          {cert.name}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">{cert.issuingBody}</TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {cert.dateObtained ? new Date(cert.dateObtained).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <Badge className={statusColor[cert.status]}>{t(`consultantTech.certifications.status.${cert.status}`)}</Badge>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm">
                        {docs.length === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {docs.map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                onClick={() => void viewDocument(doc)}
                                className="flex items-center gap-1 text-left text-primary hover:underline"
                                title={t('consultantTech.certifications.table.viewDocument')}
                              >
                                <FileText className="h-4 w-4 shrink-0" />
                                <span className="truncate max-w-[160px]">{doc.originalName || doc.fileName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={() => openEdit(cert)}
                            title={t('common.edit')}
                            aria-label={t('common.edit')}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setCertPendingDelete(cert)}
                            title={t('common.delete')}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {certs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
            {renderFormFields(addForm, setAddForm, addFile, setAddFile)}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {t('consultantTech.certifications.add')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingCert} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('common.edit')} — {editingCert?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void updateCertification(e)} className="space-y-4">
            {renderFormFields(editForm, setEditForm, editFile, setEditFile)}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeEdit}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={saving}>
                {t('common.save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={certPendingDelete !== null}
        onOpenChange={(open) => { if (!open) setCertPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('consultantTech.certifications.deleteConfirm.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('consultantTech.certifications.deleteConfirm.description', {
                name: certPendingDelete?.name ?? '',
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => certPendingDelete && void removeCertification(certPendingDelete.id)}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
