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
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { useTranslation } from 'react-i18next';

export type KPITone = 'positive' | 'negative' | 'warning' | 'neutral';

export interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  unit?: string;
  icon?: string | LucideIcon;
  variant?: 'default' | 'info' | 'warning' | 'danger' | 'success';
  color?: string; // Legacy support
  progress?: number;
  trend?: 'Up' | 'Down' | 'None';
  state?: string; // e.g., 'Positive', 'Error', 'Good'
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

/** Vibrant gradient palette shared by every dashboard KPI card. */
type PaletteKey =
  | 'teal'
  | 'blue'
  | 'indigo'
  | 'green'
  | 'amber'
  | 'orange'
  | 'purple'
  | 'red'
  | 'pink';

interface Palette {
  from: string;
  to: string;
}

const PALETTES: Record<PaletteKey, Palette> = {
  teal: { from: '#00b3a4', to: '#22d3c5' },
  blue: { from: '#2563eb', to: '#5b9dff' },
  indigo: { from: '#4f46e5', to: '#8b7dff' },
  green: { from: '#059669', to: '#22d38a' },
  amber: { from: '#d97706', to: '#fbbf24' },
  orange: { from: '#ea580c', to: '#fb923c' },
  purple: { from: '#7c3aed', to: '#b06bf7' },
  red: { from: '#dc2626', to: '#f65a6f' },
  pink: { from: '#db2777', to: '#f472b6' },
};

/** Maps a state/variant/color token to one of the vibrant palettes. */
const resolvePalette = (token?: string): Palette => {
  const t = (token ?? '').toLowerCase();

  // Explicit colour names take precedence (passed by several dashboards).
  if (t === 'blue') return PALETTES.blue;
  if (t === 'indigo') return PALETTES.indigo;
  if (t === 'green') return PALETTES.green;
  if (t === 'yellow' || t === 'amber') return PALETTES.amber;
  if (t === 'orange') return PALETTES.orange;
  if (t === 'purple') return PALETTES.purple;
  if (t === 'red') return PALETTES.red;
  if (t === 'pink') return PALETTES.pink;
  if (t === 'teal' || t === 'primary') return PALETTES.teal;

  // Semantic states / variants.
  if (t.includes('error') || t.includes('negative') || t.includes('danger')) return PALETTES.red;
  if (t.includes('critical') || t.includes('warning')) return PALETTES.amber;
  if (t.includes('good') || t.includes('positive') || t.includes('success')) return PALETTES.green;
  if (t.includes('info')) return PALETTES.blue;

  return PALETTES.teal;
};

/** Converts a #rrggbb hex to an rgba() string with the given alpha. */
const rgba = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  // An explicit colour name wins; otherwise fall back to the semantic state.
  const palette = resolvePalette(color ?? variantState);
  const gradient = `linear-gradient(135deg, ${palette.from}, ${palette.to})`;

  const numericValue = typeof value === 'number' ? value : Number(value);
  const numericTarget = typeof target === 'number' ? target : Number(target);
  
  // Calculate progress if target is provided but progress isn't explicitly passed
  const calculatedProgress = progress !== undefined 
    ? progress 
    : (Number.isFinite(numericValue) && Number.isFinite(numericTarget) && numericTarget > 0)
      ? (numericValue / numericTarget) * 100
      : undefined;

  const clampedProgress =
    calculatedProgress !== undefined ? Math.max(0, Math.min(100, calculatedProgress)) : undefined;

  return (
    <Card
      className="group relative animate-fade-in overflow-hidden border bg-card/95 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      style={{
        borderColor: rgba(palette.from, 0.28),
        boxShadow: `0 1px 2px ${rgba(palette.from, 0.08)}`,
      }}
    >
      {/* Colourful top accent bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: gradient }} />
      {/* Soft coloured glow in the corner */}
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: rgba(palette.to, 0.35) }}
      />

      <CardHeader className="relative pb-2 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {title}
            </CardTitle>
            {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {Icon && (
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3"
              style={{ background: gradient, boxShadow: `0 8px 18px ${rgba(palette.from, 0.4)}` }}
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="relative space-y-3">
        <div className="flex items-end gap-2">
          <span
            className="bg-clip-text text-3xl font-bold tracking-tight text-transparent"
            style={{ backgroundImage: gradient }}
          >
            {value}
          </span>
          {unit && <span className="pb-1 text-sm font-medium text-muted-foreground">{unit}</span>}
          {trend !== 'None' && (
            <span className="pb-1">
              {trend === 'Up' ? (
                <ArrowUpRight className="h-4 w-4" style={{ color: palette.from }} />
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
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: rgba(palette.from, 0.15) }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${clampedProgress}%`, background: gradient }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
