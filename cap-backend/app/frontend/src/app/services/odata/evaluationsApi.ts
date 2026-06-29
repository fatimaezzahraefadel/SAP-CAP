import type { Evaluation } from './core';
import { listEntities, createEntity } from './core';

type EvaluationGrid = NonNullable<Evaluation['qualitativeGrid']>;

interface EvaluationRaw extends Omit<Evaluation, 'score' | 'qualitativeGrid'> {
  score: number | string;
  qualitativeGrid?: unknown;
}

const EMPTY_GRID: EvaluationGrid = {
  productivity: 0,
  quality: 0,
  autonomy: 0,
  collaboration: 0,
  innovation: 0,
};

const GRID_KEYS = Object.keys(EMPTY_GRID) as Array<keyof EvaluationGrid>;

const toNumber = (value: unknown): number => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(5, num));
};

const parseGridFromComposition = (value: unknown): EvaluationGrid | null => {
  if (!Array.isArray(value)) return null;

  const mapped: EvaluationGrid = { ...EMPTY_GRID };
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const criteria = String((entry as { criteria?: unknown }).criteria ?? '').toLowerCase();
    const rating = (entry as { rating?: unknown }).rating;
    if (!GRID_KEYS.includes(criteria as keyof EvaluationGrid)) return;
    mapped[criteria as keyof EvaluationGrid] = toNumber(rating);
  });

  return mapped;
};

const parseGrid = (value: unknown): EvaluationGrid => {
  if (!value) return { ...EMPTY_GRID };

  if (typeof value === 'string') {
    try {
      return parseGrid(JSON.parse(value));
    } catch {
      return { ...EMPTY_GRID };
    }
  }

  const fromComposition = parseGridFromComposition(value);
  if (fromComposition) return fromComposition;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Partial<Record<keyof EvaluationGrid, unknown>>;
    return {
      productivity: toNumber(record.productivity),
      quality: toNumber(record.quality),
      autonomy: toNumber(record.autonomy),
      collaboration: toNumber(record.collaboration),
      innovation: toNumber(record.innovation),
    };
  }

  return { ...EMPTY_GRID };
};

const normalizeEvaluation = (evaluation: EvaluationRaw): Evaluation => ({
  ...evaluation,
  score: Number(evaluation.score) || 0,
  qualitativeGrid: parseGrid(evaluation.qualitativeGrid),
});

const EVALUATION_BASE_SELECT = 'ID,userId,evaluatorId,projectId,period,score,feedback';

const isMissingGridTableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  return /no such table: .*EvaluationQualitativeGrids/i.test(error.message);
};

const listWithGridFallback = async (filter?: string): Promise<Evaluation[]> => {
  try {
    const data = await listEntities<EvaluationRaw>('time', 'Evaluations', {
      ...(filter ? { $filter: filter } : {}),
      $select: EVALUATION_BASE_SELECT,
      $expand: 'qualitativeGrid',
    });
    return data.map(normalizeEvaluation);
  } catch (error) {
    if (!isMissingGridTableError(error)) throw error;
    const legacyData = await listEntities<EvaluationRaw>('time', 'Evaluations', {
      ...(filter ? { $filter: filter } : {}),
      $select: `${EVALUATION_BASE_SELECT},qualitativeGrid`,
    });
    return legacyData.map(normalizeEvaluation);
  }
};

export const EvaluationsAPI = {
  async getAll(): Promise<Evaluation[]> {
    return await listWithGridFallback();
  },

  async create(
    evaluation: Omit<Evaluation, 'id' | 'createdAt' | 'qualitativeGrid'>
  ): Promise<Evaluation> {
    // Ticket-based evaluations persist a computed score + feedback per period;
    // the qualitative grid is no longer captured here.
    const created = await createEntity<EvaluationRaw>('time', 'Evaluations', evaluation);
    return normalizeEvaluation(created);
  },
};
