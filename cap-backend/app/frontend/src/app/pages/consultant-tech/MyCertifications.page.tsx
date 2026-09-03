import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { Award, AlertTriangle, Download, Eye, FileText, FilePlus2, RefreshCw, Trash2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '../../components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '../../components/ui/table';
import {
  GestionCongesCertificatsAPI,
  type CertificatGcc,
  type CreateCertificatInput,
} from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';
import { EmptyState } from '../../components/common/EmptyState';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { useAuth } from '../../context/AuthContext';

type Validite = 'VALIDE' | 'EXPIRE_BIENTOT' | 'EXPIRE' | 'SANS_EXPIRATION';

const daysUntil = (date?: string) =>
  date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000) : null;

const getValidite = (date?: string): Validite => {
  const delta = daysUntil(date);
  if (delta === null) return 'SANS_EXPIRATION';
  if (delta < 0) return 'EXPIRE';
  if (delta <= 90) return 'EXPIRE_BIENTOT';
  return 'VALIDE';
};

const validiteBadgeClass = (v: Validite) => {
  if (v === 'VALIDE') return 'border-[var(--status-approved-border)] bg-[var(--status-approved-bg)] text-[var(--status-approved-text)]';
  if (v === 'EXPIRE') return 'border-[var(--status-rejected-border)] bg-[var(--status-rejected-bg)] text-[var(--status-rejected-text)]';
  if (v === 'EXPIRE_BIENTOT') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
  return 'bg-muted text-muted-foreground';
};

const validiteLabel = (v: Validite) => {
  if (v === 'VALIDE') return 'Valide';
  if (v === 'EXPIRE') return 'Expiré';
  if (v === 'EXPIRE_BIENTOT') return 'Expire bientôt';
  return 'Sans expiration';
};

const formatDate = (d?: string) => d ? new Intl.DateTimeFormat('fr-FR').format(new Date(d)) : '-';

const initialForm: CreateCertificatInput = {
  domaine_ID: '', intitule: '', organisme: '',
  identifiantCertificat: '', dateObtention: '', dateExpiration: '', score: '',
};

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const MyCertifications: React.FC = () => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<CreateCertificatInput>(initialForm);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDataUrl, setPdfDataUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [certToDelete, setCertToDelete] = useState<CertificatGcc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const certificats = useQuery({
    queryKey: ['gcc', 'mes-certificats'],
    queryFn: GestionCongesCertificatsAPI.consultant.certificats,
  });
  const domaines = useQuery({
    queryKey: ['gcc', 'domaines'],
    queryFn: GestionCongesCertificatsAPI.consultant.domaines,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc'] });

  const creerCertificat = useMutation({
    mutationFn: GestionCongesCertificatsAPI.consultant.creerCertificat,
    onSuccess: async (createdCert) => {
      refresh();
      setShowAdd(false);
      setForm(initialForm);
      setPdfFile(null);
      setPdfDataUrl('');
      toast.success('Certification ajoutée avec succès');

      // Notify the manager if setting is enabled
      try {
        const appSettings = JSON.parse(localStorage.getItem('appSettings') ?? '{}') as Record<string, unknown>;
        const notifEnabled = appSettings.certificationNotif !== false; // enabled by default
        if (notifEnabled && currentUser) {
          const allUsers = await UsersAPI.getAll();
          const manager = allUsers.find((u) => u.role === 'MANAGER' && u.active);
          if (manager) {
            await NotificationsAPI.create({
              userId: manager.id,
              type: 'CERTIFICATION_ADDED',
              title: 'Nouvelle certification ajoutée',
              message: `${currentUser.name} a ajouté la certification "${createdCert.intitule}"${createdCert.organisme ? ` (${createdCert.organisme})` : ''}.`,
              targetPath: '/manager/certificates',
              read: false,
            });
          }
        }
      } catch {
        // Notification failure should not block the main action
      }
    },
    onError: () => toast.error('Échec de l\'ajout de la certification'),
  });

  const supprimerCertificat = useMutation({
    mutationFn: GestionCongesCertificatsAPI.consultant.supprimerCertificat,
    onSuccess: () => { refresh(); toast.success('Certification supprimée'); },
    onError: () => toast.error('Échec de la suppression'),
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { toast.error('Veuillez sélectionner un fichier PDF'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Le fichier ne doit pas dépasser 5 Mo'); return; }
    const dataUrl = await fileToDataUrl(file);
    setPdfFile(file);
    setPdfDataUrl(dataUrl);
    toast.success(`Fichier "${file.name}" chargé`);
  };

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.domaine_ID || !form.intitule || !form.dateObtention) {
      toast.error('Le domaine, l\'intitulé et la date d\'obtention sont requis');
      return;
    }
    creerCertificat.mutate({
      ...form,
      organisme: form.organisme?.trim() || undefined,
      identifiantCertificat: form.identifiantCertificat?.trim() || undefined,
      dateExpiration: form.dateExpiration || undefined,
      score: form.score?.trim() || undefined,
      ...(pdfDataUrl ? { documentUrl: pdfDataUrl } : {}),
    } as CreateCertificatInput & { documentUrl?: string });
  };

  const rows = certificats.data ?? [];
  const domaineOptions = domaines.data ?? [];
  const domaineById = new Map(domaineOptions.map((d) => [d.ID, d.libelle]));

  const total = rows.length;
  const valides = rows.filter((r) => getValidite(r.dateExpiration) === 'VALIDE' || getValidite(r.dateExpiration) === 'SANS_EXPIRATION').length;
  const expires = rows.filter((r) => getValidite(r.dateExpiration) === 'EXPIRE').length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="Mes Certifications"
        subtitle="Gérez vos certifications et réalisations professionnelles"
        breadcrumbs={[
          { label: 'Accueil', path: '/consultant-tech/leave' },
          { label: 'Mes certificats' },
        ]}
        actions={
          <Button onClick={refresh} variant="outline" size="sm" disabled={certificats.isLoading} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', certificats.isLoading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-primary">{total}</div>
            <div className="text-xs text-muted-foreground">Total des Certifications</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-primary">{valides}</div>
            <div className="text-xs text-muted-foreground">Valides</div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-destructive">{expires}</div>
            <div className="text-xs text-muted-foreground">Expirées</div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setShowAdd(true)}>
            <FilePlus2 className="mr-1 h-4 w-4" /> Ajouter une certification
          </Button>
        </div>

        {certificats.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-4">Nom de la Certification</TableHead>
                    <TableHead className="px-4">Domaine</TableHead>
                    <TableHead className="px-4">Organisme</TableHead>
                    <TableHead className="px-4">Obtenue</TableHead>
                    <TableHead className="px-4">Expire</TableHead>
                    <TableHead className="px-4">Statut</TableHead>
                    <TableHead className="px-4">Document PDF</TableHead>
                    <TableHead className="px-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8}>
                        <EmptyState icon={Award} title="Aucune certification enregistrée." description="Cliquez sur «Ajouter une certification» pour commencer." className="m-6" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((cert) => {
                      const v = getValidite(cert.dateExpiration);
                      const docUrl = (cert as CertificatGcc & { documentUrl?: string }).documentUrl;
                      return (
                        <TableRow key={cert.ID}>
                          <TableCell className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2">
                              <Award className="h-4 w-4 text-primary" />
                              {cert.intitule}
                            </div>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-sm">{domaineById.get(cert.domaine_ID) ?? cert.domaine_ID}</TableCell>
                          <TableCell className="px-4 py-3 text-sm text-muted-foreground">{cert.organisme || '-'}</TableCell>
                          <TableCell className="px-4 py-3 text-sm">{formatDate(cert.dateObtention)}</TableCell>
                          <TableCell className="px-4 py-3 text-sm">{formatDate(cert.dateExpiration)}</TableCell>
                          <TableCell className="px-4 py-3">
                            <Badge className={validiteBadgeClass(v)}>{validiteLabel(v)}</Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            {docUrl ? (
                              <div className="flex items-center gap-1">
                                <Badge variant="outline" className="gap-1 text-xs text-primary border-primary/30">
                                  <FileText className="h-3 w-3" /> PDF
                                </Badge>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewUrl(docUrl)} title="Aperçu">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                                  const a = document.createElement('a');
                                  a.href = docUrl;
                                  a.download = `${cert.intitule.replace(/[^a-z0-9]/gi, '_')}.pdf`;
                                  a.click();
                                }} title="Télécharger">
                                  <Download className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">Aucun</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={supprimerCertificat.isPending}
                              onClick={() => setCertToDelete(cert)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
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
        )}
      </div>

      {/* Dialog ajouter */}
      <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setForm(initialForm); setPdfFile(null); setPdfDataUrl(''); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une certification</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitAdd} className="space-y-4">
            <div>
              <Label>Domaine *</Label>
              <Select value={form.domaine_ID} onValueChange={(v) => setForm((p) => ({ ...p, domaine_ID: v }))} required>
                <SelectTrigger><SelectValue placeholder="Choisir un domaine" /></SelectTrigger>
                <SelectContent>
                  {domaineOptions.map((d) => (
                    <SelectItem key={d.ID} value={d.ID}>{d.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom de la certification *</Label>
              <Input
                value={form.intitule}
                onChange={(e) => setForm((p) => ({ ...p, intitule: e.target.value }))}
                placeholder="ex. SAP CAP Developer"
                required
              />
            </div>
            <div>
              <Label>Organisme émetteur</Label>
              <Input
                value={form.organisme}
                onChange={(e) => setForm((p) => ({ ...p, organisme: e.target.value }))}
                placeholder="ex. SAP, Amazon..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date d'obtention *</Label>
                <Input type="date" value={form.dateObtention} onChange={(e) => setForm((p) => ({ ...p, dateObtention: e.target.value }))} required />
              </div>
              <div>
                <Label>Date d'expiration</Label>
                <Input type="date" value={form.dateExpiration} onChange={(e) => setForm((p) => ({ ...p, dateExpiration: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Score (optionnel)</Label>
              <Input value={form.score} onChange={(e) => setForm((p) => ({ ...p, score: e.target.value }))} placeholder="ex. 92/100" />
            </div>

            {/* Upload PDF */}
            <div>
              <Label>Document PDF (optionnel)</Label>
              <div
                className="mt-1.5 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {pdfFile ? (
                  <div className="flex items-center gap-2 text-sm text-primary">
                    <FileText className="h-5 w-5" />
                    <span className="font-medium">{pdfFile.name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setPdfFile(null); setPdfDataUrl(''); }} className="ml-1 text-muted-foreground hover:text-destructive">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground text-center">
                      Cliquez pour sélectionner un PDF<br />
                      <span className="text-xs">Max 5 Mo</span>
                    </p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => void handleFileChange(e)} />
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setShowAdd(false); setForm(initialForm); setPdfFile(null); setPdfDataUrl(''); }}>
                Annuler
              </Button>
              <Button type="submit" disabled={creerCertificat.isPending}>
                {creerCertificat.isPending ? 'Ajout...' : 'Ajouter'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Aperçu PDF */}
      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Aperçu du certificat
            </DialogTitle>
          </DialogHeader>
          {previewUrl && <iframe src={previewUrl} className="w-full h-full border-0" title="Aperçu PDF" />}
        </DialogContent>
      </Dialog>

      {/* Confirmation Suppression */}
      <Dialog open={certToDelete !== null} onOpenChange={(o) => !o && setCertToDelete(null)}>
        <DialogContent className="max-w-md p-6 sm:rounded-2xl border bg-background/95 backdrop-blur-md shadow-2xl">
          {certToDelete && (
            <div className="space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-base font-bold">Supprimer la certification</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Êtes-vous sûr de vouloir supprimer cette certification ? Cette action est irréversible.
                  </DialogDescription>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground">{certToDelete.intitule}</div>
                {certToDelete.organisme && (
                  <div className="text-muted-foreground">{certToDelete.organisme}</div>
                )}
              </div>

              <DialogFooter className="gap-2 sm:gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCertToDelete(null)}
                  disabled={supprimerCertificat.isPending}
                  className="rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    supprimerCertificat.mutate(certToDelete.ID, {
                      onSuccess: () => setCertToDelete(null),
                    });
                  }}
                  disabled={supprimerCertificat.isPending}
                  className="rounded-xl font-medium shadow-md"
                >
                  {supprimerCertificat.isPending ? (
                    <RefreshCw className="h-4 w-4 animate-spin mr-1.5" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1.5" />
                  )}
                  Supprimer
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
