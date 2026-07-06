'use strict';

/**
 * Parsing/validation for LLM recommendation responses.
 *
 * Kept free of any CAP or HTTP dependency so the fence-stripping, array
 * extraction and shape validation can be unit-tested in isolation.
 */

const toScore = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
};

/**
 * Strip markdown code fences and, as a fallback, cut the response down to the
 * outermost JSON array. LLMs regularly wrap JSON despite instructions not to.
 */
const sanitizeJsonText = (rawText) => {
  let text = String(rawText ?? '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  if (!text.startsWith('[')) {
    const first = text.indexOf('[');
    const last = text.lastIndexOf(']');
    if (first !== -1 && last > first) {
      text = text.substring(first, last + 1);
    }
  }
  return text;
};

/**
 * Parse the raw LLM text into validated AssigneeRecommendation objects.
 * Entries without a usable userId are dropped; every factor (including
 * performanceScore) is coerced to a 0-100 number so the UI never renders NaN.
 *
 * @throws {Error} when the text contains no parsable JSON array.
 */
const extractRecommendations = (rawText) => {
  const parsed = JSON.parse(sanitizeJsonText(rawText));
  if (!Array.isArray(parsed)) {
    throw new Error('Expected a JSON array of recommendations');
  }

  return parsed
    .filter((entry) => entry && typeof entry === 'object' && String(entry.userId ?? '').trim())
    .map((entry) => ({
      userId: String(entry.userId).trim(),
      userName: String(entry.userName ?? '').trim(),
      userRole: String(entry.userRole ?? '').trim(),
      score: toScore(entry.score),
      factors: {
        availabilityScore: toScore(entry.factors?.availabilityScore),
        skillsMatchScore: toScore(entry.factors?.skillsMatchScore),
        performanceScore: toScore(entry.factors?.performanceScore),
        similarTicketsScore: toScore(entry.factors?.similarTicketsScore),
      },
      explanation: String(entry.explanation ?? '').trim(),
    }));
};

module.exports = { extractRecommendations, sanitizeJsonText };
