import { type ReactNode, useMemo } from 'react';
import {
  AnalyticalTable,
  Button,
  Card,
  CardHeader,
  DynamicPage,
  DynamicPageHeader,
  DynamicPageTitle,
  FlexBox,
  Label,
  ObjectStatus,
  Text,
  Title,
} from '@ui5/webcomponents-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnalyticalTableColumnDefinition } from '@ui5/webcomponents-react';
import { GestionCongesCertificatsAPI, type CertificatGcc, type DemandeConge } from '../../services/odata/gestionCongesCertificatsApi';

const pagePadding = { padding: '1rem', boxSizing: 'border-box' as const };

const statusState = (statut: string) => {
  if (statut === 'APPROUVEE') return 'Positive';
  if (statut === 'REJETEE') return 'Negative';
  if (statut === 'SOUMISE') return 'Critical';
  return 'None';
};

const certificateState = (date?: string) => {
  if (!date) return 'None';
  const diff = new Date(date).getTime() - Date.now();
  if (diff < 0) return 'Negative';
  if (diff <= 90 * 24 * 60 * 60 * 1000) return 'Critical';
  return 'Positive';
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
  const actionPending = approuver.isPending || rejeter.isPending;
  const actionError = messageFromError(approuver.error) || messageFromError(rejeter.error);

  const demandeColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Consultant', accessor: 'consultantLabel', minWidth: 180 },
    { Header: 'Type', accessor: 'typeLabel', minWidth: 170 },
    { Header: 'Debut', accessor: 'dateDebut', width: 120 },
    { Header: 'Fin', accessor: 'dateFin', width: 120 },
    { Header: 'Jours', accessor: 'nbJours', width: 85 },
    { Header: 'Motif', accessor: 'motif', minWidth: 180 },
    {
      Header: 'Statut',
      accessor: 'statut',
      width: 130,
      Cell: ({ value }) => <ObjectStatus inverted state={statusState(String(value))}>{String(value)}</ObjectStatus>,
    },
    {
      Header: 'Actions',
      accessor: 'ID',
      disableSortBy: true,
      width: 230,
      Cell: ({ row }) => {
        const original = row.original as DemandeConge;
        return original.statut === 'SOUMISE' ? (
          <FlexBox gap="0.5rem" wrap="NoWrap">
            <Button design="Positive" disabled={actionPending} onClick={() => approuver.mutate(original.ID)}>Approuver</Button>
            <Button design="Negative" disabled={actionPending} onClick={() => rejeter.mutate(original.ID)}>Rejeter</Button>
          </FlexBox>
        ) : <Text>-</Text>;
      },
    },
  ], [actionPending, approuver, rejeter]);

  const certificatColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Consultant', accessor: 'consultantLabel', minWidth: 180 },
    { Header: 'Intitule', accessor: 'intitule', minWidth: 220 },
    { Header: 'Domaine', accessor: 'domaineLabel', minWidth: 170 },
    { Header: 'Organisme', accessor: 'organisme', minWidth: 140 },
    { Header: 'Obtention', accessor: 'dateObtention', width: 130 },
    {
      Header: 'Expiration',
      accessor: 'dateExpiration',
      width: 145,
      Cell: ({ row, value }) => {
        const original = row.original as CertificatGcc;
        return <ObjectStatus state={certificateState(original.dateExpiration)}>{value || 'Aucune'}</ObjectStatus>;
      },
    },
  ], []);

  const demandeRows = (demandes.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID,
    motif: item.motif || '-',
  }));

  const certificatRows = (certificats.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID,
    organisme: item.organisme || '-',
  }));

  return (
    <DynamicPage
      headerPinned
      titleArea={
        <DynamicPageTitle
          heading={<Title>Pilotage conges et certificats</Title>}
          subheading={<Text>Espace manager - demandes, certificats et KPI equipe</Text>}
          actionsBar={<Button design="Emphasized" icon="refresh" disabled={isLoading} onClick={refresh}>Actualiser</Button>}
        />
      }
      headerArea={
        <DynamicPageHeader>
          <FlexBox wrap="Wrap" gap="1rem">
            <KpiCard title="Demandes en attente" value={kpi.data?.demandesEnAttente ?? 0} subtitle="soumissions a traiter" />
            <KpiCard title="Absences en cours" value={kpi.data?.absencesEnCours ?? 0} subtitle="aujourd'hui" />
            <KpiCard title="Jours approuves" value={kpi.data?.joursApprouves ?? 0} subtitle="equipe" />
            <KpiCard title="Taux approbation" value={`${Math.round(kpi.data?.tauxApprobation ?? 0)}%`} subtitle="demandes decidees" />
            <KpiCard title="Certificats equipe" value={certificatRows.length} subtitle="declares" />
          </FlexBox>
        </DynamicPageHeader>
      }
    >
      <FlexBox direction="Column" gap="1rem" style={pagePadding}>
        {loadError ? <StatusPanel design="Negative" text={loadError} /> : null}
        {actionError ? <StatusPanel design="Negative" text={actionError} /> : null}

        <Card header={<CardHeader titleText="Demandes de conge de l'equipe" subtitleText={`${demandeRows.length} demandes`} />}>
          <TableShell loading={isLoading} empty={!demandeRows.length}>
            <AnalyticalTable data={demandeRows} columns={demandeColumns} visibleRows={10} filterable sortable />
          </TableShell>
        </Card>

        <Card header={<CardHeader titleText="Certificats de l'equipe" subtitleText={`${certificatRows.length} certificats`} />}>
          <TableShell loading={isLoading} empty={!certificatRows.length}>
            <AnalyticalTable data={certificatRows} columns={certificatColumns} visibleRows={8} filterable sortable />
          </TableShell>
        </Card>
      </FlexBox>
    </DynamicPage>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
  return (
    <Card header={<CardHeader titleText={title} />}>
      <div style={{ minWidth: '12rem', padding: '1rem' }}>
        <Title level="H2">{String(value)}</Title>
        <Label>{subtitle}</Label>
      </div>
    </Card>
  );
}

function StatusPanel({ design, text }: { design: 'Negative' | 'Information'; text: string }) {
  return (
    <div style={{ padding: '0.75rem 1rem', borderRadius: 4, border: '1px solid #d8e0e8', background: design === 'Negative' ? '#fff3f3' : '#f5f8fb' }}>
      <ObjectStatus state={design}>{text}</ObjectStatus>
    </div>
  );
}

function TableShell({ loading, empty, children }: { loading: boolean; empty: boolean; children: ReactNode }) {
  if (loading) return <StatusPanel design="Information" text="Chargement des donnees..." />;
  if (empty) return <StatusPanel design="Information" text="Aucune donnee disponible." />;
  return <div style={{ overflowX: 'auto' }}>{children}</div>;
}
