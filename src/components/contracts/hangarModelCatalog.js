export const HANGAR_MODEL_VARIANTS = [
  {
    id: "airport_classic",
    label: "Airport Classic",
    path: "/models/hangars/airport_hangar.glb",
    recommendedSizes: ["small", "medium"],
  },
  {
    id: "compact_delta",
    label: "Compact Delta",
    path: "/models/hangars/hangar_4.glb",
    recommendedSizes: ["small", "medium"],
  },
  {
    id: "cloth_field",
    label: "Cloth Field",
    path: "/models/hangars/cloth_hangar_1.glb",
    recommendedSizes: ["small", "medium"],
  },
  {
    id: "aircraft_modern",
    label: "Aircraft Modern",
    path: "/models/hangars/aircraft_hangar_1.glb",
    recommendedSizes: ["medium", "large"],
  },
  {
    id: "terminal_modular",
    label: "Terminal Modular",
    path: "/models/hangars/hangar_1.glb",
    recommendedSizes: ["medium", "large"],
  },
  {
    id: "industrial_wide",
    label: "Industrial Wide",
    path: "/models/hangars/hangar_3.glb",
    recommendedSizes: ["large", "mega"],
  },
  {
    id: "cloth_advanced",
    label: "Cloth Advanced",
    path: "/models/hangars/cloth_hangar.glb",
    recommendedSizes: ["large", "mega"],
  },
  {
    id: "global_main_hub",
    label: "Global Main Hub",
    path: "/models/hangars/hangar_main.glb",
    recommendedSizes: ["mega"],
  },
];

export function getDefaultVariantBySize(sizeKey = "small") {
  const bySize = HANGAR_MODEL_VARIANTS.find((variant) =>
    Array.isArray(variant.recommendedSizes) && variant.recommendedSizes.includes(sizeKey)
  );
  return bySize?.id || HANGAR_MODEL_VARIANTS[0].id;
}

export function getVariantMeta(variantId) {
  if (!variantId) return null;
  return HANGAR_MODEL_VARIANTS.find((variant) => variant.id === variantId) || null;
}
