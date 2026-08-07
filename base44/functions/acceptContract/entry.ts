import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { contractId } = await req.json();
    if (!contractId) {
      return Response.json({ error: 'contractId required' }, { status: 400 });
    }

    // Get user's company - prefer company_id from user, fallback to created_by
    let company = null;
    const companyId = user.company_id || user.data?.company_id;
    if (companyId) {
      const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
      company = companies[0] || null;
    }
    if (!company) {
      const companies = await base44.asServiceRole.entities.Company.filter({ created_by: user.email });
      company = companies[0] || null;
    }
    if (!company) {
      return Response.json({ error: 'Keine Firma gefunden' }, { status: 400 });
    }

    const contracts = await base44.asServiceRole.entities.Contract.filter({ id: contractId });
    const contract = contracts[0] || null;
    if (!contract) {
      return Response.json({ error: 'Auftrag nicht gefunden' }, { status: 404 });
    }

    // Type-rating training contracts skip qualification checks.
    const isTrainingContract = /__TR__:/.test(String(contract.briefing || ''));

    if (!isTrainingContract) {
      const departure = String(contract.departure_airport || '').trim().toUpperCase();
      const arrival = String(contract.arrival_airport || '').trim().toUpperCase();

      // 1) Departure qualification: company must own a gate / apron stand there.
      const departureGates = await base44.asServiceRole.entities.AirportGate.filter({
        owner_company_id: company.id,
        airport_icao: departure,
      });
      if (!departureGates.length) {
        return Response.json({
          error: `NO_DEPARTURE_GATE:${departure}`,
          message: `Kein eigenes Gate / keine Parkposition in ${departure}. Kaufe zuerst eine Position am Abflughafen.`,
        }, { status: 400 });
      }

      // 2) Arrival qualification: company needs a service agreement with the arrival airport.
      const agreements = await base44.asServiceRole.entities.AirportServiceAgreement.filter({
        company_id: company.id,
        airport_icao: arrival,
      });
      if (!agreements.length) {
        return Response.json({
          error: `NO_ARRIVAL_AGREEMENT:${arrival}`,
          message: `Kein Servicevertrag mit ${arrival}. Schliesse zuerst einen Vertrag mit dem Zielflughafen ab.`,
        }, { status: 400 });
      }
    }

    // Update contract via service role
    await base44.asServiceRole.entities.Contract.update(contractId, {
      status: 'accepted',
      company_id: company.id
    });

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});