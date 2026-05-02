// One-time XP + cash rewards granted when an achievement is unlocked for the
// first time. Rewards scale with tier so platinum badges feel meaningful while
// bronze ones are still appreciable boosts.
export const TIER_REWARDS = {
  bronze:   { xp: 25,  cash: 2000 },
  silver:   { xp: 50,  cash: 15000 },
  gold:     { xp: 150, cash: 50000 },
  platinum: { xp: 300, cash: 500000 },
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