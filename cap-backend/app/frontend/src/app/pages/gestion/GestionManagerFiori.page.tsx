import { useMemo, useState } from 'react';
import { AlertTriangle, Award, BarChart3, CalendarCheck, Check, RefreshCw, Search, UserRound, Users, X } from 'lucide-react';
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
import { GestionCongesCertificatsAPI, type CertificatGcc, type DemandeConge, type EmployeGcc } from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';

type Tone = 'default' | 'secondary' | 'destructive' | 'outline';
type LeaveRow = DemandeConge & { consultantLabel: string; typeLabel: string };
type CertificateRow = CertificatGcc & { consultantLabel: string; domaineLabel: string; validite: 'VALIDE' | 'EXPIRE_BIENTOT' | 'EXPIRE' | 'SANS_EXPIRATION' };

const ALL = 'ALL';
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

export function GestionManagerFiori() {
  const queryClient = useQueryClient();
  const [leaveFilters, setLeaveFilters] = useState({ status: ALL, consultant: ALL, type: ALL, from: '', to: '', search: '' });
  const [certificateFilters, setCertificateFilters] = useState({ consultant: ALL, domaine: ALL, validite: ALL, search: '' });
  const [selectedConsultant, setSelectedConsultant] = useState<string>(ALL);

  const demandes = useQuery({ queryKey: ['gcc-manager', 'demandes'], queryFn: GestionCongesCertificatsAPI.manager.demandes });
  const consultants = useQuery({ queryKey: ['gcc-manager', 'consultants'], queryFn: GestionCongesCertificatsAPI.manager.consultants });
  const certificats = useQuery({ queryKey: ['gcc-manager', 'certificats'], queryFn: GestionCongesCertificatsAPI.manager.certificats });
  const types = useQuery({ queryKey: ['gcc-manager', 'types'], queryFn: GestionCongesCertificatsAPI.manager.typesConge });
  const domaines = useQuery({ queryKey: ['gcc-manager', 'domaines'], queryFn: GestionCongesCertificatsAPI.manager.domaines });
  const kpi = useQuery({ queryKey: ['gcc-manager', 'kpi'], queryFn: GestionCongesCertificatsAPI.manager.kpiConges });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc-manager'] });
  const approuver = useMutation({
    mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) => GestionCongesCertificatsAPI.manager.approuverDemande(id, commentaire),
    onSuccess: refresh,
  });
  const rejeter = useMutation({
    mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) => GestionCongesCertificatsAPI.manager.rejeterDemande(id, commentaire),
    onSuccess: refresh,
  });

  const consultantOptions = consultants.data ?? [];
  const typeOptions = types.data ?? [];
  const domaineOptions = domaines.data ?? [];
  const consultantById = useMemo(() => new Map(consultantOptions.map((item) => [item.ID, `${item.prenom} ${item.nom}`])), [consultantOptions]);
  const typeById = useMemo(() => new Map(typeOptions.map((item) => [item.ID, item.libelle])), [typeOptions]);
  const domaineById = useMemo(() => new Map(domaineOptions.map((item) => [item.ID, item.libelle])), [domaineOptions]);
  const isLoading = demandes.isLoading || consultants.isLoading || certificats.isLoading || types.isLoading || domaines.isLoading || kpi.isLoading;
  const error = [demandes.error, consultants.error, certificats.error, types.error, domaines.error, kpi.error, approuver.error, rejeter.error].map(messageFromError).find(Boolean);
  const actionPending = approuver.isPending || rejeter.isPending;

  const demandeRows: LeaveRow[] = (demandes.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID,
  }));
  const certificatRows: CertificateRow[] = (certificats.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID,
    validite: certificateValidity(item.dateExpiration),
  }));

  const filteredLeaves = demandeRows.filter((item) => {
    const haystack = `${item.consultantLabel} ${item.typeLabel} ${item.motif ?? ''} ${item.commentaireManager ?? ''}`.toLowerCase();
    return (leaveFilters.status === ALL || item.statut === leaveFilters.status)
      && (leaveFilters.consultant === ALL || item.consultant_ID === leaveFilters.consultant)
      && (leaveFilters.type === ALL || item.typeConge_ID === leaveFilters.type)
      && (!leaveFilters.from || item.dateFin >= leaveFilters.from)
      && (!leaveFilters.to || item.dateDebut <= leaveFilters.to)
      && (!leaveFilters.search || haystack.includes(leaveFilters.search.toLowerCase()));
  });
  const filteredCertificates = certificatRows.filter((item) => {
    const haystack = `${item.consultantLabel} ${item.domaineLabel} ${item.intitule} ${item.organisme ?? ''}`.toLowerCase();
    return (certificateFilters.consultant === ALL || item.consultant_ID === certificateFilters.consultant)
      && (certificateFilters.domaine === ALL || item.domaine_ID === certificateFilters.domaine)
      && (certificateFilters.validite === ALL || item.validite === certificateFilters.validite)
      && (!certificateFilters.search || haystack.includes(certificateFilters.search.toLowerCase()));
  });
  const selectedConsultantData = selectedConsultant === ALL ? undefined : consultantOptions.find((item) => item.ID === selectedConsultant);

  const approve = (id: string) => {
    const commentaire = window.prompt('Commentaire optionnel pour approbation', 'Approuve par le manager') ?? '';
    approuver.mutate({ id, commentaire });
  };
  const reject = (id: string) => {
    const commentaire = window.prompt('Motif obligatoire du rejet')?.trim();
    if (commentaire) rejeter.mutate({ id, commentaire });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Conges et certificats"
        subtitle="Pilotage manager des absences, decisions, KPI et competences certifiees."
        breadcrumbs={[{ label: 'Manager', path: '/manager/dashboard' }, { label: 'Conges' }]}
        actions={<Button onClick={refresh} disabled={isLoading} className="gap-2"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />Actualiser</Button>}
      />

      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard icon={AlertTriangle} label="En attente" value={kpi.data?.demandesEnAttente ?? 0} detail="a decider" />
          <MetricCard icon={CalendarCheck} label="Absences" value={kpi.data?.absencesEnCours ?? 0} detail="aujourd'hui" />
          <MetricCard icon={Users} label="Jours consommes" value={kpi.data?.joursApprouves ?? 0} detail="equipe" />
          <MetricCard icon={Check} label="Taux accord" value={`${Math.round(kpi.data?.tauxApprobation ?? 0)}%`} detail="decisions" />
          <MetricCard icon={Award} label="Certificats" value={kpi.data?.totalCertificats ?? certificatRows.length} detail={`${kpi.data?.certificatsA90Jours ?? 0} a 90j, ${kpi.data?.certificatsExpires ?? 0} expires`} />
          <MetricCard icon={BarChart3} label="Sans certificat" value={kpi.data?.consultantsSansCertificat ?? 0} detail="consultants" />
        </section>

        <Tabs defaultValue="requests" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="requests">Demandes</TabsTrigger>
            <TabsTrigger value="calendar">Calendrier</TabsTrigger>
            <TabsTrigger value="certificates">Certificats</TabsTrigger>
            <TabsTrigger value="matrix">Matrice</TabsTrigger>
            <TabsTrigger value="consultant">Fiche consultant</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            <LeaveFilters filters={leaveFilters} setFilters={setLeaveFilters} consultants={consultantOptions} types={typeOptions} />
            <LeaveTable rows={filteredLeaves} loading={isLoading} actionPending={actionPending} onApprove={approve} onReject={reject} />
          </TabsContent>
          <TabsContent value="calendar">
            <TeamCalendar rows={filteredLeaves.filter((item) => item.statut === 'APPROUVEE' || item.statut === 'SOUMISE')} loading={isLoading} />
          </TabsContent>
          <TabsContent value="certificates" className="space-y-4">
            <CertificateFilters filters={certificateFilters} setFilters={setCertificateFilters} consultants={consultantOptions} domaines={domaineOptions} />
            <CertificateTable rows={filteredCertificates} loading={isLoading} />
          </TabsContent>
          <TabsContent value="matrix">
            <SkillMatrix consultants={consultantOptions} domaines={domaineOptions} certificates={certificatRows} loading={isLoading} />
          </TabsContent>
          <TabsContent value="consultant" className="space-y-4">
            <Card className="rounded-md">
              <CardHeader className="border-b pb-4"><CardTitle>Selection consultant</CardTitle><CardDescription>Solde, historique et jours consommes.</CardDescription></CardHeader>
              <CardContent className="pt-6">
                <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
                  <SelectTrigger className="max-w-sm"><SelectValue placeholder="Choisir un consultant" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Choisir un consultant</SelectItem>
                    {consultantOptions.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.prenom} {item.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
            <ConsultantDetail consultant={selectedConsultantData} leaves={demandeRows.filter((item) => item.consultant_ID === selectedConsultant)} certificates={certificatRows.filter((item) => item.consultant_ID === selectedConsultant)} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: React.ElementType; label: string; value: string | number; detail: string }) {
  return <Card className="rounded-md"><CardContent className="flex items-center gap-4 p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm text-muted-foreground">{label}</p><p className="text-2xl font-semibold tracking-tight">{value}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div></CardContent></Card>;
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label>{label}</Label>{children}</div>;
}

function LeaveFilters({ filters, setFilters, consultants, types }: { filters: Record<string, string>; setFilters: (value: any) => void; consultants: EmployeGcc[]; types: Array<{ ID: string; libelle: string }>; }) {
  return (
    <Card className="rounded-md"><CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
      <FilterField label="Recherche"><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={filters.search} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, search: event.target.value }))} /></div></FilterField>
      <FilterField label="Statut"><Select value={filters.status} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[ALL, 'SOUMISE', 'APPROUVEE', 'REJETEE', 'ANNULEE'].map((item) => <SelectItem key={item} value={item}>{item === ALL ? 'Tous' : item}</SelectItem>)}</SelectContent></Select></FilterField>
      <FilterField label="Consultant"><Select value={filters.consultant} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, consultant: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous</SelectItem>{consultants.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.prenom} {item.nom}</SelectItem>)}</SelectContent></Select></FilterField>
      <FilterField label="Type"><Select value={filters.type} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous</SelectItem>{types.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent></Select></FilterField>
      <FilterField label="Du"><Input type="date" value={filters.from} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, from: event.target.value }))} /></FilterField>
      <FilterField label="Au"><Input type="date" value={filters.to} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, to: event.target.value }))} /></FilterField>
    </CardContent></Card>
  );
}

function CertificateFilters({ filters, setFilters, consultants, domaines }: { filters: Record<string, string>; setFilters: (value: any) => void; consultants: EmployeGcc[]; domaines: Array<{ ID: string; libelle: string }>; }) {
  return (
    <Card className="rounded-md"><CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
      <FilterField label="Recherche"><div className="relative"><Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" value={filters.search} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, search: event.target.value }))} /></div></FilterField>
      <FilterField label="Consultant"><Select value={filters.consultant} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, consultant: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous</SelectItem>{consultants.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.prenom} {item.nom}</SelectItem>)}</SelectContent></Select></FilterField>
      <FilterField label="Domaine"><Select value={filters.domaine} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, domaine: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL}>Tous</SelectItem>{domaines.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent></Select></FilterField>
      <FilterField label="Validite"><Select value={filters.validite} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, validite: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[ALL, 'VALIDE', 'EXPIRE_BIENTOT', 'EXPIRE', 'SANS_EXPIRATION'].map((item) => <SelectItem key={item} value={item}>{item === ALL ? 'Toutes' : item}</SelectItem>)}</SelectContent></Select></FilterField>
    </CardContent></Card>
  );
}

function LeaveTable({ rows, loading, actionPending, onApprove, onReject }: { rows: LeaveRow[]; loading: boolean; actionPending: boolean; onApprove: (id: string) => void; onReject: (id: string) => void; }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Demandes de l'equipe</CardTitle><CardDescription>Liste filtrable par statut, consultant, type et periode.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={CalendarCheck} title="Aucune demande" description="Aucune ligne ne correspond aux filtres." className="m-6" /> : <Table><TableHeader><TableRow><TableHead>Consultant</TableHead><TableHead>Type</TableHead><TableHead>Periode</TableHead><TableHead>Jours</TableHead><TableHead>Statut</TableHead><TableHead>Motif</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.ID} className={item.statut === 'SOUMISE' ? 'bg-secondary/20' : undefined}><TableCell className="font-medium">{item.consultantLabel}</TableCell><TableCell>{item.typeLabel}</TableCell><TableCell>{formatDate(item.dateDebut)} - {formatDate(item.dateFin)}</TableCell><TableCell>{item.nbJours}</TableCell><TableCell><Badge variant={statusTone(item.statut)}>{item.statut}</Badge></TableCell><TableCell className="max-w-[18rem] truncate text-muted-foreground">{item.motif || '-'}</TableCell><TableCell>{item.statut === 'SOUMISE' ? <div className="flex justify-end gap-2"><Button size="sm" disabled={actionPending} onClick={() => onApprove(item.ID)}><Check className="h-4 w-4" />Approuver</Button><Button size="sm" variant="destructive" disabled={actionPending} onClick={() => onReject(item.ID)}><X className="h-4 w-4" />Rejeter</Button></div> : <span className="block text-right text-muted-foreground">-</span>}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>;
}

function TeamCalendar({ rows, loading }: { rows: LeaveRow[]; loading: boolean }) {
  const grouped = rows.reduce<Record<string, LeaveRow[]>>((acc, item) => {
    const key = `${formatDate(item.dateDebut)} - ${formatDate(item.dateFin)}`;
    acc[key] = [...(acc[key] ?? []), item];
    return acc;
  }, {});
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Calendrier d'equipe</CardTitle><CardDescription>Vue des absences approuvees et en attente pour reperer les chevauchements.</CardDescription></CardHeader><CardContent className="p-4">{loading ? <SkeletonRows /> : Object.keys(grouped).length === 0 ? <EmptyState icon={CalendarCheck} title="Aucune absence" description="Aucune absence approuvee ou soumise." /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Object.entries(grouped).map(([period, items]) => <div key={period} className="rounded-md border p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="font-medium">{period}</p><Badge variant={items.length > 1 ? 'secondary' : 'outline'}>{items.length} absence(s)</Badge></div><div className="space-y-2">{items.map((item) => <div key={item.ID} className="rounded-md bg-muted/50 p-2 text-sm"><div className="flex items-center justify-between gap-2"><span>{item.consultantLabel}</span><Badge variant={statusTone(item.statut)}>{item.statut}</Badge></div><p className="text-muted-foreground">{item.typeLabel} - {item.nbJours} jour(s)</p></div>)}</div></div>)}</div>}</CardContent></Card>;
}

function CertificateTable({ rows, loading }: { rows: CertificateRow[]; loading: boolean }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Certificats de l'equipe</CardTitle><CardDescription>Filtrage par domaine, consultant, organisme et validite.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={Award} title="Aucun certificat" description="Aucun certificat ne correspond aux filtres." className="m-6" /> : <Table><TableHeader><TableRow><TableHead>Consultant</TableHead><TableHead>Certificat</TableHead><TableHead>Domaine</TableHead><TableHead>Organisme</TableHead><TableHead>Obtention</TableHead><TableHead>Expiration</TableHead><TableHead>Validite</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.ID}><TableCell className="font-medium">{item.consultantLabel}</TableCell><TableCell>{item.intitule}</TableCell><TableCell>{item.domaineLabel}</TableCell><TableCell className="text-muted-foreground">{item.organisme || '-'}</TableCell><TableCell>{formatDate(item.dateObtention)}</TableCell><TableCell>{formatDate(item.dateExpiration)}</TableCell><TableCell><Badge variant={certificateTone(item.validite)}>{item.validite}</Badge></TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>;
}

function SkillMatrix({ consultants, domaines, certificates, loading }: { consultants: EmployeGcc[]; domaines: Array<{ ID: string; libelle: string }>; certificates: CertificateRow[]; loading: boolean }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Matrice de competences</CardTitle><CardDescription>Nombre de certificats par consultant et par domaine.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <SkeletonRows /> : <Table><TableHeader><TableRow><TableHead>Consultant</TableHead>{domaines.map((domaine) => <TableHead key={domaine.ID}>{domaine.libelle}</TableHead>)}</TableRow></TableHeader><TableBody>{consultants.map((consultant) => <TableRow key={consultant.ID}><TableCell className="font-medium">{consultant.prenom} {consultant.nom}</TableCell>{domaines.map((domaine) => { const count = certificates.filter((item) => item.consultant_ID === consultant.ID && item.domaine_ID === domaine.ID).length; return <TableCell key={domaine.ID}><Badge variant={count ? 'default' : 'outline'}>{count}</Badge></TableCell>; })}</TableRow>)}</TableBody></Table>}</CardContent></Card>;
}

function ConsultantDetail({ consultant, leaves, certificates }: { consultant?: EmployeGcc; leaves: LeaveRow[]; certificates: CertificateRow[] }) {
  if (!consultant) return <EmptyState icon={UserRound} title="Aucun consultant selectionne" description="Choisissez un consultant pour consulter sa fiche." />;
  const approvedDays = leaves.filter((item) => item.statut === 'APPROUVEE').reduce((sum, item) => sum + Number(item.nbJours || 0), 0);
  return <div className="grid gap-4 xl:grid-cols-[20rem_1fr]"><Card className="rounded-md"><CardHeader><CardTitle>{consultant.prenom} {consultant.nom}</CardTitle><CardDescription>{consultant.poste ?? 'Consultant technique'}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p><span className="text-muted-foreground">Email:</span> {consultant.email}</p><p><span className="text-muted-foreground">Solde:</span> {consultant.soldeConges} jours</p><p><span className="text-muted-foreground">Jours consommes:</span> {approvedDays}</p><p><span className="text-muted-foreground">Certificats:</span> {certificates.length}</p></CardContent></Card><LeaveTable rows={leaves} loading={false} actionPending={false} onApprove={() => undefined} onReject={() => undefined} /></div>;
}

function SkeletonRows() {
  return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>;
}
