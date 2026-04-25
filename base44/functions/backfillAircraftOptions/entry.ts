import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function normalizeOptionMap(raw: any): Record<string, any> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...raw };
}

function extractOptionDefaults(template: any): Record<string, any> {
  const defaults: Record<string, any> = {};

  const directOptions = template?.options;
  if (directOptions && typeof directOptions === 'object' && !Array.isArray(directOptions)) {
    Object.entries(directOptions).forEach(([key, value]) => {
      if (!key) return;
      defaults[key] = value ?? false;
    });
  }

  const availableOptions = template?.available_options;
  if (Array.isArray(availableOptions)) {
    availableOptions.forEach((entry) => {
      if (typeof entry === 'string' && entry.trim()) {
        defaults[entry.trim()] = false;
      } else if (entry && typeof entry === 'object') {
        const key = String(entry.key || entry.id || entry.name || '').trim();
        if (key) defaults[key] = entry.default ?? false;
      }
    });
  } else if (availableOptions && typeof availableOptions === 'object') {
    Object.entries(availableOptions).forEach(([key, value]) => {
      if (!key) return;
      defaults[key] = value ?? false;
    });
  }

  return defaults;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const [allAircraft, templates] = await Promise.all([
      base44.asServiceRole.entities.Aircraft.list(),
      base44.asServiceRole.entities.AircraftTemplate.list(),
    ]);

    const templateByName = new Map(
      templates
        .filter((entry: any) => entry?.name)
        .map((entry: any) => [String(entry.name).trim().toLowerCase(), entry]),
    );

    let scanned = 0;
    let updated = 0;

    for (const aircraft of allAircraft) {
      scanned += 1;

      const normalizedName = String(aircraft?.name || '').trim().toLowerCase();
      const template = templateByName.get(normalizedName);
      const defaultOptions = extractOptionDefaults(template);
      const currentOptions = normalizeOptionMap(aircraft?.options);

      const nextOptions: Record<string, any> = {
        ...defaultOptions,
        ...currentOptions,
      };

      const needsOptions = !aircraft?.options || typeof aircraft.options !== 'object' || Array.isArray(aircraft.options);
      const hasMissingDefaults = Object.keys(defaultOptions).some((key) => !(key in currentOptions));
      const needsFlag = aircraft?.options_initialized !== true;

      if (!needsOptions && !hasMissingDefaults && !needsFlag) {
        continue;
      }

      await base44.asServiceRole.entities.Aircraft.update(aircraft.id, {
        options: nextOptions,
        options_initialized: true,
      });

      updated += 1;
    }

    return Response.json({
      success: true,
      scanned,
      updated,
      message: `Aircraft options ensured for ${updated} of ${scanned} aircraft.`,
    });
  } catch (error) {
    return Response.json({ error: error?.message || 'Unknown error' }, { status: 500 });
  }
});
