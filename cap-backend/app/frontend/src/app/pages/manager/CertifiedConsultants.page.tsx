import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../components/common/PageHeader';
import { CertificatesAPI } from '../../services/odata/certificatesApi';
import { UsersAPI } from '../../services/odata/usersApi';
import { Certification, CertificationStatus, User } from '../../types/entities';
import { Award } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
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

const statusColor: Record<CertificationStatus, string> = {
  VALID: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  EXPIRING_SOON: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  EXPIRED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

interface CertRow {
  consultantName: string;
  cert: Certification & { userId: string };
}

export const CertifiedConsultants: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<CertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CertificationStatus | 'ALL'>('ALL');

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [certs, users] = await Promise.all([
        CertificatesAPI.getAll(),
        UsersAPI.getAll(),
      ]);

      const userMap = new Map<string, User>(users.map((u) => [u.id, u]));
      const consultantRoles = new Set(['CONSULTANT_TECHNIQUE', 'CONSULTANT_FONCTIONNEL', 'DEV_COORDINATOR', 'PROJECT_MANAGER']);

      const mapped: CertRow[] = certs
        .filter((c) => {
          const user = userMap.get(c.userId);
          return user && consultantRoles.has(user.role);
        })
        .map((c) => ({
          consultantName: userMap.get(c.userId)?.name ?? c.userId,
          cert: c,
        }));

      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(({ consultantName, cert }) => {
      if (statusFilter !== 'ALL' && cert.status !== statusFilter) return false;
      if (
        q &&
        !cert.name.toLowerCase().includes(q) &&
        !consultantName.toLowerCase().includes(q) &&
        !cert.issuingBody.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const certCount = filtered.length;
  const validCount = filtered.filter((r) => r.cert.status === 'VALID').length;
  const expiringCount = filtered.filter((r) => r.cert.status === 'EXPIRING_SOON').length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={t('dashboard.certifications.title')}
        subtitle={t('dashboard.certifications.subtitle')}
        breadcrumbs={[
          { label: t('documentation.home'), path: '/manager/dashboard' },
          { label: t('dashboard.certifications.title') },
        ]}
      />

      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-primary">{certCount}</div>
            <div className="text-xs text-muted-foreground">
              {t('dashboard.certifications.stats.total')}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-green-600">{validCount}</div>
            <div className="text-xs text-muted-foreground">
              {t('dashboard.certifications.stats.valid')}
            </div>
          </div>
          <div className="bg-card border border-border rounded-lg p-4 text-center">
            <div className="text-2xl font-semibold text-yellow-600">{expiringCount}</div>
            <div className="text-xs text-muted-foreground">
              {t('dashboard.certifications.stats.expiring')}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Input
            placeholder={t('dashboard.certifications.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={t('dashboard.leaves.filters.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('dashboard.certifications.filters.allStatuses')}</SelectItem>
              <SelectItem value="VALID">{t('entities.certificationStatus.VALID')}</SelectItem>
              <SelectItem value="EXPIRING_SOON">
                {t('entities.certificationStatus.EXPIRING_SOON')}
              </SelectItem>
              <SelectItem value="EXPIRED">{t('entities.certificationStatus.EXPIRED')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-muted-foreground">{t('documentation.loading')}</p>
        ) : (
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="px-4">
                    {t('dashboard.certifications.table.consultant')}
                  </TableHead>
                  <TableHead className="px-4">
                    {t('dashboard.certifications.table.certification')}
                  </TableHead>
                  <TableHead className="px-4">
                    {t('dashboard.certifications.table.issuingBody')}
                  </TableHead>
                  <TableHead className="px-4">
                    {t('dashboard.certifications.table.obtained')}
                  </TableHead>
                  <TableHead className="px-4">{t('dashboard.certifications.table.expires')}</TableHead>
                  <TableHead className="px-4">{t('dashboard.leaves.filters.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(({ consultantName, cert }, i) => (
                  <TableRow key={`${cert.id}-${i}`}>
                    <TableCell className="px-4 py-3 font-medium">{consultantName}</TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <Award className="h-4 w-4 text-primary" />
                        {cert.name}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                      {cert.issuingBody}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {cert.dateObtained ? new Date(cert.dateObtained).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm">
                      {cert.expiryDate ? new Date(cert.expiryDate).toLocaleDateString() : '-'}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className={statusColor[cert.status]}>
                        {t(`entities.certificationStatus.${cert.status}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t('dashboard.certifications.table.noCerts')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};
