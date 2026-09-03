import { FormEvent, useMemo, useState } from 'react';
import { CalendarDays, Clock3, Edit, FilePlus2, RefreshCw, Save, Search, Send, X } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  GestionCongesCertificatsAPI,
  type CreateDemandeCongeInput,
  type DemandeConge,
} from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';
import { NotificationsAPI } from '../../services/odata/notificationsApi';
import { UsersAPI } from '../../services/odata/usersApi';

type LeaveRow = DemandeConge & { typeLabel: string };

const ALL = 'ALL';
const initialLeaveForm: CreateDemandeCongeInput = { typeConge_ID: '', dateDebut: '', dateFin: '', motif: '' };
const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '-';

const statusBadgeClass = (status: string): string => {
  const base = 'border font-medium inline-flex items-center rounded-full px-2.5 py-0.5 text-xs';
  switch (status) {
    case 'APPROUVEE':
      return `${base} border-[var(--status-approved-border)] bg-[var(--status-approved-bg)] text-[var(--status-approved-text)]`;
    case 'REJETEE':
      return `${base} border-[var(--status-rejected-border)] bg-[var(--status-rejected-bg)] text-[var(--status-rejected-text)]`;
    case 'SOUMISE':
      return `${base} border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]`;
    default:
      return `${base} border-border bg-muted text-muted-foreground`;
  }
};

const statusLabel = (statut: string) => {
  if (statut === 'APPROUVEE') return 'Approuvé';
  if (statut === 'REJETEE') return 'Rejeté';
  if (statut === 'ANNULEE') return 'Annulé';
  return 'En attente';
};

const messageFromError = (error: unknown) => error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';

export function GestionConsultantFiori() {
  const queryClient = useQueryClient();
  const [leaveForm, setLeaveForm] = useState<CreateDemandeCongeInput>(initialLeaveForm);
  const [editingLeaveId, setEditingLeaveId] = useState<string | null>(null);
  const [leaveFilters, setLeaveFilters] = useState({ status: ALL, type: ALL, search: '' });
  const [activeTab, setActiveTab] = useState<'leave' | 'calendar'>('leave');

  const profil = useQuery({ queryKey: ['gcc', 'profil'], queryFn: GestionCongesCertificatsAPI.consultant.profil });
  const demandes = useQuery({ queryKey: ['gcc', 'mes-demandes'], queryFn: GestionCongesCertificatsAPI.consultant.demandes });
  const types = useQuery({ queryKey: ['gcc', 'types'], queryFn: GestionCongesCertificatsAPI.consultant.typesConge });

  const employe = profil.data?.[0];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc'] });
  const clearLeaveForm = () => { setLeaveForm(initialLeaveForm); setEditingLeaveId(null); };
  const creerDemande = useMutation({
    mutationFn: GestionCongesCertificatsAPI.consultant.creerDemande,
    onSuccess: async (_, variables) => {
      clearLeaveForm();
      refresh();
      try {
        const appSettings = JSON.parse(localStorage.getItem('appSettings') ?? '{}') as Record<string, unknown>;
        const notifEnabled = appSettings.leaveRequestNotif !== false;
        if (notifEnabled) {
          const allUsers = await UsersAPI.getAll();
          const manager = allUsers.find((u) => u.role === 'MANAGER' && u.active);
          if (manager) {
            const userName = employe ? `${employe.prenom} ${employe.nom}` : "Un consultant";
            const dateDebutStr = variables.dateDebut ? new Date(variables.dateDebut).toLocaleDateString('fr-FR') : '';
            const dateFinStr = variables.dateFin ? new Date(variables.dateFin).toLocaleDateString('fr-FR') : '';
            await NotificationsAPI.create({
              userId: manager.id,
              type: 'LEAVE_REQUEST',
              title: 'Nouvelle demande de congé',
              message: `${userName} a soumis une demande de congé du ${dateDebutStr} au ${dateFinStr}.`,
              targetPath: '/manager/leave',
              read: false,
            });
          }
        }
      } catch (err) {
        console.error("Failed to notify manager:", err);
      }
    }
  });
  const modifierDemande = useMutation({ mutationFn: ({ id, payload }: { id: string; payload: CreateDemandeCongeInput }) => GestionCongesCertificatsAPI.consultant.modifierDemande(id, payload), onSuccess: () => { clearLeaveForm(); refresh(); } });
  const annuler = useMutation({ mutationFn: GestionCongesCertificatsAPI.consultant.annulerDemande, onSuccess: refresh });

  const typeOptions = types.data ?? [];
  const typeById = useMemo(() => new Map(typeOptions.map((item) => [item.ID, item.libelle])), [typeOptions]);
  const isLoading = profil.isLoading || demandes.isLoading || types.isLoading;
  const error = [profil.error, demandes.error, types.error, creerDemande.error, modifierDemande.error, annuler.error].map(messageFromError).find(Boolean);

  const demandeRows: LeaveRow[] = (demandes.data ?? []).map((item) => ({ ...item, typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID }));
  const filteredLeaves = demandeRows.filter((item) => (leaveFilters.status === ALL || item.statut === leaveFilters.status)
    && (leaveFilters.type === ALL || item.typeConge_ID === leaveFilters.type)
    && (!leaveFilters.search || `${item.typeLabel} ${item.motif ?? ''} ${item.commentaireManager ?? ''}`.toLowerCase().includes(leaveFilters.search.toLowerCase())));

  const pendingCount = demandeRows.filter((item) => item.statut === 'SOUMISE').length;
  const approvedCount = demandeRows.filter((item) => item.statut === 'APPROUVEE').length;
  const totalJoursPris = demandeRows.reduce((sum, item) => sum + (Number(item.nbJours) || 0), 0);

  const submitLeave = (event: FormEvent) => {
    event.preventDefault();
    const payload = { ...leaveForm, motif: leaveForm.motif?.trim() || undefined };
    if (editingLeaveId) modifierDemande.mutate({ id: editingLeaveId, payload });
    else creerDemande.mutate(payload);
  };

  const editLeave = (item: LeaveRow) => {
    setEditingLeaveId(item.ID);
    setLeaveForm({ typeConge_ID: item.typeConge_ID, dateDebut: item.dateDebut, dateFin: item.dateFin, motif: item.motif ?? '' });
  };

  return (
    <div className="min-w-0">
      <PageHeader
        title="Mes congés"
        subtitle={employe ? `${employe.prenom} ${employe.nom} - ${employe.poste ?? 'Consultant technique'}` : 'Espace consultant'}
        breadcrumbs={[{ label: 'Consultant', path: '/consultant-tech/dashboard' }, { label: 'Mes congés' }]}
        actions={<Button onClick={refresh} disabled={isLoading} className="gap-2"><RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />Actualiser</Button>}
      />
      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard tone="info" icon={CalendarDays} label="Solde restant" value={employe?.soldeConges ?? '-'} detail="jours disponibles" />
          <MetricCard tone="warning" icon={Clock3} label="Demandes soumises" value={pendingCount} detail="en attente du manager" />
          <MetricCard tone="success" icon={CalendarDays} label="Congés approuvés" value={approvedCount} detail="demandes acceptées" />
          <MetricCard tone="default" icon={FilePlus2} label="Jours pris" value={totalJoursPris} detail="cumul de l'année" />
        </section>

        <div className="space-y-4">
          <nav className="flex gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab('leave')}
              className={cn(
                'px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px',
                activeTab === 'leave'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Demandes de congé
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={cn(
                'px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px',
                activeTab === 'calendar'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              Mon calendrier
            </button>
          </nav>
          {activeTab === 'leave' ? (
            <div className="grid gap-4 xl:grid-cols-[24rem_1fr]">
              <LeaveForm form={leaveForm} setForm={setLeaveForm} types={typeOptions} editing={Boolean(editingLeaveId)} busy={creerDemande.isPending || modifierDemande.isPending} onSubmit={submitLeave} onCancel={clearLeaveForm} />
              <div className="space-y-4">
                <LeaveFilters filters={leaveFilters} setFilters={setLeaveFilters} types={typeOptions} />
                <LeaveHistory rows={filteredLeaves} loading={isLoading} actionPending={annuler.isPending} onCancel={(id) => annuler.mutate(id)} onEdit={editLeave} />
              </div>
            </div>
          ) : (
            <MyLeaveCalendar rows={demandeRows} loading={isLoading} />
          )}
        </div>
      </main>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, detail, tone = 'default',
}: {
  icon: React.ElementType; label: string; value: string | number; detail: string; tone?: 'default' | 'success' | 'warning' | 'info' | 'destructive';
}) {
  const toneMap = {
    default:     { bar: 'bg-border',            box: 'bg-muted text-muted-foreground' },
    success:     { bar: 'bg-success',           box: 'bg-success/10 text-success' },
    warning:     { bar: 'bg-warning',           box: 'bg-warning/10 text-warning' },
    info:        { bar: 'bg-info',              box: 'bg-info/10 text-info' },
    destructive: { bar: 'bg-destructive',       box: 'bg-destructive/10 text-destructive' },
  } as const;
  const t = toneMap[tone];
  return (
    <Card className="rounded-md border border-border bg-card hover:border-primary/30 transition-colors">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', t.box)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}

function LeaveForm({ form, setForm, types, editing, busy, onSubmit, onCancel }: { form: CreateDemandeCongeInput; setForm: (value: any) => void; types: Array<{ ID: string; libelle: string }>; editing: boolean; busy: boolean; onSubmit: (event: FormEvent) => void; onCancel: () => void }) {
  return (
    <Card className="rounded-md border-border">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base font-semibold">{editing ? 'Modifier la demande' : 'Soumettre une demande'}</CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Type de congé">
            <Select value={form.typeConge_ID} onValueChange={(value) => setForm((current: CreateDemandeCongeInput) => ({ ...current, typeConge_ID: value }))} required>
              <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
              <SelectContent>{types.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Field label="Date de début">
              <Input required type="date" value={form.dateDebut} onChange={(event) => setForm((current: CreateDemandeCongeInput) => ({ ...current, dateDebut: event.target.value }))} />
            </Field>
            <Field label="Date de fin">
              <Input required type="date" value={form.dateFin} onChange={(event) => setForm((current: CreateDemandeCongeInput) => ({ ...current, dateFin: event.target.value }))} />
            </Field>
          </div>
          <Field label="Motif">
            <Textarea value={form.motif} rows={3} onChange={(event) => setForm((current: CreateDemandeCongeInput) => ({ ...current, motif: event.target.value }))} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy} className="flex-1 gap-2">
              {editing ? <Save className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {editing ? 'Enregistrer' : 'Soumettre'}
            </Button>
            {editing && <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LeaveFilters({ filters, setFilters, types }: { filters: Record<string, string>; setFilters: (value: any) => void; types: Array<{ ID: string; libelle: string }> }) {
  return (
    <Card className="rounded-md border-border">
      <CardContent className="grid gap-3 p-4 md:grid-cols-3">
        <Field label="Recherche">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" value={filters.search} onChange={(event) => setFilters((current: typeof filters) => ({ ...current, search: event.target.value }))} />
          </div>
        </Field>
        <Field label="Statut">
          <Select value={filters.status} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, status: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{[ALL, 'SOUMISE', 'APPROUVEE', 'REJETEE', 'ANNULEE'].map((item) => <SelectItem key={item} value={item}>{item === ALL ? 'Tous' : item}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Type">
          <Select value={filters.type} onValueChange={(value) => setFilters((current: typeof filters) => ({ ...current, type: value }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {types.map((item) => <SelectItem key={item.ID} value={item.ID}>{item.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </CardContent>
    </Card>
  );
}

function LeaveHistory({ rows, loading, actionPending, onCancel, onEdit }: { rows: LeaveRow[]; loading: boolean; actionPending: boolean; onCancel: (id: string) => void; onEdit: (row: LeaveRow) => void }) {
  return (
    <Card className="rounded-md border-border">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle className="text-base font-semibold">Historique des demandes</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? <SkeletonRows /> : rows.length === 0 ? (
          <EmptyState icon={CalendarDays} title="Aucune demande" description="Aucune demande ne correspond aux filtres." className="m-6" />
        ) : (
          <Table>
            <TableHeader className="bg-surface-2">
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Période</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Commentaire</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.ID}>
                  <TableCell className="font-medium">{item.typeLabel}</TableCell>
                  <TableCell>{formatDate(item.dateDebut)} - {formatDate(item.dateFin)}</TableCell>
                  <TableCell>{item.nbJours}</TableCell>
                  <TableCell><span className={statusBadgeClass(item.statut)}>{statusLabel(item.statut)}</span></TableCell>
                  <TableCell className="max-w-[18rem] truncate text-muted-foreground">{item.commentaireManager || '-'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {item.statut === 'SOUMISE' && (
                        <Button size="sm" variant="outline" onClick={() => onEdit(item)}><Edit className="h-4 w-4" />Modifier</Button>
                      )}
                      {(item.statut === 'SOUMISE' || item.statut === 'APPROUVEE') && (
                        <Button size="sm" variant="outline" disabled={actionPending} onClick={() => onCancel(item.ID)}><X className="h-4 w-4" />Annuler</Button>
                      )}
                    </div>
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

function MyLeaveCalendar({ rows, loading }: { rows: LeaveRow[]; loading: boolean }) {
  const [selectedLeave, setSelectedLeave] = useState<LeaveRow | null>(null);

  const statusColor = (statut: string) => {
    if (statut === 'APPROUVEE') return { bg: 'var(--status-approved-bg)', border: 'var(--status-approved-border)', text: 'var(--status-approved-text)' };
    if (statut === 'REJETEE')   return { bg: 'var(--status-rejected-bg)', border: 'var(--status-rejected-border)', text: 'var(--status-rejected-text)' };
    if (statut === 'ANNULEE')   return { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' };
    return { bg: 'var(--status-pending-bg)', border: 'var(--status-pending-border)', text: 'var(--status-pending-text)' };
  };

  const addOneDay = (value: string) => {
    const d = new Date(`${value}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  const events = rows.map((item) => {
    const { bg, border, text } = statusColor(item.statut);
    return {
      id: item.ID,
      title: `${item.typeLabel} — ${statusLabel(item.statut)}`,
      start: item.dateDebut,
      end: addOneDay(item.dateFin),
      backgroundColor: bg,
      borderColor: border,
      textColor: text,
      extendedProps: { leaveId: item.ID },
    };
  });

  const rowById = useMemo(() => new Map(rows.map((r) => [r.ID, r])), [rows]);

  const handleEventClick = (click: any) => {
    const id: string | undefined = click.event.extendedProps.leaveId;
    if (!id) return;
    const row = rowById.get(id);
    if (row) setSelectedLeave(row);
  };

  return (
    <>
      <Card className="rounded-md border-border">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-base font-semibold">Mon calendrier de congés</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { bg: 'var(--status-approved-bg)', border: 'var(--status-approved-border)', label: 'Approuvé' },
              { bg: 'var(--status-pending-bg)',  border: 'var(--status-pending-border)',  label: 'En attente' },
              { bg: 'var(--status-rejected-bg)', border: 'var(--status-rejected-border)', label: 'Rejeté' },
              { bg: '#f1f5f9',                   border: '#cbd5e1',                        label: 'Annulé' },
            ].map(({ bg, border, label }) => (
              <span key={label} className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 bg-surface-1">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: bg, border: `1px solid ${border}` }} />
                {label}
              </span>
            ))}
          </div>
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>
          ) : (
            <div className="min-h-[38rem] rounded-md border border-border bg-background p-3">
              <FullCalendar
                plugins={[dayGridPlugin as never, interactionPlugin as never]}
                initialView="dayGridMonth"
                locales={[frLocale as never]}
                locale="fr"
                height="auto"
                firstDay={1}
                events={events}
                eventDisplay="block"
                headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,dayGridWeek' }}
                eventClick={handleEventClick}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedLeave)} onOpenChange={(o) => { if (!o) setSelectedLeave(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail du congé</DialogTitle>
            <DialogDescription>
              {selectedLeave ? `${selectedLeave.typeLabel} — ${statusLabel(selectedLeave.statut)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedLeave && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</p>
                  <p className="mt-1 font-medium text-foreground">{selectedLeave.typeLabel}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Statut</p>
                  <p className="mt-1"><span className={statusBadgeClass(selectedLeave.statut)}>{statusLabel(selectedLeave.statut)}</span></p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date de début</p>
                  <p className="mt-1 text-foreground">{formatDate(selectedLeave.dateDebut)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date de fin</p>
                  <p className="mt-1 text-foreground">{formatDate(selectedLeave.dateFin)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Durée</p>
                  <p className="mt-1 text-foreground">{selectedLeave.nbJours} jour(s)</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Motif</p>
                  <p className="mt-1 text-foreground">{selectedLeave.motif || '-'}</p>
                </div>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Commentaire du manager</p>
                <p className="mt-1 text-sm text-foreground">{selectedLeave.commentaireManager || 'Aucun commentaire.'}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SkeletonRows() {
  return <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded-md bg-muted" />)}</div>;
}
