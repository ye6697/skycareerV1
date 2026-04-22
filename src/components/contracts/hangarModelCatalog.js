const HANGAR_SIZE_SPECS = {
  small: {
    key: "small",
    slots: 2,
    allowedTypes: ["small_prop", "turboprop"],
    price: 3500000,
  },
  medium: {
    key: "medium",
    slots: 4,
    allowedTypes: ["small_prop", "turboprop", "regional_jet"],
    price: 12000000,
  },
  large: {
    key: "large",
    slots: 6,
    allowedTypes: ["small_prop", "turboprop", "regional_jet", "narrow_body", "cargo"],
    price: 48000000,
  },
  mega: {
    key: "mega",
    slots: 10,
    allowedTypes: ["small_prop", "turboprop", "regional_jet", "narrow_body", "wide_body", "cargo"],
    price: 125000000,
  },
};

export const HANGAR_MODEL_VARIANTS = [
  {
    id: "airport_single",
    label: "Airport Single",
    path: "/models/hangars/airport_hangar_1.glb",
    sizeKey: "small",
  },
  {
    id: "compact_modular",
    label: "Compact Modular",
    path: "/models/hangars/hangar_4.glb",
    sizeKey: "small",
  },
  {
    id: "delta_shed",
    label: "Delta Shed",
    path: "/models/hangars/hangar_6.glb",
    sizeKey: "small",
  },
  {
    id: "aircraft_modern",
    label: "Aircraft Modern",
    path: "/models/hangars/aircraft_hangar_1.glb",
    sizeKey: "medium",
  },
  {
    id: "terminal_modular",
    label: "Terminal Modular",
    path: "/models/hangars/hangar_1.glb",
    sizeKey: "medium",
  },
  {
    id: "industrial_wide",
    label: "Industrial Wide",
    path: "/models/hangars/hangar_3.glb",
    sizeKey: "large",
  },
  {
    id: "cloth_advanced",
    label: "Cloth Advanced",
    path: "/models/hangars/cloth_hangar.glb",
    sizeKey: "large",
  },
  {
    id: "global_main_hub",
    label: "Global Main Hub",
    path: "/models/hangars/hangar_main.glb",
    sizeKey: "mega",
  },
  {
    id: "mega_platform_5",
    label: "Mega Platform 5",
    path: "/models/hangars/hangar_5.glb",
    sizeKey: "mega",
  },
];

export const HANGAR_SIZES = Object.values(HANGAR_SIZE_SPECS);

export function getVariantMeta(variantId) {
  if (!variantId) return null;
  return HANGAR_MODEL_VARIANTS.find((variant) => variant.id === variantId) || null;
}

export function getSizeSpec(sizeKey) {
  if (!sizeKey) return null;
  return HANGAR_SIZE_SPECS[sizeKey] || null;
}

export function getDefaultVariantId() {
  return HANGAR_MODEL_VARIANTS[0]?.id || "";
}

export function getDefaultVariantBySize(sizeKey = "small") {
  const match = HANGAR_MODEL_VARIANTS.find((variant) => variant.sizeKey === sizeKey);
  return match?.id || getDefaultVariantId();
}

export function getVariantSizeSpec(variantId) {
  const variant = getVariantMeta(variantId);
  if (!variant) return null;
  return getSizeSpec(variant.sizeKey);
}
