import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const resolveUserCompanyId = (user: any): string | null => (
  user?.company_id
  || user?.data?.company_id
  || user?.company?.id
  || user?.data?.company?.id
  || null
);

async function resolveCompany(base44: any, user: any) {
  const companyId = resolveUserCompanyId(user);
  if (companyId) {
    const companies = await base44.asServiceRole.entities.Company.filter({ id: companyId });
    if (companies?.[0]) return companies[0];
  }

  const email = String(user?.email || '').trim();
  if (!email) return null;
  const candidateEmails = Array.from(new Set([email, email.toLowerCase()]));
  for (const candidate of candidateEmails) {
    const companies = await base44.asServiceRole.entities.Company.filter({ created_by: candidate });
    if (companies?.[0]) return companies[0];
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }
    if (!user) {
      return Response.json(
        { company: null, aircraft: [], contracts: [], employees: [], requires_auth: true },
        { status: 200 }
      );
    }

    const company = await resolveCompany(base44, user);
    if (!company) {
      return Response.json({ company: null, aircraft: [], contracts: [] });
    }

    // Get aircraft for this company
    const allAircraft = await base44.asServiceRole.entities.Aircraft.filter({ company_id: company.id });
    const aircraft = allAircraft.filter(a => a.status !== 'sold');

    // Get contracts for this company (available + accepted)
    const allContracts = await base44.asServiceRole.entities.Contract.filter({ company_id: company.id });
    const contracts = allContracts.filter(c => c.status === 'available' || c.status === 'accepted');

    // Get employees for this company
    const allEmployees = await base44.asServiceRole.entities.Employee.filter({ company_id: company.id });
    const employees = allEmployees.filter(e => e.status !== 'terminated');

    return Response.json({ company, aircraft, contracts, employees });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
