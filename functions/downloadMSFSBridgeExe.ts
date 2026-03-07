import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const zipPath = new URL('./assets/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url);
    const bytes = await Deno.readFile(zipPath);

    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="SkyCareer_MSFS_Bridge_Windows.zip"'
      }
    });
  } catch (error) {
    console.error('Error serving MSFS bridge exe zip:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

