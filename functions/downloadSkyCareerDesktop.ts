import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const zipPath = new URL('./assets/SkyCareer_Desktop_AllInOne_Windows.zip', import.meta.url);
    const bytes = await Deno.readFile(zipPath);

    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode(...slice);
    }
    const base64 = btoa(binary);

    return Response.json({
      filename: 'SkyCareer_Desktop_AllInOne_Windows.zip',
      mime_type: 'application/zip',
      base64,
      byte_length: bytes.length,
    });
  } catch (error) {
    console.error('Error serving SkyCareer desktop zip:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
