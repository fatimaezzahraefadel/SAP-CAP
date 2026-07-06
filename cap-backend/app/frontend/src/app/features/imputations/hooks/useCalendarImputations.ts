import { useState, useMemo, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/context/AuthContext';
import { useImputations, useImputationPeriods, useTickets, useUsers, imputationKeys } from '../queries';
import { getPeriodKey, getPeriodRange, generateCalendarDays, formatPeriodLabel } from '../model';
import { ImputationsAPI } from '@/app/services/odata/imputationsApi';
import { ImputationPeriodsAPI } from '@/app/services/odata/imputationPeriodsApi';
import { toast } from 'sonner';
import { Imputation, ImputationPeriod } from '@/app/types/entities';
import { ImputationFormValues } from '../schema';

export interface CurrentPeriodEntry {
  key: string;
  label: string;
}

export interface PeriodData {
  period: ImputationPeriod | undefined;
  imputations: Imputation[];
  totalHours: number;
}

const asHours = (value: unknown): number => {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours : 0;
};

export const useCalendarImputations = (canImpute: boolean, _canValidate: boolean) => {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const userId = currentUser?.id;
  const isGlobal = !canImpute;

  const { data: imputations = [], isLoading: loadingImps } = useImputations(userId, isGlobal);
  const { data: periods = [], isLoading: loadingPeriods } = useImputationPeriods(userId, isGlobal);
  const { data: tickets = [], isLoading: loadingTickets } = useTickets();
  const { data: users = [], isLoading: loadingUsers } = useUsers();

  const loading = loadingImps || loadingPeriods || loadingTickets || loadingUsers;

  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [selectedDate, setSelectedDate] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const calendarDays = useMemo(() => generateCalendarDays(calendarMonth), [calendarMonth]);

  const imputationsByDate = useMemo(() => {
    const map: Record<string, Imputation[]> = {};
    imputations.forEach((imp) => {
      if (!map[imp.date]) map[imp.date] = [];
      map[imp.date].push(imp);
    });
    return map;
  }, [imputations]);

  const hoursByDate = useMemo(() => {
    const map: Record<string, number> = {};
    imputations.forEach((imp) => {
      map[imp.date] = (map[imp.date] || 0) + asHours(imp.hours);
    });
    return map;
  }, [imputations]);

  const currentPeriods = useMemo(() => {
    const [y, m] = calendarMonth.split('-');
    return [
      { key: `${y}-${m}-H1`, label: formatPeriodLabel(`${y}-${m}-H1`) },
      { key: `${y}-${m}-H2`, label: formatPeriodLabel(`${y}-${m}-H2`) },
    ];
  }, [calendarMonth]);

  const periodData = useCallback((key: string): PeriodData => {
    const p = periods.find((pd) => pd.periodKey === key && (canImpute ? pd.consultantId === userId : true));
    const periodImps = imputations.filter((i) => i.periodKey === key && (canImpute ? i.consultantId === userId : true));
    const totalHours = periodImps.reduce((s, i) => s + asHours(i.hours), 0);
    return { period: p, imputations: periodImps, totalHours };
  }, [periods, imputations, canImpute, userId]);

  const reviewPeriods = useMemo(() => {
    return periods
      .filter((period) => period.periodKey.startsWith(calendarMonth))
      .sort((a, b) => `${a.periodKey}-${a.consultantId}`.localeCompare(`${b.periodKey}-${b.consultantId}`));
  }, [periods, calendarMonth]);

  const periodImputations = useCallback((period: ImputationPeriod) => {
    return imputations.filter((imp) => imp.periodKey === period.periodKey && imp.consultantId === period.consultantId);
  }, [imputations]);

  const prevMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const nextMonth = () => {
    const [y, m] = calendarMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const openAddDialog = (date: string) => {
    setSelectedDate(date);
    setShowAddDialog(true);
  };

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: imputationKeys.all });
    queryClient.invalidateQueries({ queryKey: imputationKeys.periods });
  };

  const addImputation = async (values: ImputationFormValues) => {
    if (!currentUser) return;
    const ticket = tickets.find((t) => t.id === values.ticketId);
    if (!ticket) return;

    try {
      await ImputationsAPI.create({
        consultantId: currentUser.id,
        ticketId: values.ticketId,
        projectId: ticket.projectId,
        module: ticket.module ?? 'OTHER',
        date: selectedDate,
        hours: values.hours,
        description: values.description,
        validationStatus: 'DRAFT',
        periodKey: getPeriodKey(selectedDate),
      });
      invalidateQueries();
      setShowAddDialog(false);
      toast.success('Imputation added');
    } catch {
      toast.error('Failed to add imputation');
    }
  };

  const submitPeriod = async (periodKey: string) => {
    if (!currentUser) return;
    const existing = periods.find((p) => p.periodKey === periodKey && p.consultantId === currentUser.id);
    const range = getPeriodRange(periodKey);
    const periodImps = imputations.filter((i) => i.periodKey === periodKey && i.consultantId === currentUser.id);
    const totalHours = periodImps.reduce((s, i) => s + asHours(i.hours), 0);

    try {
      if (existing) {
        await ImputationPeriodsAPI.submit(existing.id);
      } else {
        await ImputationPeriodsAPI.create({
          periodKey,
          consultantId: currentUser.id,
          startDate: range.start,
          endDate: range.end,
          status: 'SUBMITTED',
          totalHours,
          submittedAt: new Date().toISOString(),
        });
      }
      invalidateQueries();
      toast.success(`Period submitted`);
    } catch {
      toast.error('Failed to submit period');
    }
  };

  const validatePeriod = async (period: ImputationPeriod) => {
    if (!currentUser) return;
    try {
      await ImputationPeriodsAPI.validate(period.id, currentUser.id);
      invalidateQueries();
      toast.success(`Period validated`);
    } catch {
      toast.error('Failed to validate period');
    }
  };

  const rejectPeriod = async (period: ImputationPeriod) => {
    if (!currentUser) return;
    try {
      await ImputationPeriodsAPI.rejectEntry(period.id, currentUser.id);
      invalidateQueries();
      toast.success(`Period rejected`);
    } catch {
      toast.error('Failed to reject period');
    }
  };

  const sendPeriodToStraTIME = async (period: ImputationPeriod) => {
    if (!currentUser) return;
    try {
      // 1. Retrieve all imputations for this period
      const imps = periodImputations(period);
      
      if (imps.length === 0) {
        toast.error('No imputations found for this period to export.');
        return;
      }

      // 2. Format imputations into a CSV string
      const csvHeaders = ['Date', 'Ticket ID', 'Project ID', 'Hours', 'Description'];
      const csvRows = imps.map(i => {
        // Escape quotes in description and wrap in quotes to handle commas
        const desc = i.description ? `"${i.description.replace(/"/g, '""')}"` : '""';
        return `${i.date},${i.ticketId},${i.projectId},${i.hours},${desc}`;
      });
      
      const csvContent = [csvHeaders.join(','), ...csvRows].join('\n');
      
      // 3. Trigger file download in the browser
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `stratime_export_${period.periodKey}_${period.consultantId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // 4. Update the database status to 'Sent to StraTIME'
      await ImputationPeriodsAPI.sendToStraTIME(period.id, currentUser.id);
      invalidateQueries();
      toast.success(`Period sent to Stratime and CSV downloaded`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send period to Stratime');
    }
  };

  const totalHoursThisMonth = useMemo(() => {
    const prefix = calendarMonth;
    return imputations
      .filter((i) => i.date.startsWith(prefix) && (canImpute ? i.consultantId === currentUser?.id : true))
      .reduce((s, i) => s + asHours(i.hours), 0);
  }, [imputations, calendarMonth, canImpute, currentUser]);

  const validatedHoursThisMonth = useMemo(() => {
    return imputations
      .filter((i) => i.validationStatus === 'VALIDATED' && (canImpute ? i.consultantId === currentUser?.id : true))
      .reduce((s, i) => s + asHours(i.hours), 0);
  }, [imputations, canImpute, currentUser]);

  const stratimeHoursThisMonth = useMemo(() => {
    return periods
      .filter((period) => period.periodKey.startsWith(calendarMonth) && period.sentToStraTIME)
      .reduce((sum, period) => sum + asHours(period.totalHours), 0);
  }, [periods, calendarMonth]);

  return {
    loading,
    tickets,
    users,
    imputationsByDate,
    hoursByDate,
    calendarMonth,
    calendarDays,
    currentPeriods,
    reviewPeriods,
    selectedDate,
    showAddDialog,
    setShowAddDialog,
    totalHoursThisMonth,
    validatedHoursThisMonth,
    stratimeHoursThisMonth,
    periodData,
    periodImputations,
    prevMonth,
    nextMonth,
    openAddDialog,
    addImputation,
    submitPeriod,
    validatePeriod,
    rejectPeriod,
    sendPeriodToStraTIME,
    myTickets: tickets.filter((t) => t.assignedTo === userId && t.status !== 'DONE' && t.status !== 'REJECTED'),
  };
};
