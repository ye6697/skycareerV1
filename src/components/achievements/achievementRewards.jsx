// One-time XP + cash rewards granted when an achievement is unlocked for the
// first time. Rewards scale with tier so platinum badges feel meaningful while
// bronze ones are still appreciable boosts.
export const TIER_REWARDS = {
  bronze:   { xp: 100,   cash: 200 },
  silver:   { xp: 500,   cash: 1000 },
  gold:     { xp: 2000,  cash: 5000 },
  platinum: { xp: 10000, cash: 25000 },
};

export function getRewardForAchievement(achievement) {
  if (!achievement) return { xp: 0, cash: 0 };
  return TIER_REWARDS[achievement.tier] || { xp: 0, cash: 0 };
}

// Sum xp + cash for a list of achievement objects.
export function sumRewards(achievements = []) {
  let xp = 0;
  let cash = 0;
  for (const a of achievements) {
    const r = getRewardForAchievement(a);
    xp += r.xp;
    cash += r.cash;
  }
  return { xp, cash };
}