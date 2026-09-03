import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  CalendarCheck,
  Check,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  RefreshCw,
  Search,
  Sparkles,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../../components/ui/dialog';
import {
  GestionCongesCertificatsAPI,
  type CertificatGcc,
  type DemandeConge,
  type EmployeGcc,
} from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';

type Tone = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
type LeaveRow = DemandeConge & { consultantLabel: string; typeLabel: string };
type CertificateRow = CertificatGcc & {
  consultantLabel: string;
  domaineLabel: string;
  validite: 'VALIDE' | 'EXPIRE_BIENTOT' | 'EXPIRE' | 'SANS_EXPIRATION';
};

const ALL = 'ALL';
const CURRENT_YEAR = new Date().getFullYear();
const formatDate = (value?: string) =>
  value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '-';

const statusTone = (status: string): Tone =>
  status === 'APPROUVEE'
    ? 'success'
    : status === 'REJETEE'
      ? 'destructive'
      : status === 'SOUMISE'
        ? 'warning'
        : 'secondary';

const certificateTone = (validite: CertificateRow['validite']): Tone =>
  validite === 'EXPIRE'
    ? 'destructive'
    : validite === 'EXPIRE_BIENTOT'
      ? 'warning'
      : validite === 'VALIDE'
        ? 'success'
        : 'secondary';

const statusBadgeClass = (status: string): string => {
  if (status === 'APPROUVEE')
    return 'border-[var(--status-approved-border)] bg-[var(--status-approved-bg)] text-[var(--status-approved-text)]';
  if (status === 'REJETEE')
    return 'border-[var(--status-rejected-border)] bg-[var(--status-rejected-bg)] text-[var(--status-rejected-text)]';
  if (status === 'SOUMISE')
    return 'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]';
  return 'border-border bg-muted text-muted-foreground';
};

const validityBadgeClass = (validite: CertificateRow['validite']): string => {
  if (validite === 'VALIDE')
    return 'border-[var(--status-approved-border)] bg-[var(--status-approved-bg)] text-[var(--status-approved-text)]';
  if (validite === 'EXPIRE')
    return 'border-[var(--status-rejected-border)] bg-[var(--status-rejected-bg)] text-[var(--status-rejected-text)]';
  if (validite === 'EXPIRE_BIENTOT')
    return 'border-[var(--status-pending-border)] bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]';
  return 'border-border bg-muted text-muted-foreground';
};

const daysUntil = (date?: string) =>
  date ? Math.ceil((new Date(`${date}T00:00:00`).getTime() - Date.now()) / 86400000) : null;

const certificateValidity = (date?: string): CertificateRow['validite'] => {
  const delta = daysUntil(date);
  if (delta === null) return 'SANS_EXPIRATION';
  if (delta < 0) return 'EXPIRE';
  if (delta <= 90) return 'EXPIRE_BIENTOT';
  return 'VALIDE';
};

const messageFromError = (error: unknown) =>
  error && typeof error === 'object' && 'message' in error
    ? String((error as { message?: unknown }).message)
    : '';

const consultantPalette = [
  '#1e3a8a',
  '#2563eb',
  '#0891b2',
  '#0d9488',
  '#059669',
  '#16a34a',
  '#ca8a04',
  '#d97706',
  '#ea580c',
  '#dc2626',
  '#e11d48',
  '#db2777',
  '#be185d',
  '#7c3aed',
  '#6d28d9',
  '#4f46e5',
  '#4338ca',
  '#334155',
];

const getConsultantColor = (index: number): string =>
  consultantPalette[index % consultantPalette.length];

export function GestionManagerFiori() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [leaveFilters, setLeaveFilters] = useState({
    status: ALL,
    consultant: ALL,
    type: ALL,
    from: '',
    to: '',
    search: '',
  });
  const [certificateFilters, setCertificateFilters] = useState({
    consultant: ALL,
    domaine: ALL,
    validite: ALL,
    search: '',
  });
  const [selectedConsultant, setSelectedConsultant] = useState<string>(ALL);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRow | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const demandes = useQuery({
    queryKey: ['gcc-manager', 'demandes'],
    queryFn: GestionCongesCertificatsAPI.manager.demandes,
  });
  const consultants = useQuery({
    queryKey: ['gcc-manager', 'consultants'],
    queryFn: GestionCongesCertificatsAPI.manager.consultants,
  });
  const certificats = useQuery({
    queryKey: ['gcc-manager', 'certificats'],
    queryFn: GestionCongesCertificatsAPI.manager.certificats,
  });
  const types = useQuery({
    queryKey: ['gcc-manager', 'types'],
    queryFn: GestionCongesCertificatsAPI.manager.typesConge,
  });
  const domaines = useQuery({
    queryKey: ['gcc-manager', 'domaines'],
    queryFn: GestionCongesCertificatsAPI.manager.domaines,
  });
  const kpi = useQuery({
    queryKey: ['gcc-manager', 'kpi'],
    queryFn: GestionCongesCertificatsAPI.manager.kpiConges,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc-manager'] });
  const approuver = useMutation({
    mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) =>
      GestionCongesCertificatsAPI.manager.approuverDemande(id, commentaire),
    onSuccess: refresh,
  });
  const rejeter = useMutation({
    mutationFn: ({ id, commentaire }: { id: string; commentaire: string }) =>
      GestionCongesCertificatsAPI.manager.rejeterDemande(id, commentaire),
    onSuccess: refresh,
  });

  const consultantOptions = consultants.data ?? [];
  const typeOptions = types.data ?? [];
  const domaineOptions = domaines.data ?? [];
  const consultantById = useMemo(
    () =>
      new Map(
        consultantOptions.map((item) => [item.ID, `${item.prenom} ${item.nom}`]),
      ),
    [consultantOptions],
  );
  const consultantColorMap = useMemo(() => {
    const map = new Map<string, { bg: string; border: string }>();
    consultantOptions.forEach((c, i) => {
      const color = getConsultantColor(i);
      map.set(c.ID, { bg: color, border: color });
    });
    return map;
  }, [consultantOptions]);

  const typeById = useMemo(
    () => new Map(typeOptions.map((item) => [item.ID, item.libelle])),
    [typeOptions],
  );
  const domaineById = useMemo(
    () => new Map(domaineOptions.map((item) => [item.ID, item.libelle])),
    [domaineOptions],
  );
  const isLoading =
    demandes.isLoading ||
    consultants.isLoading ||
    certificats.isLoading ||
    types.isLoading ||
    domaines.isLoading ||
    kpi.isLoading;
  const error = [
    demandes.error,
    consultants.error,
    certificats.error,
    types.error,
    domaines.error,
    kpi.error,
    approuver.error,
    rejeter.error,
  ]
    .map(messageFromError)
    .find(Boolean);
  const actionPending = approuver.isPending || rejeter.isPending;

  const defaultTab = location.pathname.endsWith('/calendar')
    ? 'calendar'
    : location.pathname.endsWith('/certificates')
      ? 'certificates'
      : location.pathname.endsWith('/consultants')
        ? 'consultants'
        : 'leave';
  const managerTabPath = (tab: string) =>
    tab === 'leave' ? '/manager/leave' : `/manager/${tab}`;

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
    return (
      (leaveFilters.status === ALL || item.statut === leaveFilters.status) &&
      (leaveFilters.consultant === ALL || item.consultant_ID === leaveFilters.consultant) &&
      (leaveFilters.type === ALL || item.typeConge_ID === leaveFilters.type) &&
      (!leaveFilters.from || item.dateFin >= leaveFilters.from) &&
      (!leaveFilters.to || item.dateDebut <= leaveFilters.to) &&
      (!leaveFilters.search || haystack.includes(leaveFilters.search.toLowerCase()))
    );
  });
  const filteredCertificates = certificatRows.filter((item) => {
    const haystack = `${item.consultantLabel} ${item.domaineLabel} ${item.intitule} ${item.organisme ?? ''} ${item.identifiantCertificat ?? ''}`.toLowerCase();
    return (
      (certificateFilters.consultant === ALL ||
        item.consultant_ID === certificateFilters.consultant) &&
      (certificateFilters.domaine === ALL || item.domaine_ID === certificateFilters.domaine) &&
      (certificateFilters.validite === ALL || item.validite === certificateFilters.validite) &&
      (!certificateFilters.search || haystack.includes(certificateFilters.search.toLowerCase()))
    );
  });
  const selectedConsultantData =
    selectedConsultant === ALL
      ? undefined
      : consultantOptions.find((item) => item.ID === selectedConsultant);

  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject';
    leave: LeaveRow;
  } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionCommentError, setActionCommentError] = useState('');

  const openApprove = (leave: LeaveRow) => {
    setActionModal({ type: 'approve', leave });
    setActionComment('Approuvé par le manager');
    setActionCommentError('');
  };

  const openReject = (leave: LeaveRow) => {
    setActionModal({ type: 'reject', leave });
    setActionComment('');
    setActionCommentError('');
  };

  const confirmAction = () => {
    if (!actionModal) return;
    const commentTrimmed = actionComment.trim();
    if (actionModal.type === 'reject' && !commentTrimmed) {
      setActionCommentError('Le motif du rejet est obligatoire.');
      return;
    }

    if (actionModal.type === 'approve') {
      approuver.mutate(
        { id: actionModal.leave.ID, commentaire: commentTrimmed || 'Approuvé par le manager' },
        {
          onSuccess: () => {
            setActionModal(null);
            if (selectedLeave?.ID === actionModal.leave.ID) {
              setSelectedLeave(null);
            }
          },
        },
      );
    } else {
      rejeter.mutate(
        { id: actionModal.leave.ID, commentaire: commentTrimmed },
        {
          onSuccess: () => {
            setActionModal(null);
            if (selectedLeave?.ID === actionModal.leave.ID) {
              setSelectedLeave(null);
            }
          },
        },
      );
    }
  };

  const pageConfig = {
    leave: {
      title: 'Gestion des congés',
      subtitle: "Demandes de congés de votre équipe, décisions et suivi.",
      breadcrumbs: [
        { label: 'Manager', path: '/manager/dashboard' },
        { label: 'Congés' },
      ],
    },
    calendar: {
      title: 'Calendrier équipe',
      subtitle: "Vue d'ensemble des absences planifiées de votre équipe.",
      breadcrumbs: [
        { label: 'Manager', path: '/manager/dashboard' },
        { label: 'Calendrier équipe' },
      ],
    },
    certificates: {
      title: 'Certificats équipe',
      subtitle: 'Certifications détenues par les consultants de votre équipe.',
      breadcrumbs: [
        { label: 'Manager', path: '/manager/dashboard' },
        { label: 'Certificats' },
      ],
    },
    consultants: {
      title: 'Consultants',
      subtitle: 'Fiches individuelles : congés et certificats par consultant.',
      breadcrumbs: [
        { label: 'Manager', path: '/manager/dashboard' },
        { label: 'Consultants' },
      ],
    },
  }[defaultTab as 'leave' | 'calendar' | 'certificates' | 'consultants'];

  return (
    <div className="min-w-0">
      <PageHeader
        title={pageConfig.title}
        subtitle={pageConfig.subtitle}
        breadcrumbs={pageConfig.breadcrumbs}
        actions={
          <Button
            onClick={refresh}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />
      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <TabsNav value={defaultTab} onChange={(tab) => navigate(managerTabPath(tab))} />

        <div className="space-y-4">
          {defaultTab === 'leave' && (
            <>
              <LeaveFilters
                filters={leaveFilters}
                setFilters={setLeaveFilters}
                consultants={consultantOptions}
                types={typeOptions}
              />
              <LeaveTable
                rows={filteredLeaves}
                loading={isLoading}
                actionPending={actionPending}
                onApprove={openApprove}
                onReject={openReject}
                onSelect={setSelectedLeave}
              />
            </>
          )}

          {defaultTab === 'calendar' && (
            <>
              <LeaveFilters
                filters={leaveFilters}
                setFilters={setLeaveFilters}
                consultants={consultantOptions}
                types={typeOptions}
              />
              <YearlyLeaveCalendar
                rows={filteredLeaves}
                consultants={consultantOptions}
                consultantColorMap={consultantColorMap}
                loading={isLoading}
                onSelectLeave={setSelectedLeave}
              />
            </>
          )}

          {defaultTab === 'certificates' && (
            <>
              <CertificateFilters
                filters={certificateFilters}
                setFilters={setCertificateFilters}
                consultants={consultantOptions}
                domaines={domaineOptions}
              />
              <CertificatesByConsultant
                consultants={consultantOptions}
                rows={filteredCertificates}
                onPreview={setPdfPreviewUrl}
                loading={isLoading}
              />
            </>
          )}

          {defaultTab === 'consultants' && (
            <>
              <ConsultantPicker
                consultants={consultantOptions}
                selectedConsultant={selectedConsultant}
                setSelectedConsultant={setSelectedConsultant}
              />
              <ConsultantProfile
                consultant={selectedConsultantData}
                leaves={demandeRows.filter(
                  (item) => item.consultant_ID === selectedConsultant,
                )}
                certificates={certificatRows.filter(
                  (item) => item.consultant_ID === selectedConsultant,
                )}
              />
            </>
          )}
        </div>

      </main>

      <Dialog open={selectedLeave !== null} onOpenChange={(o) => !o && setSelectedLeave(null)}>
        <DialogContent className="max-w-md p-6">
          {selectedLeave && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold">Détails du congé</DialogTitle>
                <DialogDescription>
                  Demande de {selectedLeave.consultantLabel}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Consultant</span>
                  <span className="font-medium">{selectedLeave.consultantLabel}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{selectedLeave.typeLabel}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Début</span>
                  <span className="font-medium">{formatDate(selectedLeave.dateDebut)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Fin</span>
                  <span className="font-medium">{formatDate(selectedLeave.dateFin)}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Durée</span>
                  <span className="font-medium">{selectedLeave.nbJours} jour(s)</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Statut</span>
                  <Badge className={statusBadgeClass(selectedLeave.statut)}>
                    {leaveStatusLabel(selectedLeave.statut)}
                  </Badge>
                </div>
                {selectedLeave.motif && (
                  <div className="border-b pb-2">
                    <p className="mb-1 text-muted-foreground">Motif du collaborateur</p>
                    <p className="text-foreground italic bg-muted/40 p-2 rounded-md">« {selectedLeave.motif} »</p>
                  </div>
                )}
                {selectedLeave.commentaireManager && (
                  <div>
                    <p className="mb-1 text-muted-foreground">Commentaire manager</p>
                    <p className="text-foreground">{selectedLeave.commentaireManager}</p>
                  </div>
                )}
              </div>

              {selectedLeave.statut === 'SOUMISE' && (
                <div className="flex gap-2 pt-3 border-t mt-2">
                  <Button
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                    onClick={() => {
                      openApprove(selectedLeave);
                    }}
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1 font-medium shadow-xs"
                    onClick={() => {
                      openReject(selectedLeave);
                    }}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    Rejeter
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionModal !== null}
        onOpenChange={(open) => {
          if (!open && !actionPending) {
            setActionModal(null);
          }
        }}
      >
        <DialogContent className="max-w-lg p-6 sm:rounded-2xl border bg-background/95 backdrop-blur-md shadow-2xl">
          {actionModal && (
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-200',
                    actionModal.type === 'approve'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400',
                  )}
                >
                  {actionModal.type === 'approve' ? (
                    <CheckCircle2 className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6" />
                  )}
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-lg font-bold tracking-tight">
                    {actionModal.type === 'approve'
                      ? 'Approuver la demande de congé'
                      : 'Rejeter la demande de congé'}
                  </DialogTitle>
                  <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                    {actionModal.type === 'approve'
                      ? "Validez la demande d'absence pour le collaborateur."
                      : 'Veuillez préciser le motif obligatoire du refus.'}
                  </DialogDescription>
                </div>
              </div>

              <div className="rounded-xl border bg-muted/40 dark:bg-muted/20 p-3.5 space-y-2 text-xs sm:text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <UserRound className="h-4 w-4 text-primary" />
                    <span>{actionModal.leave.consultantLabel}</span>
                  </div>
                  <Badge variant="outline" className="font-medium text-xs bg-background/80 shadow-2xs">
                    {actionModal.leave.typeLabel}
                  </Badge>
                </div>

                <div className="flex items-center justify-between text-muted-foreground pt-1.5 border-t border-border/40 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {formatDate(actionModal.leave.dateDebut)} – {formatDate(actionModal.leave.dateFin)}
                    </span>
                  </div>
                  <span className="font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md text-xs">
                    {actionModal.leave.nbJours} jour(s)
                  </span>
                </div>

                {actionModal.leave.motif && (
                  <div className="pt-1.5 border-t border-border/40 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Motif du collaborateur : </span>
                    <span className="italic">« {actionModal.leave.motif} »</span>
                  </div>
                )}
              </div>

              {actionModal.type === 'approve' ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="action-comment" className="text-xs font-semibold">
                      Commentaire d'approbation <span className="text-muted-foreground font-normal">(optionnel)</span>
                    </Label>
                  </div>
                  <Textarea
                    id="action-comment"
                    value={actionComment}
                    onChange={(e) => setActionComment(e.target.value)}
                    placeholder="ex: Approuvé par le manager"
                    className="min-h-[85px] text-sm resize-none focus-visible:ring-emerald-500 rounded-xl"
                  />
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Suggestions rapides :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Approuvé par le manager',
                        'Validé, bonne continuation !',
                        'Continuité de service validée',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setActionComment(preset)}
                          className="text-xs px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary text-secondary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] border border-border/40 cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="action-comment" className="text-xs font-semibold flex items-center gap-1">
                      <span>Motif obligatoire du rejet</span>
                      <span className="text-destructive font-bold">*</span>
                    </Label>
                    {actionCommentError && (
                      <span className="text-xs font-medium text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {actionCommentError}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="action-comment"
                    value={actionComment}
                    onChange={(e) => {
                      setActionComment(e.target.value);
                      if (actionCommentError && e.target.value.trim()) {
                        setActionCommentError('');
                      }
                    }}
                    placeholder="Veuillez préciser la raison du rejet..."
                    className={cn(
                      'min-h-[90px] text-sm resize-none rounded-xl transition-all',
                      actionCommentError
                        ? 'border-destructive focus-visible:ring-destructive'
                        : 'focus-visible:ring-rose-500',
                    )}
                  />
                  <div className="space-y-1.5 pt-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
                      <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Motifs fréquents :
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Effectif insuffisant sur la période',
                        'Pic d’activité / jalon projet critique',
                        'Solde de congés insuffisant',
                        'Merci de décaler vos dates',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setActionComment(preset);
                            setActionCommentError('');
                          }}
                          className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 hover:bg-destructive/20 text-destructive dark:text-rose-400 transition-all hover:scale-[1.02] active:scale-[0.98] border border-destructive/20 cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-2 pt-3 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionModal(null)}
                  disabled={actionPending}
                  className="rounded-xl"
                >
                  Annuler
                </Button>
                {actionModal.type === 'approve' ? (
                  <Button
                    type="button"
                    onClick={confirmAction}
                    disabled={actionPending}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md transition-all flex items-center gap-1.5 rounded-xl"
                  >
                    {actionPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span>Confirmer l'approbation</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={confirmAction}
                    disabled={actionPending}
                    className="font-medium shadow-md transition-all flex items-center gap-1.5 rounded-xl"
                  >
                    {actionPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    <span>Confirmer le rejet</span>
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Aperçu PDF certificat */}
      <Dialog open={!!pdfPreviewUrl} onOpenChange={(o) => !o && setPdfPreviewUrl(null)}>
        <DialogContent className="max-w-4xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Aperçu du certificat PDF
            </DialogTitle>
          </DialogHeader>
          {pdfPreviewUrl && (
            <iframe src={pdfPreviewUrl} className="w-full h-full border-0" title="Aperçu PDF" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabsNav({
  value,
  onChange,
}: {
  value: string;
  onChange: (tab: string) => void;
}) {
  const tabs = [
    { key: 'leave', label: 'Congés' },
    { key: 'calendar', label: 'Calendrier équipe' },
    { key: 'certificates', label: 'Certificats' },
    { key: 'consultants', label: 'Consultants' },
  ];
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'relative whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors',
            value === tab.key
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.label}
          {value === tab.key && (
            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
          )}
        </button>
      ))}
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  color = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  detail: string;
  color?: 'default' | 'success' | 'warning' | 'info' | 'danger';
}) {
  const colorMap = {
    default: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    info: 'bg-info/10 text-info',
    danger: 'bg-destructive/10 text-destructive',
  };
  return (
    <Card className="border-border bg-card transition-colors hover:border-primary/30">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
            colorMap[color],
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="truncate text-[11px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

function ConsultantPicker({
  consultants,
  selectedConsultant,
  setSelectedConsultant,
}: {
  consultants: EmployeGcc[];
  selectedConsultant: string;
  setSelectedConsultant: (value: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid gap-2 md:grid-cols-[16rem_1fr] md:items-end">
          <FilterField label="Consultant">
            <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un consultant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Tous les consultants</SelectItem>
                {consultants.map((item) => (
                  <SelectItem key={item.ID} value={item.ID}>
                    {item.prenom} {item.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <p className="text-sm text-muted-foreground">
            Sélectionnez un consultant pour consulter son profil, ses congés et ses certificats.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaveFilters({
  filters,
  setFilters,
  consultants,
  types,
}: {
  filters: Record<string, string>;
  setFilters: (value: any) => void;
  consultants: EmployeGcc[];
  types: Array<{ ID: string; libelle: string }>;
}) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
        <FilterField label="Recherche">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={filters.search}
              onChange={(event) =>
                setFilters((current: typeof filters) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
            />
          </div>
        </FilterField>
        <FilterField label="Statut">
          <Select
            value={filters.status}
            onValueChange={(value) =>
              setFilters((current: typeof filters) => ({ ...current, status: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {['SOUMISE', 'APPROUVEE', 'REJETEE', 'ANNULEE'].map((item) => (
                <SelectItem key={item} value={item}>
                  {leaveStatusLabel(item)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Consultant">
          <Select
            value={filters.consultant}
            onValueChange={(value) =>
              setFilters((current: typeof filters) => ({ ...current, consultant: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {consultants.map((item) => (
                <SelectItem key={item.ID} value={item.ID}>
                  {item.prenom} {item.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Type">
          <Select
            value={filters.type}
            onValueChange={(value) =>
              setFilters((current: typeof filters) => ({ ...current, type: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {types.map((item) => (
                <SelectItem key={item.ID} value={item.ID}>
                  {item.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Du">
          <Input
            type="date"
            value={filters.from}
            onChange={(event) =>
              setFilters((current: typeof filters) => ({ ...current, from: event.target.value }))
            }
          />
        </FilterField>
        <FilterField label="Au">
          <Input
            type="date"
            value={filters.to}
            onChange={(event) =>
              setFilters((current: typeof filters) => ({ ...current, to: event.target.value }))
            }
          />
        </FilterField>
      </CardContent>
    </Card>
  );
}

function CertificateFilters({
  filters,
  setFilters,
  consultants,
  domaines,
}: {
  filters: Record<string, string>;
  setFilters: (value: any) => void;
  consultants: EmployeGcc[];
  domaines: Array<{ ID: string; libelle: string }>;
}) {
  return (
    <Card>
      <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <FilterField label="Recherche">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              value={filters.search}
              onChange={(event) =>
                setFilters((current: typeof filters) => ({
                  ...current,
                  search: event.target.value,
                }))
              }
            />
          </div>
        </FilterField>
        <FilterField label="Consultant">
          <Select
            value={filters.consultant}
            onValueChange={(value) =>
              setFilters((current: typeof filters) => ({ ...current, consultant: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {consultants.map((item) => (
                <SelectItem key={item.ID} value={item.ID}>
                  {item.prenom} {item.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Domaine">
          <Select
            value={filters.domaine}
            onValueChange={(value) =>
              setFilters((current: typeof filters) => ({ ...current, domaine: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tous</SelectItem>
              {domaines.map((item) => (
                <SelectItem key={item.ID} value={item.ID}>
                  {item.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Validité">
          <Select
            value={filters.validite}
            onValueChange={(value) =>
              setFilters((current: typeof filters) => ({ ...current, validite: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Toutes</SelectItem>
              {['VALIDE', 'EXPIRE_BIENTOT', 'EXPIRE', 'SANS_EXPIRATION'].map((item) => (
                <SelectItem key={item} value={item}>
                  {certificateValidityLabel(item as CertificateRow['validite'])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </CardContent>
    </Card>
  );
}

function LeaveTable({
  rows,
  loading,
  actionPending,
  onApprove,
  onReject,
  onSelect,
}: {
  rows: LeaveRow[];
  loading: boolean;
  actionPending: boolean;
  onApprove: (row: LeaveRow) => void;
  onReject: (row: LeaveRow) => void;
  onSelect: (row: LeaveRow) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Aucune demande"
            description="Aucune ligne ne correspond aux filtres."
            className="m-6"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Consultant</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead>Jours</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Motif</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow
                    key={item.ID}
                    className={cn(
                      'cursor-pointer transition-colors',
                      item.statut === 'SOUMISE' && 'bg-surface-2',
                    )}
                    onClick={() => onSelect(item)}
                  >
                    <TableCell className="font-medium">{item.consultantLabel}</TableCell>
                    <TableCell>{item.typeLabel}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(item.dateDebut)} – {formatDate(item.dateFin)}
                    </TableCell>
                    <TableCell>{item.nbJours}</TableCell>
                    <TableCell>
                      <Badge className={statusBadgeClass(item.statut)}>
                        {leaveStatusLabel(item.statut)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[18rem] truncate text-muted-foreground">
                      {item.motif || '–'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {item.statut === 'SOUMISE' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
                            disabled={actionPending}
                            onClick={() => onApprove(item)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="font-medium shadow-xs"
                            disabled={actionPending}
                            onClick={() => onReject(item)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Rejeter
                          </Button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-muted-foreground">
                          {item.updatedAt ? formatDate(item.updatedAt) : '–'}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function YearlyLeaveCalendar({
  rows,
  consultants,
  consultantColorMap,
  loading,
  onSelectLeave,
}: {
  rows: LeaveRow[];
  consultants: EmployeGcc[];
  consultantColorMap: Map<string, { bg: string; border: string }>;
  loading: boolean;
  onSelectLeave: (row: LeaveRow) => void;
}) {
  const events = rows.map((item) => {
    const colors = consultantColorMap.get(item.consultant_ID) ?? {
      bg: '#1e3a8a',
      border: '#1e3a8a',
    };
    const dimmed =
      item.statut === 'REJETEE' || item.statut === 'ANNULEE' ? ' opacity-60' : '';
    return {
      id: item.ID,
      title: item.consultantLabel,
      start: item.dateDebut,
      end: addOneDay(item.dateFin),
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: '#ffffff',
      className: `fc-event-solid${dimmed}`,
      extendedProps: {
        consultantId: item.consultant_ID,
        statut: item.statut,
        type: item.typeLabel,
        jours: item.nbJours,
      },
    };
  });

  const handleEventClick = (info: any) => {
    const row = rows.find((r) => r.ID === info.event.id);
    if (row) onSelectLeave(row);
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">Légende – Consultants</h3>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {consultants.map((c, i) => (
              <span
                key={c.ID}
                className="inline-flex items-center gap-2 text-muted-foreground"
              >
                <span
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: getConsultantColor(i) }}
                />
                {c.prenom} {c.nom}
              </span>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-2 border-l border-border pl-4">
              <LegendPill className="bg-success" label="Approuvé" />
              <LegendPill className="bg-warning" label="En attente" />
              <LegendPill className="bg-destructive" label="Rejeté" />
              <LegendPill className="bg-muted-foreground" label="Annulé" />
            </div>
          </div>
        </div>

        {loading ? (
          <SkeletonRows />
        ) : (
          <div className="gcc-calendar min-h-[36rem] rounded-md border border-border bg-background">
            <FullCalendar
              plugins={[dayGridPlugin as never, interactionPlugin as never]}
              initialView="dayGridMonth"
              initialDate={`${CURRENT_YEAR}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`}
              locales={[frLocale as never]}
              locale="fr"
              height="auto"
              firstDay={1}
              events={events}
              selectable
              eventDisplay="block"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,dayGridWeek',
              }}
              eventClick={handleEventClick}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LegendPill({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-0.5 text-muted-foreground">
      <span className={cn('h-2.5 w-2.5 rounded-sm', className)} />
      {label}
    </span>
  );
}

function CertificatesByConsultant({
  consultants,
  rows,
  loading,
  onPreview,
}: {
  consultants: EmployeGcc[];
  rows: CertificateRow[];
  loading: boolean;
  onPreview: (url: string) => void;
}) {
  const consultantRows = consultants
    .map((consultant) => ({
      consultant,
      certificates: rows.filter((item) => item.consultant_ID === consultant.ID),
    }))
    .filter((entry) => entry.certificates.length > 0);

  return (
    <Card>
      <CardContent className="p-0">
        {loading ? (
          <SkeletonRows />
        ) : consultantRows.length === 0 ? (
          <EmptyState
            icon={Award}
            title="Aucun certificat"
            description="Aucun certificat ne correspond aux filtres."
            className="m-6"
          />
        ) : (
          <div className="divide-y divide-border">
            {consultantRows.map(({ consultant, certificates }) => (
              <div key={consultant.ID}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <h3 className="text-sm font-semibold">{consultant.prenom} {consultant.nom}</h3>
                    <p className="text-xs text-muted-foreground">
                      {consultant.poste ?? 'Consultant'} – {consultant.email}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {certificates.length} certificat{certificates.length > 1 ? 's' : ''}
                  </Badge>
                </div>
                <CertificateTable rows={certificates} onPreview={onPreview} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CertificateTable({ rows, onPreview }: { rows: CertificateRow[]; onPreview?: (url: string) => void }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-surface-2">
          <TableRow>
            <TableHead>Certification</TableHead>
            <TableHead>Domaine</TableHead>
            <TableHead>Document</TableHead>
            <TableHead>Obtention</TableHead>
            <TableHead>Expiration</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => (
            <TableRow key={item.ID}>
              <TableCell className="font-medium">
                <div>{item.intitule}</div>
                <div className="text-xs text-muted-foreground">
                  {item.organisme || '–'}
                  {item.identifiantCertificat ? ` – ${item.identifiantCertificat}` : ''}
                </div>
              </TableCell>
              <TableCell>{item.domaineLabel}</TableCell>
              <TableCell>
                {item.documentUrl ? (
                  item.documentUrl.startsWith('data:') ? (
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" onClick={() => onPreview?.(item.documentUrl!)}>
                        <Eye className="h-4 w-4" />
                        Aperçu
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" asChild>
                      <a href={item.documentUrl} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
                        Ouvrir
                      </a>
                    </Button>
                  )
                ) : (
                  <span className="text-xs text-muted-foreground">Non fourni</span>
                )}
              </TableCell>
              <TableCell>{formatDate(item.dateObtention)}</TableCell>
              <TableCell>{formatDate(item.dateExpiration)}</TableCell>
              <TableCell>
                <Badge className={validityBadgeClass(item.validite)}>
                  {certificateValidityLabel(item.validite)}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ConsultantProfile({
  consultant,
  leaves,
  certificates,
}: {
  consultant?: EmployeGcc;
  leaves: LeaveRow[];
  certificates: CertificateRow[];
}) {
  if (!consultant)
    return (
      <EmptyState
        icon={UserRound}
        title="Aucun consultant sélectionné"
        description="Choisissez un consultant pour consulter sa fiche."
      />
    );
  const approvedDays = leaves
    .filter((item) => item.statut === 'APPROUVEE')
    .reduce((sum, item) => sum + Number(item.nbJours || 0), 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[18rem_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {consultant.prenom} {consultant.nom}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {consultant.poste ?? 'Consultant'}
          </p>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">E-mail</span>
            <span className="text-right font-medium">{consultant.email}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Solde congés</span>
            <span className="font-medium">{consultant.soldeConges} jours</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Jours pris</span>
            <span className="font-medium">{approvedDays}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Certificats</span>
            <span className="font-medium">{certificates.length}</span>
          </div>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certifications détenues</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {certificates.length === 0 ? (
              <EmptyState
                icon={Award}
                title="Aucun certificat"
                description="Ce consultant n'a pas encore de certificat enregistré."
                className="m-6"
              />
            ) : (
              <CertificateTable rows={certificates} />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historique des congés</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {leaves.length === 0 ? (
              <EmptyState
                icon={CalendarCheck}
                title="Aucun congé"
                description="Ce consultant n'a pas encore de demande de congé."
                className="m-6"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Jours</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Motif</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leaves.map((item) => (
                      <TableRow key={item.ID}>
                        <TableCell className="font-medium">{item.typeLabel}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(item.dateDebut)} – {formatDate(item.dateFin)}
                        </TableCell>
                        <TableCell>{item.nbJours}</TableCell>
                        <TableCell>
                          <Badge className={statusBadgeClass(item.statut)}>
                            {leaveStatusLabel(item.statut)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[18rem] truncate text-muted-foreground">
                          {item.motif || '–'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-10 animate-pulse rounded-md bg-muted"
        />
      ))}
    </div>
  );
}

function addOneDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function leaveStatusLabel(status: string) {
  return status === 'APPROUVEE'
    ? 'Approuvé'
    : status === 'REJETEE'
      ? 'Rejeté'
      : status === 'ANNULEE'
        ? 'Annulé'
        : 'En attente';
}

function certificateValidityLabel(validite: CertificateRow['validite']) {
  return validite === 'EXPIRE'
    ? 'Expiré'
    : validite === 'EXPIRE_BIENTOT'
      ? 'Expire bientôt'
      : validite === 'SANS_EXPIRATION'
        ? 'Sans expiration'
        : 'Valide';
}
