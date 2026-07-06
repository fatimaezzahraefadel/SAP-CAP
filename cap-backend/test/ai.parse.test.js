'use strict';

const { extractRecommendations, sanitizeJsonText } = require('../srv/ai/ai.parse');

const REC = {
  userId: 'u-tech',
  userName: 'Théo Technique',
  userRole: 'CONSULTANT_TECHNIQUE',
  score: 87.5,
  factors: { availabilityScore: 90, skillsMatchScore: 85, performanceScore: 70, similarTicketsScore: 60 },
  explanation: 'Strong FI background.',
};

describe('sanitizeJsonText', () => {
  test('passes through a clean JSON array', () => {
    expect(sanitizeJsonText('[{"a":1}]')).toBe('[{"a":1}]');
  });

  test('strips ```json fences', () => {
    expect(sanitizeJsonText('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  test('strips bare ``` fences', () => {
    expect(sanitizeJsonText('```\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  test('extracts the array from surrounding prose', () => {
    expect(sanitizeJsonText('Here are the results:\n[{"a":1}]\nHope this helps!')).toBe('[{"a":1}]');
  });
});

describe('extractRecommendations', () => {
  test('parses a well-formed response', () => {
    const [rec] = extractRecommendations(JSON.stringify([REC]));
    expect(rec.userId).toBe('u-tech');
    expect(rec.score).toBe(87.5);
    expect(rec.factors.performanceScore).toBe(70);
    expect(rec.explanation).toBe('Strong FI background.');
  });

  test('parses a fenced response', () => {
    const recs = extractRecommendations('```json\n' + JSON.stringify([REC, { ...REC, userId: 'u-tech-2' }]) + '\n```');
    expect(recs).toHaveLength(2);
  });

  test('drops entries without a userId', () => {
    const recs = extractRecommendations(JSON.stringify([REC, { ...REC, userId: '' }, { score: 50 }]));
    expect(recs).toHaveLength(1);
  });

  test('coerces missing or invalid factors to 0 and clamps to 0-100', () => {
    const [rec] = extractRecommendations(
      JSON.stringify([{ userId: 'u-x', score: 'not-a-number', factors: { availabilityScore: 250, skillsMatchScore: -10 } }])
    );
    expect(rec.score).toBe(0);
    expect(rec.factors.availabilityScore).toBe(100);
    expect(rec.factors.skillsMatchScore).toBe(0);
    expect(rec.factors.performanceScore).toBe(0);
    expect(rec.factors.similarTicketsScore).toBe(0);
  });

  test('throws on non-JSON text', () => {
    expect(() => extractRecommendations('The consultant I recommend is Bob.')).toThrow();
  });

  test('throws when the JSON is not an array', () => {
    expect(() => extractRecommendations('{"userId":"u-x"}')).toThrow('Expected a JSON array');
  });
});
