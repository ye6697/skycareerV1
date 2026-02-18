import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

Deno.serve(async (req) => {

  try {

    const base44 = createClientFromRequest(req);

    const url = new URL(req.url);
    const apiKey = url.searchParams.get("api_key");

    if (!apiKey) {
      return Response.json({ error: "API key required" }, { status: 401 });
    }

    // ---------- COMPANY LOOKUP ----------
    const companies = await base44.asServiceRole.entities.Company.filter({
      xplane_api_key: apiKey
    });

    if (!companies.length) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    const company = companies[0];

    // ---------- PARSE BODY ----------
    const data = await req.json();

    if (data.altitude === undefined || data.speed === undefined) {
      return Response.json({ error: "invalid packet" }, { status: 400 });
    }

    // ---------- ACTIVE FLIGHT ----------
    const flights = await base44.asServiceRole.entities.Flight.filter({
      company_id: company.id,
      status: "in_flight"
    });

    const flight = flights[0];

    if (!flight) {
      return Response.json({
        status: "connected_no_flight"
      });
    }

    // ---------- LEAN UPDATE ----------
    const xplane_data = {
      altitude: data.altitude,
      speed: data.speed,
      vertical_speed: data.vertical_speed,
      heading: data.heading,
      fuel_percentage: data.fuel_percentage,
      fuel_kg: data.fuel_kg,
      g_force: data.g_force,
      latitude: data.latitude,
      longitude: data.longitude,
      on_ground: data.on_ground,
      gear_down: data.gear_down,
      flap_ratio: data.flap_ratio,
      pitch: data.pitch,
      ias: data.ias,
      aircraft_icao: data.aircraft_icao,
      timestamp: new Date().toISOString()
    };

    // ---------- FIRE & FORGET WRITE ----------
    base44.asServiceRole.entities.Flight.update(
      flight.id,
      { xplane_data }
    ).catch(() => {});

    // ---------- FAST RESPONSE ----------
    return Response.json({
      status: "ok",
      connected: true
    });

  } catch (err) {

    console.error(err);

    return Response.json({
      error: "server_error"
    }, { status: 500 });

  }

});