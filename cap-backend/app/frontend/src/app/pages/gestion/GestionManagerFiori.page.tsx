import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { AnalyticalTableColumnDefinition } from '@ui5/webcomponents-react';
import { GestionCongesCertificatsAPI, type DemandeConge } from '../../services/odata/gestionCongesCertificatsApi';

const statusState = (statut: string) => {
  if (statut === 'APPROUVEE') return 'Positive';
  if (statut === 'REJETEE') return 'Negative';
  if (statut === 'SOUMISE') return 'Critical';
  return 'None';
};

export function GestionManagerFiori() {
  const queryClient = useQueryClient();
  const demandes = useQuery({ queryKey: ['gcc-manager', 'demandes'], queryFn: GestionCongesCertificatsAPI.manager.demandes });
  const consultants = useQuery({ queryKey: ['gcc-manager', 'consultants'], queryFn: GestionCongesCertificatsAPI.manager.consultants });
  const certificats = useQuery({ queryKey: ['gcc-manager', 'certificats'], queryFn: GestionCongesCertificatsAPI.manager.certificats });
  const kpi = useQuery({ queryKey: ['gcc-manager', 'kpi'], queryFn: GestionCongesCertificatsAPI.manager.kpiConges });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['gcc-manager'] });
  const approuver = useMutation({ mutationFn: (id: string) => GestionCongesCertificatsAPI.manager.approuverDemande(id), onSuccess: refresh });
  const rejeter = useMutation({ mutationFn: (id: string) => GestionCongesCertificatsAPI.manager.rejeterDemande(id, 'Rejete par le manager'), onSuccess: refresh });

  const consultantById = useMemo(() => new Map((consultants.data ?? []).map((item) => [item.ID, `${item.prenom} ${item.nom}`])), [consultants.data]);

  const demandeColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Consultant', accessor: 'consultantLabel' },
    { Header: 'Debut', accessor: 'dateDebut' },
    { Header: 'Fin', accessor: 'dateFin' },
    { Header: 'Jours', accessor: 'nbJours', width: 90 },
    { Header: 'Motif', accessor: 'motif' },
    {
      Header: 'Statut',
      accessor: 'statut',
      Cell: ({ value }) => <ObjectStatus inverted state={statusState(value)}>{value}</ObjectStatus>,
    },
    {
      Header: 'Actions',
      accessor: 'ID',
      disableSortBy: true,
      width: 220,
      Cell: ({ row }) => {
        const original = row.original as DemandeConge;
        return original.statut === 'SOUMISE' ? (
          <FlexBox gap="0.5rem">
            <Button design="Positive" onClick={() => approuver.mutate(original.ID)}>Approuver</Button>
            <Button design="Negative" onClick={() => rejeter.mutate(original.ID)}>Rejeter</Button>
          </FlexBox>
        ) : <Text>-</Text>;
      },
    },
  ], [approuver, rejeter]);

  const demandeRows = (demandes.data ?? []).map((item) => ({
    ...item,
    consultantLabel: consultantById.get(item.consultant_ID) ?? item.consultant_ID,
    motif: item.motif || '-',
  }));

  return (
    <DynamicPage
      headerPinned
      titleArea={
        <DynamicPageTitle
          heading={<Title>Pilotage conges et certificats</Title>}
          subheading={<Text>Espace manager - ConsultantService et ManagerService SAP CAP</Text>}
          actionsBar={<Button design="Emphasized" icon="refresh" onClick={refresh}>Actualiser</Button>}
        />
      }
      headerArea={
        <DynamicPageHeader>
          <FlexBox wrap="Wrap" gap="1rem">
            <KpiCard title="Demandes en attente" value={kpi.data?.demandesEnAttente ?? 0} subtitle="soumissions a traiter" />
            <KpiCard title="Absences en cours" value={kpi.data?.absencesEnCours ?? 0} subtitle="aujourd'hui" />
            <KpiCard title="Jours approuves" value={kpi.data?.joursApprouves ?? 0} subtitle="equipe" />
            <KpiCard title="Certificats equipe" value={certificats.data?.length ?? 0} subtitle="declares" />
          </FlexBox>
        </DynamicPageHeader>
      }
    >
      <FlexBox direction="Column" gap="1rem" style={{ padding: '1rem' }}>
        <Card header={<CardHeader titleText="Demandes de conge de l'equipe" subtitleText={`${demandes.data?.length ?? 0} demandes`} />}>
          <AnalyticalTable data={demandeRows} columns={demandeColumns} visibleRows={10} filterable sortable />
        </Card>
      </FlexBox>
    </DynamicPage>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
  return (
    <Card header={<CardHeader titleText={title} />}>
      <div style={{ minWidth: '13rem', padding: '1rem' }}>
        <Title level="H2">{String(value)}</Title>
        <Label>{subtitle}</Label>
      </div>
    </Card>
  );
}
