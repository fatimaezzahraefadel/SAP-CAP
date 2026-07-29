import { FormEvent, useMemo, useState } from 'react';
import { Award, CalendarDays, Clock3, Edit, FilePlus2, RefreshCw, Save, Search, Send, Trash2, X } from 'lucide-react';
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
import { Textarea } from '../../components/ui/textarea';
import {
  GestionCongesCertificatsAPI,
  type CertificatGcc,
  type CreateCertificatInput,
  type CreateDemandeCongeInput,
  type DemandeConge,
} from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';

type Tone = 'default' | 'secondary' | 'destructive' | 'outline';
type LeaveRow = DemandeConge & { typeLabel: string };
type CertificateRow = CertificatGcc & { domaineLabel: string; validite: 'VALIDE' | 'EXPIRE_BIENTOT' | 'EXPIRE' | 'SANS_EXPIRATION' };

const ALL = 'ALL';
const initialLeaveForm: CreateDemandeCongeInput = { typeConge_ID: '', dateDebut: '', dateFin: '', motif: '' };
const initialCertificateForm: CreateCertificatInput = { domaine_ID: '', intitule: '', organisme: '', identifiantCertificat: '', dateObtention: '', dateExpiration: '', score: '' };
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '-';
const statusTone = (status: string): Tone => status === 'APPROUVEE' ? 'default' : status === 'REJETEE' ? 'destructive' : status === 'SOUMISE' ? 'secondary' : 'outline';
const daysUntil = (date?: string) => date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000) : null;
const certificateValidity = (date?: string): CertificateRow['validite'] => {
  const delta = daysUntil(date);
  if (delta === null) return 'SANS_EXPIRATION';
  if (delta < 0) return 'EXPIRE';
  if (delta <= 90) return 'EXPIRE_BIENTOT';
  return 'VALIDE';
};
const certificateTone = (validite: CertificateRow['validite']): Tone => validite === 'EXPIRE' ? 'destructive' : validite === 'EXPIRE_BIENTOT' ? 'secondary' : validite === 'VALIDE' ? 'default' : 'outline';
const messageFromError = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';

export function GestionConsultantFiori() {
  const queryClient = useQueryClient();
  const [leaveForm, setLeaveForm] = useState<CreateDemandeCongeInput>(initialLeaveForm);
  const [certificateForm, setCertificateForm] = useState<CreateCertificatInput>(initialCertificateForm);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [editingCertificateId, setEditingCertificateId] = useState<string | null>(null);
  const [leaveFilters, setLeaveFilters] = useState({ status: ALL, type: ALL, search: '' });
  const [certificateFilters, setCertificateFilters] = useState({ domaine: ALL, validite: ALL, search: '' });

  const profil = useQuery({ queryKey: ['gcc', 'profil'], queryFn: GestionCongesCertificatsAPI.consultant.profil });
  const demandes = useQuery({ queryKey: ['gcc', 'mes-demandes'], queryFn: GestionCongesCertificatsAPI.consultant.demandes });
  const certificats = useQuery({ queryKey: ['gcc', 'mes-certificats'], queryFn: GestionCongesCertificatsAPI.consultant.certificats });
  const types = useQuery({ queryKey: ['gcc', 'types'], queryFn: GestionCongesCertificatsAPI.consultant.typesConge });
  const domaines = useQuery({ queryKey: ['gcc', 'domaines'], queryFn: GestionCongesCertificatsAPI.consultant.domaines });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc'] });
  const clearLeaveForm = () => { setLeaveForm(initialLeaveForm); setEditingLeaveId(null); };
  const clearCertificateForm = () => { setCertificateForm(initialCertificateForm); setEditingCertificateId(null); };
  const creerDemande = useMutation({ mutationFn: GestionCongesCertificatsAPI.consultant.creerDemande, onSuccess: () => { clearLeaveForm(); refresh(); } });
  const modifierDemande = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: CreateDemandeCongeInput }) => GestionCongesCertificatsAPI.consultant.modifierDemande(id, payload), onSuccess: () => { clearLeaveForm(); refresh(); } });
  const creerCertificat = useMutation({ mutationFn: GestionCongesCertificatsAPI.consultant.creerCertificat, onSuccess: () => { clearCertificateForm(); refresh(); } });
  const modifierCertificat = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: CreateCertificatInput }) => GestionCongesCertificatsAPI.consultant.modifierCertificat(id, payload), onSuccess: () => { clearCertificateForm(); refresh(); } });
  const supprimerCertificat = useMutation({ mutationFn: GestionCongesCertificatsAPI.consultant.supprimerCertificat, onSuccess: refresh });
  const annuler = useMutation({ mutationFn: GestionCongesCertificatsAPI.consultant.annulerDemande, onSuccess: refresh });

  const employe = profil.data?.[0];
  const typeOptions = types.data ?? [];
  const domaineOptions = domaines.data ?? [];
  const typeById = useMemo(() => new Map(typeOptions.map((item) => [item.ID, item.libelle])), [typeOptions]);
  const domaineById = useMemo(() => new Map(domaineOptions.map((item) => [item.ID, item.libelle])), [domaineOptions]);
  const isLoading = profil.isLoading || demandes.isLoading || certificats.isLoading || types.isLoading || domaines.isLoading;
  const error = [profil.error, demandes.error, certificats.error, types.error, domaines.error, creerDemande.error, modifierDemande.error, creerCertificat.error, modifierCertificat.error, supprimerCertificat.error, annuler.error].map(messageFromError).find(Boolean);

  const demandeRows: LeaveRow[] = (demandes.data ?? []).map((item) => ({ ...item, typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID }));
  const certificatRows: CertificateRow[] = (certificats.data ?? []).map((item) => ({ ...item, domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID, validite: certificateValidity(item.dateExpiration) }));
  const filteredLeaves = demandeRows.filter((item) => (leaveFilters.status === ALL || item.statut === leaveFilters.status)
    && (leaveFilters.type === ALL || item.typeConge_ID === leaveFilters.type)
    && (!leaveFilters.search || `${item.typeLabel} ${item.motif ?? ''} ${item.commentaireManager ?? ''}`.toLowerCase().includes(leaveFilters.search.toLowerCase())));
  const filteredCertificates = certificatRows.filter((item) => (certificateFilters.domaine === ALL || item.domaine_ID === certificateFilters.domaine)
    && (certificateFilters.validite === ALL || item.validite === certificateFilters.validite)
    && (!certificateFilters.search || `${item.domaineLabel} ${item.intitule} ${item.organisme ?? ''} ${item.identifiantCertificat ?? ''}`.toLowerCase().includes(certificateFilters.search.toLowerCase())));
  const alerts = certificatRows.filter((item) => item.validite === 'EXPIRE_BIENTOT' || item.validite === 'EXPIRE');
  const pendingCount = demandeRows.filter((item) => item.statut === 'SOUMISE').length;

  const submitLeave = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...leaveForm, motif: leaveForm.motif?.trim() || undefined };
    if (editingLeaveId) modifierDemande.mutate({ id: editingLeaveId, payload });
    else creerDemande.mutate(payload);
  };
  const submitCertificate = (event: FormEvent) => {
    event.preventDefault();
    const payload = {
      ...certificateForm,
      organisme: certificateForm.organisme?.trim() || undefined,
      identifiantCertificat: certificateForm.identifiantCertificat?.trim() || undefined,
      dateExpiration: certificateForm.dateExpiration || undefined,
      score: certificateForm.score?.trim() || undefined,
    };
    if (editingCertificateId) modifierCertificat.mutate({ id: editingCertificateId, payload });
    else creerCertificat.mutate(payload);
  };

  const editLeave = (item: LeaveRow) => {
    setEditingLeaveId(item.ID);
    setLeaveForm({ typeConge_ID: item.typeConge_ID, dateDebut: item.dateDebut, dateFin: item.dateFin, motif: item.motif ?? '' });
  };
  const editCertificate = (item: CertificateRow) => {
    setEditingCertificateId(item.ID);
    setCertificateForm({ domaine_ID: item.domaine_ID, intitule: item.intitule, organisme: item.organisme ?? '', identifiantCertificat: item.identifiantCertificat ?? '', dateObtention: item.dateObtention, dateExpiration: item.dateExpiration ?? '', score: item.score ?? '' });
  };
  const deleteCertificate = (id: string) => {
    if (window.confirm('Supprimer ce certificat ?')) supprimerCertificat.mutate(id);
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Mes congés et certificats"
        subtitle={employe ? `${employe.prenom} ${employe.nom} - ${employe.poste ?? 'Consultant technique'}` : 'Espace consultant'}
        breadcrumbs={[{ label: 'Consultant', path: '/consultant-tech/dashboard' }, { label: 'Congés' }]}
        actions={<Button onClick={refresh} disabled={isLoading} className="gap-2"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />Actualiser</Button>}
      />
      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={CalendarDays} label="Solde restant" value={employe?.soldeConges ?? '-'} detail="jours disponibles" />
          <MetricCard icon={Clock3} label="Demandes soumises" value={pendingCount} detail="en attente du manager" />
          <MetricCard icon={Award} label="Certificats" value={certificatRows.length} detail="portefeuille" />
          <MetricCard icon={FilePlus2} label="À renouveler" value={alerts.length} detail="expiré ou à 90 jours" />
        </section>

        <Tabs defaultValue="leave" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="leave">Demandes de congé</TabsTrigger>
            <TabsTrigger value="certificates">Certificats</TabsTrigger>
          </TabsList>
          <TabsContent value="leave" className="grid gap-4 xl:grid-cols-[24rem_1fr]">
            <LeaveForm form={leaveForm} setForm={setLeaveForm} types={typeOptions} editing={Boolean(editingLeaveId)} busy={creerDemande.isPending || modifierDemande.isPending} onSubmit={submitLeave} onCancel={clearLeaveForm} />
            <div className="space-y-4">
              <LeaveFilters filters={leaveFilters} setFilters={setLeaveFilters} types={typeOptions} />
              <LeaveHistory rows={filteredLeaves} loading={isLoading} actionPending={annuler.isPending} onCancel={(id) => annuler.mutate(id)} onEdit={editLeave} />
            </div>
          </TabsContent>
          <TabsContent value="certificates" className="grid gap-4 xl:grid-cols-[24rem_1fr]">
            <CertificateForm form={certificateForm} setForm={setCertificateForm} domaines={domaineOptions} editing={Boolean(editingCertificateId)} busy={creerCertificat.isPending || modifierCertificat.isPending} onSubmit={submitCertificate} onCancel={clearCertificateForm} />
            <div className="space-y-4">
              <CertificateFilters filters={certificateFilters} setFilters={setCertificateFilters} domaines={domaineOptions} />
              <CertificatePortfolio rows={filteredCertificates} loading={isLoading} busy={supprimerCertificat.isPending} onEdit={editCertificate} onDelete={deleteCertificate} />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string | number; detail: string }) {
  return <Card className="rounded-md"><CardContent className="flex items-center gap-4 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold tracking-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function LeaveForm({ form, setForm, types, editing, busy, onSubmit, onCancel }: { form: CreateDemandeCongeInput; setForm: (value: any) => void; types: Array<{ ID: string; libelle: string }>; editing: boolean; busy: boolean; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>{editing ? 'Modifier la demande' : 'Soumettre une demande'}</CardTitle><CardDescription>Les contrôles calculent la durée, le solde et les chevauchements.</CardDescription></CardHeader><CardContent className="pt-6"><form onSubmit={onSubmit} className="space-y-4"><Field label="Type de congé"><Select value={form.typeConge_ID} onValueChange={(value) => setForm((current: CreateDemandeCongeInput) => ({ ...current, typeConge_ID: value }))} required><SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger><SelectContent>{types.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent></Select></Field><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><Field label="Date de début"><Input required type="date" value={form.dateDebut} onChange={(event) => setForm((current: CreateDemandeCongeInput) => ({ ...current, dateDebut: event.target.value }))} /></Field><Field label="Date de fin"><Input required type="date" value={form.dateFin} onChange={(event) => setForm((current: CreateDemandeCongeInput) => ({ ...current, dateFin: event.target.value }))} /></Field></div><Field label="Motif"><Textarea value={form.motif} rows={3} onChange={(event) => setForm((current: CreateDemandeCongeInput) => ({ ...current, motif: event.target.value }))} /></Field><div className="flex gap-2"><Button type="submit" disabled={busy} className="flex-1 gap-2">{editing ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}{editing ? 'Enregistrer' : 'Soumettre'}</Button>{editing && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}</div></form></CardContent></Card>;
}

function CertificateForm({ form, setForm, domaines, editing, busy, onSubmit, onCancel }: { form: CreateCertificatInput; setForm: (value: any) => void; domaines: Array<{ ID: string; libelle: string }>; editing: boolean; busy: boolean; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>{editing ? 'Modifier le certificat' : 'Ajouter un certificat'}</CardTitle><CardDescription>Les certificats expirés ou à renouveler sont signalés.</CardDescription></CardHeader><CardContent className="pt-6"><form onSubmit={onSubmit} className="space-y-4"><Field label="Domaine"><Select value={form.domaine_ID} onValueChange={(value) => setForm((current: CreateCertificatInput) => ({ ...current, domaine_ID: value }))} required><SelectTrigger><SelectValue placeholder="Choisir un domaine" /></SelectTrigger><SelectContent>{domaines.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent></Select></Field><Field label="Intitulé"><Input required value={form.intitule} onChange={(event) => setForm((current: CreateCertificatInput) => ({ ...current, intitule: event.target.value }))} /></Field><Field label="Organisme"><Input value={form.organisme} onChange={(event) => setForm((current: CreateCertificatInput) => ({ ...current, organisme: event.target.value }))} /></Field><Field label="Identifiant"><Input value={form.identifiantCertificat} onChange={(event) => setForm((current: CreateCertificatInput) => ({ ...current, identifiantCertificat: event.target.value }))} /></Field><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><Field label="Date d'obtention"><Input required type="date" value={form.dateObtention} onChange={(event) => setForm((current: CreateCertificatInput) => ({ ...current, dateObtention: event.target.value }))} /></Field><Field label="Date d'expiration"><Input type="date" value={form.dateExpiration} onChange={(event) => setForm((current: CreateCertificatInput) => ({ ...current, dateExpiration: event.target.value }))} /></Field></div><Field label="Score"><Input value={form.score} onChange={(event) => setForm((current: CreateCertificatInput) => ({ ...current, score: event.target.value }))} /></Field><div className="flex gap-2"><Button type="submit" disabled={busy} className="flex-1 gap-2">{editing ? <Save className="h-4 w-4" /> : <FilePlus2 className="h-4 w-4" />}{editing ? 'Enregistrer' : 'Ajouter'}</Button>{editing && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}</div></form></CardContent></Card>;
}

function LeaveFilters({ filters, setFilters, types }: { filters: Record<string, string>; setFilters: (value: any) => void; types: Array<{ ID: string; libelle: string }> }) {
  return <Card className="rounded-md"><CardContent className="grid gap-3 p-4 md:grid-cols-3"><Field label="Recherche"><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={filters.search} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, search: event.target.value }))} /></div></Field><Field label="Statut"><Select value={filters.status} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[ALL, 'SOUMISE', 'APPROUVEE', 'REJETEE', 'ANNULEE'].map((item) => <SelectItem key={item} value={item}>{item === ALL ? 'Tous' : item}</SelectItem>)}</SelectContent></Select></Field><Field label="Type"><Select value={filters.type} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous</SelectItem>{types.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent></Select></Field></CardContent></Card>;
}

function CertificateFilters({ filters, setFilters, domaines }: { filters: Record<string, string>; setFilters: (value: any) => void; domaines: Array<{ ID: string; libelle: string }> }) {
  return <Card className="rounded-md"><CardContent className="grid gap-3 p-4 md:grid-cols-3"><Field label="Recherche"><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={filters.search} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, search: event.target.value }))} /></div></Field><Field label="Domaine"><Select value={filters.domaine} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, domaine: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous</SelectItem>{domaines.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent></Select></Field><Field label="Validité"><Select value={filters.validite} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, validite: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[ALL, 'VALIDE', 'EXPIRE_BIENTOT', 'EXPIRE', 'SANS_EXPIRATION'].map((item) => <SelectItem key={item} value={item}>{item === ALL ? 'Toutes' : item}</SelectItem>)}</SelectContent></Select></Field></CardContent></Card>;
}

function LeaveHistory({ rows, loading, actionPending, onCancel, onEdit }: { rows: LeaveRow[]; loading: boolean; actionPending: boolean; onCancel: (id: string) => void; onEdit: (row: LeaveRow) => void }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Historique des demandes</CardTitle><CardDescription>Liste filtrable avec statuts et commentaires du manager.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={CalendarDays} title="Aucune demande" description="Aucune demande ne correspond aux filtres." className="m-6" /> : <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Période</TableHead><TableHead>Jours</TableHead><TableHead>Statut</TableHead><TableHead>Commentaire</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.ID}><TableCell className="font-medium">{item.typeLabel}</TableCell><TableCell>{formatDate(item.dateDebut)} - {formatDate(item.dateFin)}</TableCell><TableCell>{item.nbJours}</TableCell><TableCell><Badge variant={statusTone(item.statut)}>{item.statut}</Badge></TableCell><TableCell className="max-w-[18rem] truncate text-muted-foreground">{item.commentaireManager || '-'}</TableCell><TableCell><div className="flex justify-end gap-2">{item.statut === 'SOUMISE' && <Button size="sm" variant="outline" onClick={() => onEdit(item)}><Edit className="h-4 w-4" />Modifier</Button>}{(item.statut === 'SOUMISE' || item.statut === 'APPROUVEE') && <Button size="sm" variant="outline" disabled={actionPending} onClick={() => onCancel(item.ID)}><X className="h-4 w-4" />Annuler</Button>}</div></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>;
}

function CertificatePortfolio({ rows, loading, busy, onEdit, onDelete }: { rows: CertificateRow[]; loading: boolean; busy: boolean; onEdit: (row: CertificateRow) => void; onDelete: (id: string) => void }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Portefeuille de certificats</CardTitle><CardDescription>Liste filtrable par domaine, triée par date d'obtention et par validité.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={Award} title="Aucun certificat" description="Aucun certificat ne correspond aux filtres." className="m-6" /> : <Table><TableHeader><TableRow><TableHead>Certificat</TableHead><TableHead>Domaine</TableHead><TableHead>Organisme</TableHead><TableHead>Obtention</TableHead><TableHead>Expiration</TableHead><TableHead>Validité</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{[...rows].sort((a, b) => b.dateObtention.localeCompare(a.dateObtention)).map((item) => <TableRow key={item.ID} className={item.validite !== 'VALIDE' && item.validite !== 'SANS_EXPIRATION' ? 'bg-secondary/20' : undefined}><TableCell className="font-medium">{item.intitule}</TableCell><TableCell>{item.domaineLabel}</TableCell><TableCell className="text-muted-foreground">{item.organisme || '-'}</TableCell><TableCell>{formatDate(item.dateObtention)}</TableCell><TableCell>{formatDate(item.dateExpiration)}</TableCell><TableCell><Badge variant={certificateTone(item.validite)}>{item.validite}</Badge></TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => onEdit(item)}><Edit className="h-4 w-4" />Modifier</Button><Button size="sm" variant="destructive" disabled={busy} onClick={() => onDelete(item.ID)}><Trash2 className="h-4 w-4" />Supprimer</Button></div></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>;
}

function SkeletonRows() {
  return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>;
}
