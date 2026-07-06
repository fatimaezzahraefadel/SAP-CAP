import React from 'react';
import { Clock, CalendarDays, CheckCircle2, Send } from 'lucide-react';
import { Badge } from '@/app/components/ui/badge';
import { IMPUTATION_VALIDATION_LABELS, ImputationPeriod } from '@/app/types/entities';
import { validationColor } from '../model';
import { CurrentPeriodEntry, PeriodData } from '../hooks/useCalendarImputations';

interface ImputationStatsCardsProps {
  totalHoursThisMonth: number;
  validatedHoursThisMonth: number;
  stratimeHoursThisMonth: number;
  currentPeriods: CurrentPeriodEntry[];
  periodData: (key: string) => PeriodData;
  canValidate: boolean;
  periods: ImputationPeriod[];
}

const formatHours = (value: number): string => {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '0h';
  return `${Number.isInteger(hours) ? hours : hours.toFixed(2).replace(/\.?0+$/, '')}h`;
};

export const ImputationStatsCards: React.FC<ImputationStatsCardsProps> = ({
  totalHoursThisMonth,
  validatedHoursThisMonth,
  stratimeHoursThisMonth,
  currentPeriods,
  periodData,
  canValidate,
  periods,
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Clock className="h-4 w-4" /> Total This Month
        </div>
        <p className="text-2xl font-bold">{formatHours(totalHoursThisMonth)}</p>
      </div>
      {currentPeriods.map((cp) => {
        const pd = periodData(cp.key);
        const periodEntries = periods.filter((period) => period.periodKey === cp.key);
        return (
          <div key={cp.key} className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <CalendarDays className="h-4 w-4" /> {cp.label}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-bold">{formatHours(pd.totalHours)}</p>
              {canValidate ? (
                <Badge variant="outline">{periodEntries.length} period(s)</Badge>
              ) : pd.period ? (
                <Badge className={validationColor[pd.period.status]}>
                  {IMPUTATION_VALIDATION_LABELS[pd.period.status as keyof typeof IMPUTATION_VALIDATION_LABELS]}
                </Badge>
              ) : pd.totalHours > 0 ? (
                <Badge className={validationColor['DRAFT']}>Draft</Badge>
              ) : null}
            </div>
          </div>
        );
      })}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Validated
        </div>
        <p className="text-2xl font-bold">{formatHours(validatedHoursThisMonth)}</p>
      </div>
      {canValidate && (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Send className="h-4 w-4 text-blue-500" /> Sent to Stratime
          </div>
          <p className="text-2xl font-bold">{formatHours(stratimeHoursThisMonth)}</p>
        </div>
      )}
    </div>
  );
};
