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
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await resolveCompany(base44, user);
    if (!company) {
      return Response.json({ contracts: [] });
    }

    // Use service role to get all contracts for this company
    const companyContracts = await base44.asServiceRole.entities.Contract.filter({ company_id: company.id });
    
    // Return available + accepted contracts
    const relevantContracts = companyContracts.filter(c => 
      c.status === 'available' || c.status === 'accepted'
    );
    
    return Response.json({ contracts: relevantContracts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
