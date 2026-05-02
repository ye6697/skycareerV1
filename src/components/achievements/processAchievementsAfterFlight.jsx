import { base44 } from "@/api/base44Client";
import { ACHIEVEMENTS } from "./achievementDefinitions";
import { buildAchievementContext, evaluateAchievements } from "./achievementEvaluator";
import { sumRewards } from "./achievementRewards";

// Run after a flight is fully written to DB. Loads the latest flight + aircraft
// records, evaluates all achievements, and grants one-time XP/cash rewards for
// every newly unlocked achievement. Returns the list of newly unlocked items
// so the UI can display them on the result screen + completion animation.
//
// company: latest Company record (with experience_points, level, balance,
//          unlocked_achievements). Caller must pass the most recent in-memory
//          version to avoid clobbering other concurrent updates.
// flight:  the just-completed Flight record (used for transaction reference).
export async function processAchievementsAfterFlight({ company, flight }) {
  if (!company?.id) return { newlyUnlocked: [], totalXp: 0, totalCash: 0 };

  // Load all flights + aircraft for this company so the evaluator sees the
  // up-to-date dataset (including the flight we just completed).
  const [flights, aircraft] = await Promise.all([
    base44.entities.Flight.filter({ company_id: company.id }, "-created_date", 500),
    base44.entities.Aircraft.filter({ company_id: company.id }),
  ]);

  const ctx = buildAchievementContext({ flights, company, aircraft });
  const { unlocked } = evaluateAchievements(ctx);

  const previouslyUnlocked = new Set(
    Array.isArray(company.unlocked_achievements) ? company.unlocked_achievements : []
  );
  const newlyUnlockedIds = [...unlocked].filter((id) => !previouslyUnlocked.has(id));
  if (newlyUnlockedIds.length === 0) {
    return { newlyUnlocked: [], totalXp: 0, totalCash: 0 };
  }

  const newlyUnlocked = ACHIEVEMENTS.filter((a) => newlyUnlockedIds.includes(a.id));
  const { xp: totalXp, cash: totalCash } = sumRewards(newlyUnlocked);

  // Persist on company: union of old + new ids, plus apply XP + cash bonus.
  const mergedIds = Array.from(new Set([...previouslyUnlocked, ...newlyUnlockedIds]));
  // We re-read company to avoid clobbering recent changes (level/xp updates
  // from the same flight completion path), then apply the delta on top.
  let latestCompany = company;
  try {
    const fresh = await base44.entities.Company.filter({ id: company.id });
    if (fresh?.[0]) latestCompany = fresh[0];
  } catch (_) { /* ignore – use passed-in company */ }

  await base44.entities.Company.update(company.id, {
    unlocked_achievements: mergedIds,
    balance: Number(latestCompany.balance || 0) + totalCash,
    experience_points: Number(latestCompany.experience_points || 0) + totalXp,
  });

  // Bookkeeping: log a single income transaction summarizing the rewards.
  if (totalCash > 0) {
    try {
      await base44.entities.Transaction.create({
        company_id: company.id,
        type: "income",
        category: "bonus",
        amount: totalCash,
        description: `Achievement-Bonus: ${newlyUnlocked.length}x freigeschaltet (+${totalXp} XP)`,
        reference_id: flight?.id || null,
        date: new Date().toISOString(),
      });
    } catch (_) { /* non-fatal */ }
  }

  // Persist the unlock list directly on the flight so result screens can show
  // it without re-evaluating achievements.
  if (flight?.id) {
    try {
      const rows = await base44.entities.Flight.filter({ id: flight.id });
      const cur = rows?.[0];
      const xpd = cur?.xplane_data || {};
      await base44.entities.Flight.update(flight.id, {
        xplane_data: {
          ...xpd,
          achievements_unlocked: newlyUnlocked.map((a) => ({
            id: a.id,
            tier: a.tier,
            icon: a.icon,
            de: a.de,
            en: a.en,
          })),
          achievements_xp_bonus: totalXp,
          achievements_cash_bonus: totalCash,
        },
      });
    } catch (_) { /* non-fatal */ }
  }

  return { newlyUnlocked, totalXp, totalCash };
}