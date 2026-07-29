import { useMemo, useState } from 'react';
import { AlertTriangle, Award, BarChart3, CalendarCheck, Check, ExternalLink, RefreshCw, Search, UserRound, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { Bar, Doughnut } from 'react-chartjs-2';
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartOptions } from 'chart.js';
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
const CURRENT_YEAR = new Date().getFullYear();
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '-';
const statusTone = (status: string): Tone => status === 'APPROUVEE' ? 'default' : status === 'REJETEE' ? 'destructive' : status === 'SOUMISE' ? 'secondary' : 'outline';
const certificateTone = (validite: CertificateRow['validite']): Tone => validite === 'EXPIRE' ? 'destructive' : validite === 'EXPIRE_BIENTOT' ? 'secondary' : validite === 'VALIDE' ? 'default' : 'outline';
const daysUntil = (date?: string) => date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000) : null;
const certificateValidity = (date?: string): CertificateRow['validite'] => {
  const delta = daysUntil(date);
  if (delta === null) return 'SANS_EXPIRATION';
  if (delta < 0) return 'EXPIRE';
  if (delta <= 90) return 'EXPIRE_BIENTOT';
  return 'VALIDE';
};
const messageFromError = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

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
  const approuver = useMutation({ mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) => GestionCongesCertificatsAPI.manager.approuverDemande(id, commentaire), onSuccess: refresh });
  const rejeter = useMutation({ mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) => GestionCongesCertificatsAPI.manager.rejeterDemande(id, commentaire), onSuccess: refresh });

  const consultantOptions = consultants.data ?? [];
  const typeOptions = types.data ?? [];
  const domaineOptions = domaines.data ?? [];
  const consultantById = useMemo(() => new Map(consultantOptions.map((item) => [item.ID, `${item.prenom} ${item.nom}`])), [consultantOptions]);
  const typeById = useMemo(() => new Map(typeOptions.map((item) => [item.ID, item.libelle])), [typeOptions]);
  const domaineById = useMemo(() => new Map(domaineOptions.map((item) => [item.ID, item.libelle])), [domaineOptions]);
  const isLoading = demandes.isLoading || consultants.isLoading || certificats.isLoading || types.isLoading || domaines.isLoading || kpi.isLoading;
  const error = [demandes.error, consultants.error, certificats.error, types.error, domaines.error, kpi.error, approuver.error, rejeter.error].map(messageFromError).find(Boolean);
  const actionPending = approuver.isPending || rejeter.isPending;

  const demandeRows: LeaveRow[] = (demandes.data ?? []).map((item) => ({ ...item, consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID, typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID }));
  const certificatRows: CertificateRow[] = (certificats.data ?? []).map((item) => ({ ...item, consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID, domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID, validite: certificateValidity(item.dateExpiration) }));

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
    const haystack = `${item.consultantLabel} ${item.domaineLabel} ${item.intitule} ${item.organisme ?? ''} ${item.identifiantCertificat ?? ''}`.toLowerCase();
    return (certificateFilters.consultant === ALL || item.consultant_ID === certificateFilters.consultant)
      && (certificateFilters.domaine === ALL || item.domaine_ID === certificateFilters.domaine)
      && (certificateFilters.validite === ALL || item.validite === certificateFilters.validite)
      && (!certificateFilters.search || haystack.includes(certificateFilters.search.toLowerCase()));
  });
  const selectedConsultantData = selectedConsultant === ALL ? undefined : consultantOptions.find((item) => item.ID === selectedConsultant);

  const approve = (id: string) => {
    const commentaire = window.prompt('Commentaire optionnel pour approbation', 'Approuvé par le manager') ?? '';
    approuver.mutate({ id, commentaire });
  };
  const reject = (id: string) => {
    const commentaire = window.prompt('Motif obligatoire du rejet')?.trim();
    if (commentaire) rejeter.mutate({ id, commentaire });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Congés et certificats"
        subtitle="Pilotage des absences, décisions, indicateurs et compétences certifiées."
        breadcrumbs={[{ label: 'Manager', path: '/manager/dashboard' }, { label: 'Congés' }]}
        actions={<Button onClick={refresh} disabled={isLoading} className="gap-2"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />Actualiser</Button>}
      />
      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <MetricCard icon={AlertTriangle} label="En attente" value={kpi.data?.demandesEnAttente ?? 0} detail="à décider" />
          <MetricCard icon={CalendarCheck} label="Absences" value={kpi.data?.absencesEnCours ?? 0} detail="aujourd'hui" />
          <MetricCard icon={Users} label="Jours consommés" value={kpi.data?.joursApprouves ?? 0} detail="équipe" />
          <MetricCard icon={Check} label="Taux d'accord" value={`${Math.round(kpi.data?.tauxApprobation ?? 0)}%`} detail="décisions" />
          <MetricCard icon={Award} label="Certificats" value={kpi.data?.totalCertificats ?? certificatRows.length} detail={`${kpi.data?.certificatsA90Jours ?? 0} à 90 j, ${kpi.data?.certificatsExpires ?? 0} expirés`} />
          <MetricCard icon={BarChart3} label="Sans certificat" value={kpi.data?.consultantsSansCertificat ?? 0} detail="consultants" />
        </section>

        <KpiCharts leaves={demandeRows} certificates={certificatRows} consultants={consultantOptions} />

        <Tabs defaultValue="consultants" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="consultants">Consultants</TabsTrigger>
            <TabsTrigger value="leave">Congés</TabsTrigger>
            <TabsTrigger value="calendar">Calendrier annuel</TabsTrigger>
            <TabsTrigger value="certificates">Certificats</TabsTrigger>
          </TabsList>

          <TabsContent value="consultants" className="space-y-4">
            <ConsultantPicker consultants={consultantOptions} selectedConsultant={selectedConsultant} setSelectedConsultant={setSelectedConsultant} />
            <ConsultantProfile
              consultant={selectedConsultantData}
              leaves={demandeRows.filter((item) => item.consultant_ID === selectedConsultant)}
              certificates={certificatRows.filter((item) => item.consultant_ID === selectedConsultant)}
            />
          </TabsContent>

          <TabsContent value="leave" className="space-y-4">
            <LeaveFilters filters={leaveFilters} setFilters={setLeaveFilters} consultants={consultantOptions} types={typeOptions} />
            <LeaveTable rows={filteredLeaves} loading={isLoading} actionPending={actionPending} onApprove={approve} onReject={reject} />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4">
            <LeaveFilters filters={leaveFilters} setFilters={setLeaveFilters} consultants={consultantOptions} types={typeOptions} />
            <YearlyLeaveCalendar rows={filteredLeaves} loading={isLoading} />
          </TabsContent>

          <TabsContent value="certificates" className="space-y-4">
            <CertificateFilters filters={certificateFilters} setFilters={setCertificateFilters} consultants={consultantOptions} domaines={domaineOptions} />
            <CertificatesByConsultant consultants={consultantOptions} rows={filteredCertificates} loading={isLoading} />
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

function ConsultantPicker({ consultants, selectedConsultant, setSelectedConsultant }: { consultants: EmployeGcc[]; selectedConsultant: string; setSelectedConsultant: (value: string) => void }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Sélection du consultant</CardTitle><CardDescription>Ouvrez un profil pour consulter ses congés et tous ses certificats.</CardDescription></CardHeader><CardContent className="pt-6"><Select value={selectedConsultant} onValueChange={setSelectedConsultant}><SelectTrigger className="max-w-sm"><SelectValue placeholder="Choisir un consultant" /></SelectTrigger><SelectContent><SelectItem value={ALL}>Choisir un consultant</SelectItem>{consultants.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.prenom} {item.nom}</SelectItem>)}</SelectContent></Select></CardContent></Card>;
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
      <FilterField label="Validité"><Select value={filters.validite} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, validite: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[ALL, 'VALIDE', 'EXPIRE_BIENTOT', 'EXPIRE', 'SANS_EXPIRATION'].map((item) => <SelectItem key={item} value={item}>{item === ALL ? 'Toutes' : item}</SelectItem>)}</SelectContent></Select></FilterField>
    </CardContent></Card>
  );
}

function LeaveTable({ rows, loading, actionPending, onApprove, onReject }: { rows: LeaveRow[]; loading: boolean; actionPending: boolean; onApprove: (id: string) => void; onReject: (id: string) => void; }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Demandes de l'équipe</CardTitle><CardDescription>Chaque demande indique si le congé est approuvé, en attente, rejeté ou annulé.</CardDescription></CardHeader><CardContent className="p-0">{loading ? <SkeletonRows /> : rows.length === 0 ? <EmptyState icon={CalendarCheck} title="Aucune demande" description="Aucune ligne ne correspond aux filtres." className="m-6" /> : <Table><TableHeader><TableRow><TableHead>Consultant</TableHead><TableHead>Type</TableHead><TableHead>Période</TableHead><TableHead>Jours</TableHead><TableHead>Statut</TableHead><TableHead>Motif</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.ID} className={item.statut === 'SOUMISE' ? 'bg-secondary/20' : undefined}><TableCell className="font-medium">{item.consultantLabel}</TableCell><TableCell>{item.typeLabel}</TableCell><TableCell>{formatDate(item.dateDebut)} - {formatDate(item.dateFin)}</TableCell><TableCell>{item.nbJours}</TableCell><TableCell><Badge variant={statusTone(item.statut)}>{leaveStatusLabel(item.statut)}</Badge></TableCell><TableCell className="max-w-[18rem] truncate text-muted-foreground">{item.motif || '-'}</TableCell><TableCell>{item.statut === 'SOUMISE' ? <div className="flex justify-end gap-2"><Button size="sm" disabled={actionPending} onClick={() => onApprove(item.ID)}><Check className="h-4 w-4" />Approuver</Button><Button size="sm" variant="destructive" disabled={actionPending} onClick={() => onReject(item.ID)}><X className="h-4 w-4" />Rejeter</Button></div> : <span className="block text-right text-muted-foreground">-</span>}</TableCell></TableRow>)}</TableBody></Table>}</CardContent></Card>;
}

function YearlyLeaveCalendar({ rows, loading }: { rows: LeaveRow[]; loading: boolean }) {
  const events = rows.map((item) => ({
    id: item.ID,
    title: `${item.consultantLabel} - ${leaveStatusLabel(item.statut)}`,
    start: item.dateDebut,
    end: addOneDay(item.dateFin),
    backgroundColor: item.statut === 'APPROUVEE' ? '#16a34a' : item.statut === 'REJETEE' ? '#dc2626' : item.statut === 'ANNULEE' ? '#64748b' : '#f59e0b',
    borderColor: item.statut === 'APPROUVEE' ? '#15803d' : item.statut === 'REJETEE' ? '#b91c1c' : item.statut === 'ANNULEE' ? '#475569' : '#d97706',
    textColor: '#ffffff',
    extendedProps: { statut: leaveStatusLabel(item.statut), type: item.typeLabel, jours: item.nbJours },
  }));

  return (
    <Card className="rounded-md">
      <CardHeader className="border-b pb-4">
        <CardTitle>Calendrier annuel des congés</CardTitle>
        <CardDescription>Vue annuelle des jours sélectionnés par les employés, avec indication de validité par statut.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2 text-xs">
          <LegendPill className="bg-green-600" label="Approuvé / valide" />
          <LegendPill className="bg-amber-500" label="En attente" />
          <LegendPill className="bg-red-600" label="Rejeté / non valide" />
          <LegendPill className="bg-slate-500" label="Annulé" />
        </div>
        {loading ? <SkeletonRows /> : (
          <div className="gcc-calendar min-h-[46rem] rounded-md border bg-background p-3">
            <FullCalendar
              plugins={[dayGridPlugin as never, interactionPlugin as never]}
              initialView="dayGridMonth"
              initialDate={`${CURRENT_YEAR}-01-01`}
              locales={[frLocale as never]}
              locale="fr"
              height="auto"
              firstDay={1}
              events={events}
              selectable
              eventDisplay="block"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
              select={(selection) => window.alert(`Jours sélectionnés : ${formatDate(selection.startStr)} - ${formatDate(addPreviousDay(selection.endStr))}`)}
              eventClick={(click) => window.alert(`${click.event.title}\nType : ${click.event.extendedProps.type}\nStatut : ${click.event.extendedProps.statut}\nJours : ${click.event.extendedProps.jours}`)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LegendPill({ className, label }: { className: string; label: string }) {
  return <span className="inline-flex items-center gap-2 rounded-md border px-2 py-1"><span className={cn('h-2.5 w-2.5 rounded-sm', className)} />{label}</span>;
}

function CertificatesByConsultant({ consultants, rows, loading }: { consultants: EmployeGcc[]; rows: CertificateRow[]; loading: boolean }) {
  const consultantRows = consultants
    .map((consultant) => ({ consultant, certificates: rows.filter((item) => item.consultant_ID === consultant.ID) }))
    .filter((entry) => entry.certificates.length > 0);

  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Certifications par consultant</CardTitle><CardDescription>Chaque profil regroupe les certificats, le document, la date de validité et la date d'expiration.</CardDescription></CardHeader><CardContent className="space-y-4 p-4">{loading ? <SkeletonRows /> : consultantRows.length === 0 ? <EmptyState icon={Award} title="Aucun certificat" description="Aucun certificat ne correspond aux filtres." /> : consultantRows.map(({ consultant, certificates }) => <div key={consultant.ID} className="rounded-md border"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h3 className="font-semibold">{consultant.prenom} {consultant.nom}</h3><p className="text-sm text-muted-foreground">{consultant.poste ?? 'Consultant'} - {consultant.email}</p></div><Badge variant="outline">{certificates.length} certificat{certificates.length > 1 ? 's' : ''}</Badge></div><CertificateTable rows={certificates} /></div>)}</CardContent></Card>;
}

function CertificateTable({ rows }: { rows: CertificateRow[] }) {
  return <Table><TableHeader><TableRow><TableHead>Certification</TableHead><TableHead>Domaine</TableHead><TableHead>Document</TableHead><TableHead>Validité</TableHead><TableHead>Expiration</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.ID}><TableCell className="font-medium"><div>{item.intitule}</div><div className="text-xs text-muted-foreground">{item.organisme || '-'} {item.identifiantCertificat ? `- ${item.identifiantCertificat}` : ''}</div></TableCell><TableCell>{item.domaineLabel}</TableCell><TableCell>{item.documentUrl ? <Button size="sm" variant="outline" asChild><a href={item.documentUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Ouvrir</a></Button> : <span className="text-muted-foreground">Non fourni</span>}</TableCell><TableCell>{formatDate(item.dateObtention)}</TableCell><TableCell>{formatDate(item.dateExpiration)}</TableCell><TableCell><Badge variant={certificateTone(item.validite)}>{certificateValidityLabel(item.validite)}</Badge></TableCell></TableRow>)}</TableBody></Table>;
}

function ConsultantProfile({ consultant, leaves, certificates }: { consultant?: EmployeGcc; leaves: LeaveRow[]; certificates: CertificateRow[] }) {
  if (!consultant) return <EmptyState icon={UserRound} title="Aucun consultant sélectionné" description="Choisissez un consultant pour consulter sa fiche." />;
  const approvedDays = leaves.filter((item) => item.statut === 'APPROUVEE').reduce((sum, item) => sum + Number(item.nbJours || 0), 0);
  return <div className="grid gap-4 xl:grid-cols-[20rem_1fr]"><Card className="rounded-md"><CardHeader><CardTitle>{consultant.prenom} {consultant.nom}</CardTitle><CardDescription>{consultant.poste ?? 'Consultant technique'}</CardDescription></CardHeader><CardContent className="space-y-3 text-sm"><p><span className="text-muted-foreground">E-mail :</span> {consultant.email}</p><p><span className="text-muted-foreground">Solde :</span> {consultant.soldeConges} jours</p><p><span className="text-muted-foreground">Jours consommés :</span> {approvedDays}</p><p><span className="text-muted-foreground">Certificats :</span> {certificates.length}</p></CardContent></Card><div className="space-y-4"><Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>Certifications détenues</CardTitle><CardDescription>Documents, date de validité et expiration du consultant.</CardDescription></CardHeader><CardContent className="p-0">{certificates.length === 0 ? <EmptyState icon={Award} title="Aucun certificat" description="Ce consultant n'a pas encore de certificat." className="m-6" /> : <CertificateTable rows={certificates} />}</CardContent></Card><LeaveTable rows={leaves} loading={false} actionPending={false} onApprove={() => undefined} onReject={() => undefined} /></div></div>;
}

function KpiCharts({ leaves, certificates, consultants }: { leaves: LeaveRow[]; certificates: CertificateRow[]; consultants: EmployeGcc[] }) {
  const approved = leaves.filter((item) => item.statut === 'APPROUVEE');
  const byType = groupSum(approved, (item) => item.typeLabel, (item) => Number(item.nbJours || 0));
  const byConsultant = consultants.reduce<Record<string, number>>((acc, consultant) => {
    const label = `${consultant.prenom} ${consultant.nom}`;
    acc[label] = approved.filter((item) => item.consultant_ID === consultant.ID).reduce((sum, item) => sum + Number(item.nbJours || 0), 0);
    return acc;
  }, {});
  const byDecision = groupCount(leaves.filter((item) => item.statut === 'APPROUVEE' || item.statut === 'REJETEE'), (item) => leaveStatusLabel(item.statut));
  const certsByDomain = groupCount(certificates, (item) => item.domaineLabel);
  const certsByValidity = groupCount(certificates, (item) => certificateValidityLabel(item.validite));

  return <section className="grid gap-4 xl:grid-cols-2"><ChartCard title="Jours consommés par consultant" description="Total des jours approuvés par membre de l'équipe."><Bar data={barData(byConsultant, '#2563eb')} options={barOptions('Jours')} /></ChartCard><ChartCard title="Répartition par type de congé" description="Jours approuvés par type de congé."><Bar data={barData(byType, '#059669')} options={barOptions('Jours')} /></ChartCard><ChartCard title="Décisions du manager" description="Demandes approuvées et rejetées."><Doughnut data={doughnutData(byDecision, ['#16a34a', '#dc2626', '#f59e0b'])} options={doughnutOptions()} /></ChartCard><ChartCard title="Certificats par domaine et validité" description="Compétences et expirations."><div className="grid gap-4 md:grid-cols-2"><Doughnut data={doughnutData(certsByDomain, ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0891b2', '#64748b'])} options={doughnutOptions()} /><Doughnut data={doughnutData(certsByValidity, ['#16a34a', '#f59e0b', '#dc2626', '#64748b'])} options={doughnutOptions()} /></div></ChartCard></section>;
}

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card className="rounded-md"><CardHeader className="border-b pb-4"><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent className="h-[22rem] p-4">{children}</CardContent></Card>;
}

function addOneDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function addPreviousDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}

function leaveStatusLabel(status: string) {
  return status === 'APPROUVEE' ? 'Approuvé' : status === 'REJETEE' ? 'Rejeté' : status === 'ANNULEE' ? 'Annulé' : 'En attente';
}

function certificateValidityLabel(validite: CertificateRow['validite']) {
  return validite === 'EXPIRE' ? 'Expiré' : validite === 'EXPIRE_BIENTOT' ? 'Expire bientôt' : validite === 'SANS_EXPIRATION' ? 'Sans expiration' : 'Valide';
}

function groupCount<T>(rows: T[], getKey: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row) || 'Autre';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function groupSum<T>(rows: T[], getKey: (row: T) => string, getValue: (row: T) => number) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = getKey(row) || 'Autre';
    acc[key] = (acc[key] ?? 0) + getValue(row);
    return acc;
  }, {});
}

function barData(values: Record<string, number>, color: string) {
  const labels = Object.keys(values);
  return { labels, datasets: [{ label: 'Total', data: labels.map((label) => values[label]), backgroundColor: color, borderRadius: 4 }] };
}

function doughnutData(values: Record<string, number>, colors: string[]) {
  const labels = Object.keys(values);
  return { labels, datasets: [{ data: labels.map((label) => values[label]), backgroundColor: labels.map((_, index) => colors[index % colors.length]), borderWidth: 0 }] };
}

function barOptions(label: string): ChartOptions<'bar'> {
  return { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `${label}: ${ctx.parsed.y ?? 0}` } } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
}

function doughnutOptions(): ChartOptions<'doughnut'> {
  return { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' as const } } };
}

function SkeletonRows() {
  return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>;
}
