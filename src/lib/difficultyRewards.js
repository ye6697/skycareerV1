export const DIFFICULTY_PAYOUT_RATE = Object.freeze({
  easy: -0.20,
  medium: 0.15,
  hard: 0.35,
  extreme: 0.80,
});

export function normalizeChallengeDifficulty(value) {
  const normalized = String(value || '').toLowerCase().trim();
  if (['easy', 'free', 'freemode', 'free_mode'].includes(normalized)) return 'easy';
  return Object.prototype.hasOwnProperty.call(DIFFICULTY_PAYOUT_RATE, normalized)
    ? normalized
    : 'medium';
}

export function getDifficultyPayoutRate(value) {
  return DIFFICULTY_PAYOUT_RATE[normalizeChallengeDifficulty(value)];
}

export function getDifficultyPayoutPercent(value) {
  return Math.round(getDifficultyPayoutRate(value) * 100);
}

export function calculateDifficultyPayoutAdjustment(basePayout, difficulty, options = {}) {
  const eligible = options.eligible !== false;
  if (!eligible) return 0;

  const base = Math.max(0, Number(basePayout) || 0);
  const payoutFactor = Number.isFinite(Number(options.payoutFactor))
    ? Number(options.payoutFactor)
    : 1;

  return Math.round(base * getDifficultyPayoutRate(difficulty) * payoutFactor);
}

export function formatSignedPercent(value) {
  const percent = Math.round(Number(value) || 0);
  if (percent > 0) return `+${percent}%`;
  if (percent < 0) return `${percent}%`;
  return '0%';
}
