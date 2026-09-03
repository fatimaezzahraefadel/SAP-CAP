import React from 'react';
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Gauge,
  History,
  ListTodo,
  Siren,
  TrendingUp,
  Users,
  ArrowDownRight,
  ArrowUpRight,
  LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useTranslation } from 'react-i18next';
import { cn } from '../ui/utils';

export type KPITone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  unit?: string;
  icon?: string | LucideIcon;
  variant?: 'default' | 'info' | 'warning' | 'danger' | 'success';
  color?: string;
  progress?: number;
  trend?: 'Up' | 'Down' | 'None';
  state?: string;
  target?: string | number;
  deviation?: string;
}

const iconMap: Record<string, LucideIcon> = {
  group: Users,
  task: ListTodo,
  'project-definition-triangle-2': FolderKanban,
  alert: AlertTriangle,
  warning: AlertTriangle,
  timesheet: Clock3,
  'trend-up': TrendingUp,
  document: FileText,
  accept: CheckCircle2,
  incident: Siren,
  history: History,
  performance: Gauge,
  'business-objects-experience': BriefcaseBusiness,
};

const resolveSemanticColor = (token?: string): { bg: string; text: string; bar: string } => {
  const t = (token ?? '').toLowerCase();

  if (t.includes('error') || t.includes('negative') || t.includes('danger') || t.includes('red')) {
    return { bg: 'bg-destructive/10', text: 'text-destructive', bar: 'bg-destructive' };
  }
  if (t.includes('critical') || t.includes('warning') || t.includes('amber') || t.includes('orange') || t.includes('yellow')) {
    return { bg: 'bg-warning/10', text: 'text-warning', bar: 'bg-warning' };
  }
  if (t.includes('good') || t.includes('positive') || t.includes('success') || t.includes('green')) {
    return { bg: 'bg-success/10', text: 'text-success', bar: 'bg-success' };
  }
  if (t.includes('info') || t.includes('blue') || t.includes('indigo')) {
    return { bg: 'bg-info/10', text: 'text-info', bar: 'bg-info' };
  }

  return { bg: 'bg-primary/10', text: 'text-primary', bar: 'bg-primary' };
};

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  unit,
  icon,
  variant = 'default',
  color,
  progress,
  trend = 'None',
  state,
  target,
  deviation,
}) => {
  const { t } = useTranslation();
  const Icon = typeof icon === 'string' ? iconMap[icon] : icon;

  const variantState =
    state ??
    ({
      default: 'neutral',
      info: 'info',
      warning: 'warning',
      danger: 'error',
      success: 'good',
    }[variant]);

  const semantic = resolveSemanticColor(color ?? variantState);

  const numericValue = typeof value === 'number' ? value : Number(value);
  const numericTarget = typeof target === 'number' ? target : Number(target);

  const calculatedProgress = progress !== undefined
    ? progress
    : (Number.isFinite(numericValue) && Number.isFinite(numericTarget) && numericTarget > 0)
      ? (numericValue / numericTarget) * 100
      : undefined;

  const clampedProgress =
    calculatedProgress !== undefined ? Math.max(0, Math.min(100, calculatedProgress)) : undefined;

  return (
    <Card className="border-border bg-card transition-colors hover:border-primary/30">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {title}
            </p>
            {subtitle && <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {Icon && (
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md',
                semantic.bg,
                semantic.text
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {value}
          </span>
          {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
          {trend !== 'None' && (
            <span className="ml-1">
              {trend === 'Up' ? (
                <ArrowUpRight className={cn('h-4 w-4', semantic.text)} />
              ) : (
                <ArrowDownRight className="h-4 w-4 text-destructive" />
              )}
            </span>
          )}
        </div>

        {(deviation || target !== undefined) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {deviation && <Badge variant="secondary" className="font-normal">{deviation}</Badge>}
            {target !== undefined && <span>{t('common.targetWithValue', { value: target })}</span>}
          </div>
        )}

        {clampedProgress !== undefined && (
          <div className="space-y-1.5">
            {target !== undefined && (
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
                <span>{t('common.progressToTarget')}</span>
                <span>{Math.round(clampedProgress)}%</span>
              </div>
            )}
            <div className={cn('h-1 w-full overflow-hidden rounded-full', semantic.bg)}>
              <div
                className={cn('h-full rounded-full transition-all duration-500', semantic.bar)}
                style={{ width: `${clampedProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
