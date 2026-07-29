import { useMemo } from 'react';
import { AlertTriangle, Award, CalendarCheck, Check, RefreshCw, Users, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { GestionCongesCertificatsAPI, type CertificatGcc, type DemandeConge } from '../../services/odata/gestionCongesCertificatsApi';
import { cn } from '../../components/ui/utils';

type StatusTone = 'default' | 'secondary' | 'destructive' | 'outline';

const statusTone = (status: string): StatusTone => {
  if (status === 'APPROUVEE') return 'default';
  if (status === 'REJETEE') return 'destructive';
  if (status === 'SOUMISE') return 'secondary';
  return 'outline';
};

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat('fr-FR').format(new Date(value)) : '-';

const certificateTone = (date?: string): StatusTone => {
  if (!date) return 'outline';
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return 'destructive';
  if (diff <= 90 * 24 * 60 * 60 * 1000) return 'secondary';
  return 'default';
};

const messageFromError = (error: unknown) =>
  error && typeof error === 'object' && 'message' in error ? String((error as { message?: unknown }).message) : '';

export function GestionManagerFiori() {
  const queryClient = useQueryClient();
  const demandes = useQuery({ queryKey: ['gcc-manager', 'demandes'], queryFn: GestionCongesCertificatsAPI.manager.demandes });
  const consultants = useQuery({ queryKey: ['gcc-manager', 'consultants'], queryFn: GestionCongesCertificatsAPI.manager.consultants });
  const certificats = useQuery({ queryKey: ['gcc-manager', 'certificats'], queryFn: GestionCongesCertificatsAPI.manager.certificats });
  const types = useQuery({ queryKey: ['gcc-manager', 'types'], queryFn: GestionCongesCertificatsAPI.manager.typesConge });
  const domaines = useQuery({ queryKey: ['gcc-manager', 'domaines'], queryFn: GestionCongesCertificatsAPI.manager.domaines });
  const kpi = useQuery({ queryKey: ['gcc-manager', 'kpi'], queryFn: GestionCongesCertificatsAPI.manager.kpiConges });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc-manager'] });
  const approuver = useMutation({
    mutationFn: (id: string) => GestionCongesCertificatsAPI.manager.approuverDemande(id, 'Approuve par le manager'),
    onSuccess: refresh,
  });
  const rejeter = useMutation({
    mutationFn: (id: string) => GestionCongesCertificatsAPI.manager.rejeterDemande(id, 'Rejete par le manager'),
    onSuccess: refresh,
  });

  const consultantById = useMemo(() => new Map((consultants.data ?? []).map((item) => [item.ID, `${item.prenom} ${item.nom}`])), [consultants.data]);
  const typeById = useMemo(() => new Map((types.data ?? []).map((item) => [item.ID, item.libelle])), [types.data]);
  const domaineById = useMemo(() => new Map((domaines.data ?? []).map((item) => [item.ID, item.libelle])), [domaines.data]);
  const isLoading = demandes.isLoading || consultants.isLoading || certificats.isLoading || types.isLoading || domaines.isLoading || kpi.isLoading;
  const loadError = [demandes.error, consultants.error, certificats.error, types.error, domaines.error, kpi.error].map(messageFromError).find(Boolean);
  const actionError = messageFromError(approuver.error) || messageFromError(rejeter.error);
  const actionPending = approuver.isPending || rejeter.isPending;

  const demandeRows = (demandes.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID,
  }));
  const pendingRows = demandeRows.filter((item) => item.statut === 'SOUMISE');
  const certificatRows = (certificats.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID,
  }));
  const expiringCerts = certificatRows.filter((item) => certificateTone(item.dateExpiration) !== 'default' && item.dateExpiration);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Conges et certificats"
        subtitle="Vue manager pour traiter les demandes, surveiller les absences et suivre les certifications de l'equipe."
        breadcrumbs={[{ label: 'Manager', path: '/manager/dashboard' }, { label: 'Conges' }]}
        actions={
          <Button onClick={refresh} disabled={isLoading} className="gap-2">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            Actualiser
          </Button>
        }
      />

      <main className="space-y-6 p-4 sm:p-6 lg:p-8">
        {(loadError || actionError) && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError || actionError}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={AlertTriangle} label="En attente" value={kpi.data?.demandesEnAttente ?? pendingRows.length} detail="Demandes a traiter" />
          <MetricCard icon={CalendarCheck} label="Absences en cours" value={kpi.data?.absencesEnCours ?? 0} detail="Aujourd'hui" />
          <MetricCard icon={Users} label="Jours approuves" value={kpi.data?.joursApprouves ?? 0} detail="Equipe" />
          <MetricCard icon={Check} label="Taux approbation" value={`${Math.round(kpi.data?.tauxApprobation ?? 0)}%`} detail="Demandes decidees" />
          <MetricCard icon={Award} label="Certificats" value={certificatRows.length} detail={`${expiringCerts.length} a surveiller`} />
        </section>

        <Tabs defaultValue="pending" className="gap-4">
          <TabsList className="w-full justify-start overflow-x-auto rounded-md">
            <TabsTrigger value="pending">A traiter</TabsTrigger>
            <TabsTrigger value="all">Toutes les demandes</TabsTrigger>
            <TabsTrigger value="certificates">Certificats</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <LeaveTable
              title="Demandes en attente"
              description="Files prioritaires pour validation manager."
              rows={pendingRows}
              loading={isLoading}
              actionPending={actionPending}
              onApprove={(id) => approuver.mutate(id)}
              onReject={(id) => rejeter.mutate(id)}
            />
          </TabsContent>
          <TabsContent value="all">
            <LeaveTable
              title="Historique des demandes"
              description="Toutes les demandes de conge de l'equipe."
              rows={demandeRows}
              loading={isLoading}
              actionPending={actionPending}
              onApprove={(id) => approuver.mutate(id)}
              onReject={(id) => rejeter.mutate(id)}
            />
          </TabsContent>
          <TabsContent value="certificates">
            <CertificateTable rows={certificatRows} loading={isLoading} />
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

function LeaveTable({
  title,
  description,
  rows,
  loading,
  actionPending,
  onApprove,
  onReject,
}: {
  title: string;
  description: string;
  rows: Array<DemandeConge & { consultantLabel: string; typeLabel: string }>;
  loading: boolean;
  actionPending: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b pb-4">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyState icon={CalendarCheck} title="Aucune demande" description="Il n'y a rien a traiter pour cette vue." className="m-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Periode</TableHead>
                <TableHead>Jours</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Motif</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.ID}>
                  <TableCell className="font-medium">{item.consultantLabel}</TableCell>
                  <TableCell>{item.typeLabel}</TableCell>
                  <TableCell>{formatDate(item.dateDebut)} - {formatDate(item.dateFin)}</TableCell>
                  <TableCell>{item.nbJours}</TableCell>
                  <TableCell><Badge variant={statusTone(item.statut)}>{item.statut}</Badge></TableCell>
                  <TableCell className="max-w-[18rem] truncate text-muted-foreground">{item.motif || '-'}</TableCell>
                  <TableCell>
                    {item.statut === 'SOUMISE' ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" disabled={actionPending} onClick={() => onApprove(item.ID)}><Check className="h-4 w-4" />Approuver</Button>
                        <Button size="sm" variant="destructive" disabled={actionPending} onClick={() => onReject(item.ID)}><X className="h-4 w-4" />Rejeter</Button>
                      </div>
                    ) : (
                      <span className="block text-right text-muted-foreground">-</span>
                    )}
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

function CertificateTable({ rows, loading }: { rows: Array<CertificatGcc & { consultantLabel: string; domaineLabel: string }>; loading: boolean }) {
  return (
    <Card className="rounded-md">
      <CardHeader className="border-b pb-4">
        <CardTitle>Certificats de l'equipe</CardTitle>
        <CardDescription>Suivi des domaines, organismes et dates d'expiration.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <SkeletonRows />
        ) : rows.length === 0 ? (
          <EmptyState icon={Award} title="Aucun certificat" description="Aucun certificat n'a encore ete declare." className="m-6" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultant</TableHead>
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
                  <TableCell className="font-medium">{item.consultantLabel}</TableCell>
                  <TableCell>{item.intitule}</TableCell>
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
