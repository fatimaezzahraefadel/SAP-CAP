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
import { GestionCongesCertificatsAPI, type CertificatGcc, type DemandeConge } from '../../services/odata/gestionCongesCertificatsApi';

const statusState = (statut: string) => {
  if (statut === 'APPROUVEE') return 'Positive';
  if (statut === 'REJETEE') return 'Negative';
  if (statut === 'SOUMISE') return 'Critical';
  return 'None';
};

const isExpiringSoon = (date?: string) => {
  if (!date) return false;
  const diff = new Date(date).getTime() - Date.now();
  return diff >= 0 && diff <= 90 * 24 * 60 * 60 * 1000;
};

export function GestionConsultantFiori() {
  const queryClient = useQueryClient();
  const profil = useQuery({ queryKey: ['gcc', 'profil'], queryFn: GestionCongesCertificatsAPI.consultant.profil });
  const demandes = useQuery({ queryKey: ['gcc', 'mes-demandes'], queryFn: GestionCongesCertificatsAPI.consultant.demandes });
  const certificats = useQuery({ queryKey: ['gcc', 'mes-certificats'], queryFn: GestionCongesCertificatsAPI.consultant.certificats });
  const types = useQuery({ queryKey: ['gcc', 'types'], queryFn: GestionCongesCertificatsAPI.consultant.typesConge });
  const domaines = useQuery({ queryKey: ['gcc', 'domaines'], queryFn: GestionCongesCertificatsAPI.consultant.domaines });

  const annuler = useMutation({
    mutationFn: GestionCongesCertificatsAPI.consultant.annulerDemande,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gcc'] }),
  });

  const employe = profil.data?.[0];
  const typeById = useMemo(() => new Map((types.data ?? []).map((item) => [item.ID, item.libelle])), [types.data]);
  const domaineById = useMemo(() => new Map((domaines.data ?? []).map((item) => [item.ID, item.libelle])), [domaines.data]);
  const alerts = (certificats.data ?? []).filter((item) => isExpiringSoon(item.dateExpiration));

  const demandeColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Type', accessor: 'typeLabel' },
    { Header: 'Debut', accessor: 'dateDebut' },
    { Header: 'Fin', accessor: 'dateFin' },
    { Header: 'Jours', accessor: 'nbJours', width: 90 },
    {
      Header: 'Statut',
      accessor: 'statut',
      Cell: ({ value }) => <ObjectStatus inverted state={statusState(value)}>{value}</ObjectStatus>,
    },
    { Header: 'Commentaire manager', accessor: 'commentaireManager' },
    {
      Header: 'Action',
      accessor: 'ID',
      disableSortBy: true,
      Cell: ({ row }) => {
        const original = row.original as DemandeConge;
        const canCancel = original.statut === 'SOUMISE' || original.statut === 'APPROUVEE';
        return canCancel ? <Button design="Negative" onClick={() => annuler.mutate(original.ID)}>Annuler</Button> : <Text>-</Text>;
      },
    },
  ], [annuler]);

  const certificatColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Intitule', accessor: 'intitule' },
    { Header: 'Domaine', accessor: 'domaineLabel' },
    { Header: 'Organisme', accessor: 'organisme' },
    { Header: 'Obtention', accessor: 'dateObtention' },
    {
      Header: 'Expiration',
      accessor: 'dateExpiration',
      Cell: ({ row, value }) => {
        const original = row.original as CertificatGcc;
        return <ObjectStatus state={isExpiringSoon(original.dateExpiration) ? 'Critical' : 'None'}>{value || 'Aucune'}</ObjectStatus>;
      },
    },
  ], []);

  const demandeRows = (demandes.data ?? []).map((item) => ({
    ...item,
    typeLabel: typeById.get(item.typeConge_ID) ?? item.typeConge_ID,
    commentaireManager: item.commentaireManager || '-',
  }));

  const certificatRows = (certificats.data ?? []).map((item) => ({
    ...item,
    domaineLabel: domaineById.get(item.domaine_ID) ?? item.domaine_ID,
    organisme: item.organisme || '-',
  }));

  return (
    <DynamicPage
      headerPinned
      titleArea={
        <DynamicPageTitle
          heading={<Title>Gestion des conges et certificats</Title>}
          subheading={<Text>{employe ? `${employe.prenom} ${employe.nom} - ${employe.poste ?? 'Consultant technique'}` : 'Espace consultant'}</Text>}
          actionsBar={<Button design="Emphasized" icon="refresh" onClick={() => queryClient.invalidateQueries({ queryKey: ['gcc'] })}>Actualiser</Button>}
        />
      }
      headerArea={
        <DynamicPageHeader>
          <FlexBox wrap="Wrap" gap="1rem">
            <KpiCard title="Solde restant" value={employe?.soldeConges ?? '-'} subtitle="jours de conges" />
            <KpiCard title="Demandes soumises" value={(demandes.data ?? []).filter((item) => item.statut === 'SOUMISE').length} subtitle="en attente manager" />
            <KpiCard title="Certificats a renouveler" value={alerts.length} subtitle="expiration sous 90 jours" />
          </FlexBox>
        </DynamicPageHeader>
      }
    >
      <FlexBox direction="Column" gap="1rem" style={{ padding: '1rem' }}>
        <Card header={<CardHeader titleText="Mes demandes de conge" />}>
          <AnalyticalTable data={demandeRows} columns={demandeColumns} visibleRows={6} filterable sortable />
        </Card>
        <Card header={<CardHeader titleText="Mon portefeuille certificats" />}>
          <AnalyticalTable data={certificatRows} columns={certificatColumns} visibleRows={6} filterable sortable />
        </Card>
      </FlexBox>
    </DynamicPage>
  );
}

function KpiCard({ title, value, subtitle }: { title: string; value: string | number; subtitle: string }) {
  return (
    <Card header={<CardHeader titleText={title} />}>
      <div style={{ minWidth: '14rem', padding: '1rem' }}>
        <Title level="H2">{String(value)}</Title>
        <Label>{subtitle}</Label>
      </div>
    </Card>
  );
}
