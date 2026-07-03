import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, UserCheck } from 'lucide-react';
import { Button } from '@/app/components/ui/button';
import { Badge } from '@/app/components/ui/badge';
import { Progress } from '@/app/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';
import {
  AssigneeRecommendation,
  Ticket,
  User,
} from '@/app/types/entities';
import { useTranslation } from 'react-i18next';
import { assigneeRecommender } from '@/app/services/aiRecommender';

interface AssignmentToggleProps {
  ticket: Partial<Ticket>;
  users: User[];
  allTickets: Ticket[];
  /** Currently selected user id */
  value: string;
  onChange: (userId: string) => void;
  /** Filter candidates to these roles (default: tech consultants) */
  candidateRoles?: User['role'][];
}

/**
 * Reusable toggle between manual user picker and AI-powered recommendations.
 * Used in the Manager approval modal (F2) and DevCoordinator dispatch page (F4).
 */
export const AssignmentToggle: React.FC<AssignmentToggleProps> = ({
  ticket,
  users,
  allTickets,
  value,
  onChange,
  candidateRoles = ['CONSULTANT_TECHNIQUE'],
}) => {
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [recommendations, setRecommendations] = useState<AssigneeRecommendation[]>([]);
  const [loading, setLoading] = useState(false);

  const candidates = users.filter(
    (u) => u.active && candidateRoles.includes(u.role),
  );

  const runAI = useCallback(async () => {
    setLoading(true);
    try {
      const recs = await assigneeRecommender.recommend(ticket, users, allTickets);
      setRecommendations(recs);
    } finally {
      setLoading(false);
    }
  }, [ticket, users, allTickets]);

  useEffect(() => {
    if (mode === 'ai' && recommendations.length === 0 && !loading) {
      void runAI();
    }
  }, [mode, recommendations.length, loading, runAI]);

  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === 'manual' ? 'default' : 'outline'}
          onClick={() => setMode('manual')}
        >
          <UserCheck className="mr-1.5 h-3.5 w-3.5" />
          {t('assignment.manual')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'ai' ? 'default' : 'outline'}
          onClick={() => setMode('ai')}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          {t('assignment.aiSuggest')}
        </Button>
      </div>

      {/* Manual dropdown */}
      {mode === 'manual' &&
        (candidates.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
            {t('assignment.noConsultants')}
          </p>
        ) : (
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder={t('assignment.selectPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name} ({t(`roles.${u.role}`)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}

      {/* AI recommendations list */}
      {mode === 'ai' && (
        <div className="space-y-2">
          {loading && (
            <p className="text-sm text-muted-foreground animate-pulse">
              {t('assignment.analyzing')}
            </p>
          )}
          {!loading && recommendations.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('assignment.noRecommendations')}</p>
          )}
          {recommendations.map((rec, i) => {
            const user = users.find((u) => u.id === rec.userId);
            if (!user) return null;
            const selected = value === rec.userId;
            return (
              <button
                key={rec.userId}
                type="button"
                onClick={() => onChange(rec.userId)}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{user.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {t(`roles.${user.role}`)}
                    </Badge>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {rec.score.toFixed(0)}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <ScoreMini label={t('assignment.availability')} value={rec.factors.availabilityScore} color="emerald" />
                  <ScoreMini label={t('assignment.skills')} value={rec.factors.skillsMatchScore} color="blue" />
                  <ScoreMini label={t('assignment.performance')} value={rec.factors.performanceScore} color="amber" />
                  <ScoreMini label={t('assignment.similar')} value={rec.factors.similarTicketsScore} color="violet" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const colorMap: Record<string, string> = {
  emerald: 'bg-emerald-100 dark:bg-emerald-950 [&>[data-slot=progress-indicator]]:bg-emerald-500',
  blue: 'bg-blue-100 dark:bg-blue-950 [&>[data-slot=progress-indicator]]:bg-blue-500',
  amber: 'bg-amber-100 dark:bg-amber-950 [&>[data-slot=progress-indicator]]:bg-amber-500',
  violet: 'bg-violet-100 dark:bg-violet-950 [&>[data-slot=progress-indicator]]:bg-violet-500',
};

const ScoreMini: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="space-y-0.5">
    <div className="flex justify-between text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
    <Progress value={value} className={`h-1.5 ${colorMap[color] ?? ''}`} />
  </div>
);
