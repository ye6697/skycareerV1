import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { buildAchievementContext, evaluateAchievements } from "./achievementEvaluator";
import { ACHIEVEMENTS } from "./achievementDefinitions";

// Shared hook that loads flights + aircraft for a company and returns
// { achievements, unlocked, total, byId, ctx, isLoading }.
export function useAchievements(companyId, company) {
  const { data: flights = [], isLoading: flightsLoading } = useQuery({
    queryKey: ["achievements", "flights", companyId],
    queryFn: () =>
      base44.entities.Flight.filter({ company_id: companyId }, "-created_date", 500),
    enabled: !!companyId,
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });

  const { data: aircraft = [], isLoading: aircraftLoading } = useQuery({
    queryKey: ["achievements", "aircraft", companyId],
    queryFn: () => base44.entities.Aircraft.filter({ company_id: companyId }),
    enabled: !!companyId,
    staleTime: 120000,
    refetchOnWindowFocus: false,
  });

  const result = useMemo(() => {
    if (!company) {
      return { achievements: ACHIEVEMENTS, unlocked: new Set(), byId: {}, ctx: null };
    }
    const ctx = buildAchievementContext({ flights, company, aircraft });
    const { unlocked, byId } = evaluateAchievements(ctx);
    return { achievements: ACHIEVEMENTS, unlocked, byId, ctx };
  }, [flights, aircraft, company]);

  return {
    ...result,
    total: ACHIEVEMENTS.length,
    isLoading: flightsLoading || aircraftLoading,
  };
}