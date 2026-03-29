import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // This function is called via entity automation when Company is deleted
    // It cleans up all associated data
    if (!event || !data) {
      return Response.json({ error: 'Missing event or data' }, { status: 400 });
    }

    const companyId = event.entity_id || data?.id;
    if (!companyId) {
      return Response.json({ error: 'No company ID found' }, { status: 400 });
    }

    // Use service role to delete all associated data
    const [aircraft, employees, flights, contracts, transactions, logs] = await Promise.all([
      base44.asServiceRole.entities.Aircraft.filter({ company_id: companyId }),
      base44.asServiceRole.entities.Employee.filter({ company_id: companyId }),
      base44.asServiceRole.entities.Flight.filter({ company_id: companyId }),
      base44.asServiceRole.entities.Contract.filter({ company_id: companyId }),
      base44.asServiceRole.entities.Transaction.filter({ company_id: companyId }),
      base44.asServiceRole.entities.XPlaneLog.filter({ company_id: companyId }),
    ]);

    const deleteAll = async (items, entityType) => {
      for (const item of items) {
        await base44.asServiceRole.entities[entityType].delete(item.id);
      }
    };

    await Promise.all([
      deleteAll(aircraft, 'Aircraft'),
      deleteAll(employees, 'Employee'),
      deleteAll(flights, 'Flight'),
      deleteAll(contracts, 'Contract'),
      deleteAll(transactions, 'Transaction'),
      deleteAll(logs, 'XPlaneLog'),
    ]);

    return Response.json({ 
      success: true, 
      deleted: {
        aircraft: aircraft.length,
        employees: employees.length,
        flights: flights.length,
        contracts: contracts.length,
        transactions: transactions.length,
        logs: logs.length
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});