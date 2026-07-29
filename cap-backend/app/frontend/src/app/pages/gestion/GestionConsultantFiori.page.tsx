import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AnalyticalTable,
  Bar,
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
import {
  GestionCongesCertificatsAPI,
  type CertificatGcc,
  type CreateCertificatInput,
  type CreateDemandeCongeInput,
  type DemandeConge,
} from '../../services/odata/gestionCongesCertificatsApi';

const pagePadding = { padding: '1rem', boxSizing: 'border-box' as const };
const sectionStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(18rem, 1fr))', gap: '1rem' };
const formGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.75rem', padding: '1rem' };
const fieldStyle = { display: 'grid', gap: '0.35rem' };
const inputStyle = { minHeight: '2.25rem', border: '1px solid #c9d3df', borderRadius: 4, padding: '0 0.65rem', background: 'white' };

const initialLeaveForm: CreateDemandeCongeInput = {
  typeConge_ID: '',
  dateDebut: '',
  dateFin: '',
  motif: '',
};

const initialCertificateForm: CreateCertificatInput = {
  domaine_ID: '',
  intitule: '',
  organisme: '',
  identifiantCertificat: '',
  dateObtention: '',
  dateExpiration: '',
  score: '',
};

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
  const alerts = (certificats.data ?? []).filter((item) => isExpiringSoon(item.dateExpiration));
  const isLoading = profil.isLoading || demandes.isLoading || certificats.isLoading || types.isLoading || domaines.isLoading;
  const loadError = [profil.error, demandes.error, certificats.error, types.error, domaines.error].map(messageFromError).find(Boolean);

  const demandeColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Type', accessor: 'typeLabel', minWidth: 170 },
    { Header: 'Debut', accessor: 'dateDebut', width: 120 },
    { Header: 'Fin', accessor: 'dateFin', width: 120 },
    { Header: 'Jours', accessor: 'nbJours', width: 85 },
    {
      Header: 'Statut',
      accessor: 'statut',
      width: 130,
      Cell: ({ value }) => <ObjectStatus inverted state={statusState(String(value))}>{String(value)}</ObjectStatus>,
    },
    { Header: 'Commentaire manager', accessor: 'commentaireManager', minWidth: 220 },
    {
      Header: 'Action',
      accessor: 'ID',
      disableSortBy: true,
      width: 120,
      Cell: ({ row }) => {
        const original = row.original as DemandeConge;
        const canCancel = original.statut === 'SOUMISE' || original.statut === 'APPROUVEE';
        return canCancel ? (
          <Button design="Negative" disabled={annuler.isPending} onClick={() => annuler.mutate(original.ID)}>
            Annuler
          </Button>
        ) : <Text>-</Text>;
      },
    },
  ], [annuler]);

  const certificatColumns = useMemo<AnalyticalTableColumnDefinition[]>(() => [
    { Header: 'Intitule', accessor: 'intitule', minWidth: 220 },
    { Header: 'Domaine', accessor: 'domaineLabel', minWidth: 160 },
    { Header: 'Organisme', accessor: 'organisme', minWidth: 150 },
    { Header: 'Obtention', accessor: 'dateObtention', width: 130 },
    {
      Header: 'Expiration',
      accessor: 'dateExpiration',
      width: 145,
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

  const submitLeave = (event: FormEvent) => {
    event.preventDefault();
    creerDemande.mutate({
      ...leaveForm,
      motif: leaveForm.motif?.trim() || undefined,
    });
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
    <DynamicPage
      headerPinned
      titleArea={
        <DynamicPageTitle
          heading={<Title>Gestion des conges et certificats</Title>}
          subheading={<Text>{employe ? `${employe.prenom} ${employe.nom} - ${employe.poste ?? 'Consultant technique'}` : 'Espace consultant'}</Text>}
          actionsBar={<Button design="Emphasized" icon="refresh" disabled={isLoading} onClick={refresh}>Actualiser</Button>}
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
      <FlexBox direction="Column" gap="1rem" style={pagePadding}>
        {loadError ? <StatusPanel design="Negative" text={loadError} /> : null}
        {creerDemande.error ? <StatusPanel design="Negative" text={messageFromError(creerDemande.error)} /> : null}
        {creerCertificat.error ? <StatusPanel design="Negative" text={messageFromError(creerCertificat.error)} /> : null}
        {annuler.error ? <StatusPanel design="Negative" text={messageFromError(annuler.error)} /> : null}

        <div style={sectionStyle}>
          <Card header={<CardHeader titleText="Nouvelle demande de conge" />}>
            <form onSubmit={submitLeave} style={formGridStyle}>
              <Field label="Type">
                <select
                  required
                  value={leaveForm.typeConge_ID}
                  onChange={(event) => setLeaveForm((current) => ({ ...current, typeConge_ID: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Choisir un type</option>
                  {typeOptions.map((item) => <option key={item.ID} value={item.ID}>{item.libelle}</option>)}
                </select>
              </Field>
              <Field label="Date debut">
                <input required type="date" value={leaveForm.dateDebut} onChange={(event) => setLeaveForm((current) => ({ ...current, dateDebut: event.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Date fin">
                <input required type="date" value={leaveForm.dateFin} onChange={(event) => setLeaveForm((current) => ({ ...current, dateFin: event.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Motif">
                <input value={leaveForm.motif} onChange={(event) => setLeaveForm((current) => ({ ...current, motif: event.target.value }))} style={inputStyle} />
              </Field>
              <Bar design="Footer" endContent={<Button submits design="Emphasized" disabled={creerDemande.isPending}>Soumettre</Button>} />
            </form>
          </Card>

          <Card header={<CardHeader titleText="Nouveau certificat" />}>
            <form onSubmit={submitCertificate} style={formGridStyle}>
              <Field label="Domaine">
                <select
                  required
                  value={certificateForm.domaine_ID}
                  onChange={(event) => setCertificateForm((current) => ({ ...current, domaine_ID: event.target.value }))}
                  style={inputStyle}
                >
                  <option value="">Choisir un domaine</option>
                  {domaineOptions.map((item) => <option key={item.ID} value={item.ID}>{item.libelle}</option>)}
                </select>
              </Field>
              <Field label="Intitule">
                <input required value={certificateForm.intitule} onChange={(event) => setCertificateForm((current) => ({ ...current, intitule: event.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Organisme">
                <input value={certificateForm.organisme} onChange={(event) => setCertificateForm((current) => ({ ...current, organisme: event.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Obtention">
                <input required type="date" value={certificateForm.dateObtention} onChange={(event) => setCertificateForm((current) => ({ ...current, dateObtention: event.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Expiration">
                <input type="date" value={certificateForm.dateExpiration} onChange={(event) => setCertificateForm((current) => ({ ...current, dateExpiration: event.target.value }))} style={inputStyle} />
              </Field>
              <Field label="Score">
                <input value={certificateForm.score} onChange={(event) => setCertificateForm((current) => ({ ...current, score: event.target.value }))} style={inputStyle} />
              </Field>
              <Bar design="Footer" endContent={<Button submits design="Emphasized" disabled={creerCertificat.isPending}>Ajouter</Button>} />
            </form>
          </Card>
        </div>

        <Card header={<CardHeader titleText="Mes demandes de conge" subtitleText={`${demandeRows.length} demandes`} />}>
          <TableShell loading={isLoading} empty={!demandeRows.length}>
            <AnalyticalTable data={demandeRows} columns={demandeColumns} visibleRows={6} filterable sortable />
          </TableShell>
        </Card>
        <Card header={<CardHeader titleText="Mon portefeuille certificats" subtitleText={`${certificatRows.length} certificats`} />}>
          <TableShell loading={isLoading} empty={!certificatRows.length}>
            <AnalyticalTable data={certificatRows} columns={certificatColumns} visibleRows={6} filterable sortable />
          </TableShell>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={fieldStyle}>
      <Label>{label}</Label>
      {children}
    </label>
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
