import { FormEvent, useMemo, useState } from 'react';
import { Award, CalendarDays, Clock3, FilePlus2, RefreshCw, Send, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import {
  GestionCongesCertificatsAPI,
  type CertificatGcc,
  type CreateCertificatInput,
  type CreateDemandeCongeInput,
  type DemandeConge,
} from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';

type BadgeTone = 'default' | 'secondary' | 'destructive' | 'outline';

const initialLeaveForm: CreateDemandeCongeInput = { typeConge_ID: '', dateDebut: '', dateFin: '', motif: '' };
const initialCertificateForm: CreateCertificatInput = {
  domaine_ID: '',
  intitule: '',
  organisme: '',
  identifiantCertificat: '',
  dateObtention: '',
  dateExpiration: '',
  score: '',
};

const statusTone = (status: string): BadgeTone => {
  if (status === 'APPROUVEE') return 'default';
  if (status === 'REJETEE') return 'destructive';
  if (status === 'SOUMISE') return 'secondary';
  return 'outline';
};

const certificateTone = (date?: string): BadgeTone => {
  if (!date) return 'outline';
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return 'destructive';
  if (diff <= 90 * 24 * 60 * 60 * 1000) return 'secondary';
  return 'default';
};

const isExpiringSoon = (date?: string) => certificateTone(date) === 'secondary';
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '-';
const messageFromError = (error: unknown) =>
  error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';

export function GestionConsultantFiori() {
  const queryClient = useQueryClient();
  const [leaveForm, setLeaveForm] = useState<CreateDemandeCongeInput>(initialLeaveForm);
  const [certificateForm, setCertificateForm] = useState<CreateCertificatInput>(initialCertificateForm);

  const profil = useQuery({ queryKey: ['gcc', 'profil'], queryFn: GestionCongesCertificatsAPI.consultant.profil });
  const demandes = useQuery({ queryKey: ['gcc', 'mes-demandes'], queryFn: GestionCongesCertificatsAPI.consultant.demandes });
  const certificats = useQuery({ queryKey: ['gcc', 'mes-certificats'], queryFn: GestionCongesCertificatsAPI.consultant.certificats });
  const types = useQuery({ queryKey: ['gcc', 'types'], queryFn: GestionCongesCertificatsAPI.consultant.typesConge });
  const domaines = useQuery({ queryKey: ['gcc', 'domaines'], queryFn: GestionCongesCertificatsAPI.consultant.domaines });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc'] });
  const creerDemande = useMutation({
    mutationFn: GestionCongesCertificatsAPI.consultant.creerDemande,
    onSuccess: () => {
      setLeaveForm(initialLeaveForm);
      refresh();
    },
  });
  const creerCertificat = useMutation({
    mutationFn: GestionCongesCertificatsAPI.consultant.creerCertificat,
    onSuccess: () => {
      setCertificateForm(initialCertificateForm);
      refresh();
    },
  });
  const annuler = useMutation({ mutationFn: GestionCongesCertificatsAPI.consultant.annulerDemande, onSuccess: refresh });

  const employe = profil.data?.[0];
  const typeOptions = types.data ?? [];
  const domaineOptions = domaines.data ?? [];
  const typeById = useMemo(() => new Map(typeOptions.map((item) => [item.ID, item.libelle])), [typeOptions]);
  const domaineById = useMemo(() => new Map(domaineOptions.map((item) => [item.ID, item.libelle])), [domaineOptions]);
  const isLoading = profil.isLoading || demandes.isLoading || certificats.isLoading || types.isLoading || domaines.isLoading;
  const loadError = [profil.error, demandes.error, certificats.error, types.error, domaines.error].map(messageFromError).find(Boolean);
  const formError = messageFromError(creerDemande.error) || messageFromError(creerCertificat.error) || messageFromError(annuler.error);

  const demandeRows = (demandes.data ?? []).map((item) => ({
    ...item,
    typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID,
  }));
  const certificatRows = (certificats.data ?? []).map((item) => ({
    ...item,
    domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID,
  }));
  const pendingCount = demandeRows.filter((item) => item.statut === 'SOUMISE').length;
  const alerts = certificatRows.filter((item) => isExpiringSoon(item.dateExpiration));

  const submitLeave = (event: FormEvent) => {
    event.preventDefault();
    creerDemande.mutate({ ...leaveForm, motif: leaveForm.motif?.trim() || undefined });
  };

  const submitCertificate = (event: FormEvent) => {
    event.preventDefault();
    creerCertificat.mutate({
      ...certificateForm,
      organisme: certificateForm.organisme?.trim() || undefined,
      identifiantCertificat: certificateForm.identifiantCertificat?.trim() || undefined,
      dateExpiration: certificateForm.dateExpiration || undefined,
      score: certificateForm.score?.trim() || undefined,
    });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Mes conges et certificats"
        subtitle={employe ? `${employe.prenom} ${employe.nom} - ${employe.poste ?? 'Consultant technique'}` : 'Espace consultant'}
        breadcrumbs={[{ label: 'Consultant', path: '/consultant-tech/dashboard' }, { label: 'Conges' }]}
        actions={
          <Button onClick={refresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {(loadError || formError) && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError || formError}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Solde restant" value={employe?.soldeConges ?? '-'} detail="jours disponibles" />
          <MetricCard icon={Clock3} label="Demandes soumises" value={pendingCount} detail="en attente manager" />
          <MetricCard icon={Award} label="Certificats" value={certificatRows.length} detail="dans mon portefeuille" />
          <MetricCard icon={FilePlus2} label="A renouveler" value={alerts.length} detail="expiration sous 90 jours" />
        </section>

        <Tabs defaultValue="leave" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="leave">Demandes de conge</TabsTrigger>
            <TabsTrigger value="certificates">Certificats</TabsTrigger>
          </TabsList>

          <TabsContent value="leave" className="grid gap-4 xl:grid-cols-[24rem_1fr]">
            <Card className="rounded-md">
              <CardHeader className="border-b pb-4">
                <CardTitle>Soumettre une demande</CardTitle>
                <CardDescription>La duree et les controles sont verifies par le backend CAP.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={submitLeave} className="space-y-4">
                  <Field label="Type de conge">
                    <Select value={leaveForm.typeConge_ID} onValueChange={(value) => setLeaveForm((current) => ({ ...current, typeConge_ID: value }))} required>
                      <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
                      <SelectContent>{typeOptions.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Date debut">
                      <Input required type="date" value={leaveForm.dateDebut} onChange={(event) => setLeaveForm((current) => ({ ...current, dateDebut: event.target.value }))} />
                    </Field>
                    <Field label="Date fin">
                      <Input required type="date" value={leaveForm.dateFin} onChange={(event) => setLeaveForm((current) => ({ ...current, dateFin: event.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Motif">
                    <Input value={leaveForm.motif} placeholder="Ex. rendez-vous personnel" onChange={(event) => setLeaveForm((current) => ({ ...current, motif: event.target.value }))} />
                  </Field>
                  <Button type="submit" disabled={creerDemande.isPending} className="w-full gap-2">
                    <Send className="h-4 w-4" />
                    Soumettre
                  </Button>
                </form>
              </CardContent>
            </Card>
            <LeaveHistory rows={demandeRows} loading={isLoading} actionPending={annuler.isPending} onCancel={(id) => annuler.mutate(id)} />
          </TabsContent>

          <TabsContent value="certificates" className="grid gap-4 xl:grid-cols-[24rem_1fr]">
            <Card className="rounded-md">
              <CardHeader className="border-b pb-4">
                <CardTitle>Ajouter un certificat</CardTitle>
                <CardDescription>Declaration visible ensuite par le manager.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <form onSubmit={submitCertificate} className="space-y-4">
                  <Field label="Domaine">
                    <Select value={certificateForm.domaine_ID} onValueChange={(value) => setCertificateForm((current) => ({ ...current, domaine_ID: value }))} required>
                      <SelectTrigger><SelectValue placeholder="Choisir un domaine" /></SelectTrigger>
                      <SelectContent>{domaineOptions.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Intitule">
                    <Input required value={certificateForm.intitule} onChange={(event) => setCertificateForm((current) => ({ ...current, intitule: event.target.value }))} />
                  </Field>
                  <Field label="Organisme">
                    <Input value={certificateForm.organisme} onChange={(event) => setCertificateForm((current) => ({ ...current, organisme: event.target.value }))} />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Obtention">
                      <Input required type="date" value={certificateForm.dateObtention} onChange={(event) => setCertificateForm((current) => ({ ...current, dateObtention: event.target.value }))} />
                    </Field>
                    <Field label="Expiration">
                      <Input type="date" value={certificateForm.dateExpiration} onChange={(event) => setCertificateForm((current) => ({ ...current, dateExpiration: event.target.value }))} />
                    </Field>
                  </div>
                  <Field label="Score">
                    <Input value={certificateForm.score} onChange={(event) => setCertificateForm((current) => ({ ...current, score: event.target.value }))} />
                  </Field>
                  <Button type="submit" disabled={creerCertificat.isPending} className="w-full gap-2">
                    <FilePlus2 className="h-4 w-4" />
                    Ajouter
                  </Button>
                </form>
              </CardContent>
            </Card>
            <CertificatePortfolio rows={certificatRows} loading={isLoading} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string | number; detail: string }) {
  return (
    <Card className="rounded-md">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function LeaveHistory({ rows, loading, actionPending, onCancel }: { rows: Array<DemandeConge & { typeLabel: string }>; loading: boolean; actionPending: boolean; onCancel: (id: string) => void }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b pb-4">
        <CardTitle>Historique des demandes</CardTitle>
        <CardDescription>Suivi des statuts et commentaires manager.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <SkeletonRows /> : rows.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucune demande" description="Soumets ta premiere demande depuis le formulaire." className="m-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.ID}>
                  <TableCell className="font-medium">{item.typeLabel}</TableCell>
                  <TableCell>{formatDate(item.dateDebut)} - {formatDate(item.dateFin)}</TableCell>
                  <TableCell>{item.nbJours}</TableCell>
                  <TableCell><Badge variant={statusTone(item.statut)}>{item.statut}</Badge></TableCell>
                  <TableCell className="max-w-[18rem] truncate text-muted-foreground">{item.commentaireManager || '-'}</TableCell>
                  <TableCell>
                    {(item.statut === 'SOUMISE' || item.statut === 'APPROUVEE') ? (
                      <div className="flex justify-end">
                        <Button size="sm" variant="outline" disabled={actionPending} onClick={() => onCancel(item.ID)}><X className="h-4 w-4" />Annuler</Button>
                      </div>
                    ) : <span className="block text-right text-muted-foreground">-</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CertificatePortfolio({ rows, loading }: { rows: Array<CertificatGcc & { domaineLabel: string }>; loading: boolean }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b pb-4">
        <CardTitle>Portefeuille certificats</CardTitle>
        <CardDescription>Les expirations proches ou depassees sont visibles dans la colonne expiration.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <SkeletonRows /> : rows.length === 0 ? (
          <EmptyState icon={Award} title="Aucun certificat" description="Ajoute tes certifications SAP, cloud ou techniques." className="m-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificat</TableHead>
                <TableHead>Domaine</TableHead>
                <TableHead>Organisme</TableHead>
                <TableHead>Obtention</TableHead>
                <TableHead>Expiration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.ID}>
                  <TableCell className="font-medium">{item.intitule}</TableCell>
                  <TableCell>{item.domaineLabel}</TableCell>
                  <TableCell className="text-muted-foreground">{item.organisme || '-'}</TableCell>
                  <TableCell>{formatDate(item.dateObtention)}</TableCell>
                  <TableCell><Badge variant={certificateTone(item.dateExpiration)}>{item.dateExpiration ? formatDate(item.dateExpiration) : 'Aucune'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-3 p-6">
      {[0, 1, 2].map((item) => <div key={item} className="h-10 animate-pulse rounded-md bg-muted" />)}
    </div>
  );
}
