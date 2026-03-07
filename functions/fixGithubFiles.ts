import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { accessToken } = await base44.asServiceRole.connectors.getConnection('github');

  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Find repos
  const reposRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=pushed', { headers });
  const repos = await reposRes.json();

  if (!Array.isArray(repos)) {
    return Response.json({ error: 'Could not fetch repos', details: repos }, { status: 500 });
  }

  // Find repo containing this project
  let targetRepo = null;
  for (const repo of repos) {
    const checkRes = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/pages`, { headers });
    if (checkRes.ok) {
      const contents = await checkRes.json();
      if (Array.isArray(contents) && contents.some(f => f.name.toLowerCase().includes('flighttracker'))) {
        targetRepo = repo.full_name;
        break;
      }
    }
  }

  if (!targetRepo) {
    // Try src/pages
    for (const repo of repos) {
      const checkRes = await fetch(`https://api.github.com/repos/${repo.full_name}/contents/src/pages`, { headers });
      if (checkRes.ok) {
        const contents = await checkRes.json();
        if (Array.isArray(contents) && contents.some(f => f.name.toLowerCase().includes('flighttracker'))) {
          targetRepo = repo.full_name;
          break;
        }
      }
    }
  }

  if (!targetRepo) {
    return Response.json({ 
      error: 'Could not find the repo',
      repos: repos.map(r => r.full_name)
    }, { status: 404 });
  }

  async function getFile(path) {
    const res = await fetch(`https://api.github.com/repos/${targetRepo}/contents/${path}`, { headers });
    if (!res.ok) return null;
    return await res.json();
  }

  async function updateFile(path, newContent, sha, message) {
    const bytes = new TextEncoder().encode(newContent);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    const encoded = btoa(binary);
    const res = await fetch(`https://api.github.com/repos/${targetRepo}/contents/${path}`, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, content: encoded, sha })
    });
    const json = await res.json();
    return { ok: res.ok, status: res.status, msg: json.commit?.message || json.message };
  }

  const results = [];

  // Fix progress bar
  const correctProgress = `"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-2 w-full overflow-hidden rounded-full bg-slate-700",
      className
    )}
    {...props}>
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-cyan-400 transition-all"
      style={{ transform: \`translateX(-\${100 - (value || 0)}%)\` }} />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
`;

  const progressPaths = [
    'src/components/ui/progress.jsx',
    'src/components/ui/progress.tsx',
    'components/ui/progress.jsx',
    'components/ui/progress.tsx'
  ];

  for (const p of progressPaths) {
    const file = await getFile(p);
    if (file?.sha) {
      const r = await updateFile(p, correctProgress, file.sha, 'fix: progress bar bg-slate-700 track + bg-cyan-400 fill');
      results.push({ file: p, ...r });
      break;
    }
  }

  return Response.json({ targetRepo, results });
});