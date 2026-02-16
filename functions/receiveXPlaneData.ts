const flightCache = new Map();  // company.id → Flight

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('api_key');
    if (!apiKey) return Response.json({ error: 'API key required' }, { status: 401 });

    const companies = await base44.asServiceRole.entities.Company.filter({ xplane_api_key: apiKey });
    if (companies.length === 0) return Response.json({ error: 'Invalid API key' }, { status: 401 });
    const company = companies[0];

    const data = await req.json();

    // Flight Cache
    let flight = flightCache.get(company.id) || null;
    if (!flight) {
      const flights = await base44.asServiceRole.entities.Flight.filter({ company_id: company.id, status: 'in_flight' });
      flight = flights[0] || null;
      flightCache.set(company.id, flight);
    }

    if (!flight) {
      base44.asServiceRole.entities.XPlaneLog.create({ company_id: company.id, raw_data: data }).catch(() => {});
      return Response.json({ message: 'no active flight', xplane_connection_status: 'connected' });
    }

    // Flight Update async, nur letzte Payload
    const updateData = { xplane_data: data };
    if (data.max_g_force > (flight.max_g_force ?? 0)) updateData.max_g_force = data.max_g_force;
    base44.asServiceRole.entities.Flight.update(flight.id, updateData).catch(() => {});

    return Response.json({
      status: 'updated',
      xplane_connection_status: 'connected',
      last_payload_seq: data.seq
    });

  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});