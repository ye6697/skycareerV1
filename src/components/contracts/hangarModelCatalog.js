export const HANGAR_MODEL_VARIANTS = [
  {
    id: "airport_single",
    label: "Airport Single",
    path: "/models/hangars/cloth_hangar.glb",
    sizeKey: "small",
    slots: 1,
    price: 1800000,
    allowedTypes: ["small_prop"],
    tier: 1,
  },
  {
    id: "compact_modular",
    label: "Compact Modular",
    path: "/models/hangars/hangar_4.glb",
    sizeKey: "small",
    slots: 3,
    price: 7500000,
    allowedTypes: ["small_prop", "turboprop"],
    tier: 2,
  },
  {
    id: "delta_shed",
    label: "Delta Shed",
    path: "/models/hangars/hangar_6.glb",
    sizeKey: "medium",
    slots: 2,
    price: 3500000,
    allowedTypes: ["small_prop", "turboprop", "regional_jet"],
    tier: 3,
  },
  {
    id: "middle",
    label: "Middle Stat Modern",
    path: "/models/hangars/aircraft_hangar_1.glb",
    sizeKey: "medium",
    slots: 4,
    price: 12000000,
    allowedTypes: ["small_prop", "turboprop", "regional_jet"],
    tier: 4,
  },
  {
    id: "terminal_modular",
    label: "Terminal Modular",
    path: "/models/hangars/hangar_1.glb",
    sizeKey: "large",
    slots: 5,
    price: 20000000,
    allowedTypes: ["small_prop", "turboprop", "regional_jet", "narrow_body", "cargo"],
    tier: 5,
  },
  {
    id: "mega_platform",
    label: "Mega Plattform",
    path: "/models/hangars/mega_platform/scene.gltf",
    sizeKey: "mega",
    slots: 15,
    price: 185000000,
    allowedTypes: ["small_prop", "turboprop", "regional_jet", "narrow_body", "wide_body", "cargo"],
    tier: 15,
  },
];

export const HANGAR_SIZES = [
  {
    key: "small",
    slots: 2,
    allowedTypes: ["small_prop", "turboprop"],
    price: 3500000,
  },
  {
    key: "medium",
    slots: 4,
    allowedTypes: ["small_prop", "turboprop", "regional_jet"],
    price: 12000000,
  },
  {
    key: "large",
    slots: 6,
    allowedTypes: ["small_prop", "turboprop", "regional_jet", "narrow_body", "cargo"],
    price: 48000000,
  },
  {
    key: "mega",
    slots: 10,
    allowedTypes: ["small_prop", "turboprop", "regional_jet", "narrow_body", "wide_body", "cargo"],
    price: 125000000,
  },
];

export function getVariantMeta(variantId) {
  if (!variantId) return null;
  return HANGAR_MODEL_VARIANTS.find((variant) => variant.id === variantId) || null;
}

export function getSizeSpec(sizeKey) {
  if (!sizeKey) return null;
  return HANGAR_SIZES.find((size) => size.key === sizeKey) || null;
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
  return {
    key: variant.sizeKey,
    slots: variant.slots,
    price: variant.price,
    allowedTypes: Array.isArray(variant.allowedTypes) ? variant.allowedTypes : [],
    tier: Number(variant.tier || 0),
  };
}
