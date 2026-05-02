// Type-Rating system: the USER (player) needs a type-rating per aircraft model
// (e.g. "Boeing 737-800", "Airbus A320neo") to legally buy/fly that aircraft.
// To earn a rating, the user pays a fee, then must complete a short training
// flight (under 100 NM) with at least 80% score.
//
// User entity stores:
//   - type_ratings: string[]                 -> earned aircraft model names
//   - active_type_rating: { model, paidAt }  -> currently in-progress rating

import { base44 } from '@/api/base44Client';

// Cost per rating depends on aircraft category. Bigger jets = more expensive.
const COST_BY_TYPE = {
  small_prop: 5000,
  turboprop: 12000,
  regional_jet: 25000,
  narrow_body: 60000,
  wide_body: 120000,
  cargo: 80000,
};

// Score required to earn the rating after the training flight.
export const TYPE_RATING_PASS_SCORE = 80;

// Distance (NM) for training mission contracts.
export const TYPE_RATING_MAX_NM = 100;

export function getTypeRatingCost(aircraft) {
  if (!aircraft) return 20000;
  return COST_BY_TYPE[aircraft.type] || 20000;
}

// Check if user has rating for a specific aircraft model (by aircraft.name).
export function userHasTypeRating(user, modelName) {
  if (!user || !modelName) return false;
  const ratings = Array.isArray(user.type_ratings) ? user.type_ratings : [];
  return ratings.includes(String(modelName));
}

// Active training session for this exact model, or null.
export function getActiveTypeRating(user, modelName) {
  const active = user?.active_type_rating;
  if (!active || !active.model) return null;
  if (modelName && active.model !== modelName) return null;
  return active;
}

// Persist a new rating onto the user.
export async function grantUserTypeRating(modelName) {
  const user = await base44.auth.me();
  const existing = Array.isArray(user?.type_ratings) ? user.type_ratings : [];
  if (existing.includes(modelName)) return;
  const next = [...existing, modelName];
  await base44.auth.updateMe({
    type_ratings: next,
    active_type_rating: null,
  });
}

// Start a training session: deduct cost from company, mark user.
export async function startTypeRatingTraining({ aircraftModel, aircraftType, company }) {
  if (!company) throw new Error('No company');
  const cost = COST_BY_TYPE[aircraftType] || 20000;
  if ((company.balance || 0) < cost) {
    throw new Error('insufficient_funds');
  }
  await base44.entities.Company.update(company.id, {
    balance: (company.balance || 0) - cost,
  });
  await base44.entities.Transaction.create({
    company_id: company.id,
    type: 'expense',
    category: 'salary',
    amount: cost,
    description: `Type-Rating Training: ${aircraftModel}`,
    date: new Date().toISOString(),
  });
  await base44.auth.updateMe({
    active_type_rating: {
      model: aircraftModel,
      type: aircraftType,
      paidAt: new Date().toISOString(),
    },
  });
  return { cost };
}