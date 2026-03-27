import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import JSZip from 'npm:jszip@3.10.1';

const API_ENDPOINT_DEFAULT = 'https://aero-career-pilot.base44.app/api/functions/receiveXPlaneData';
const BRIDGE_ZIP_CANDIDATES = [
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('./assets/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows_20260311.zip', import.meta.url),
  new URL('../../../../public/downloads/SkyCareer_MSFS_Bridge_Windows.zip', import.meta.url),
];
const BRIDGE_LAUNCHER_CMD = `@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0SkyCareerBridgeLauncher.ps1"
`;
const BRIDGE_LAUNCHER_PS1 = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bridgeExe = Join-Path $root 'SkyCareerMsfsBridge.exe'
$desktopExe = Join-Path $root 'SkyCareerDesktop.exe'
$runningProcess = $null
$runningExePath = $null
$monitorEnabled = $true

function Get-SimState {
  $msfsNames = @('FlightSimulator', 'FlightSimulator2024')
  $xpNames = @('X-Plane', 'X-Plane12', 'XPlane', 'XPlane12')
  $msfs = Get-Process -ErrorAction SilentlyContinue | Where-Object { $msfsNames -contains $_.ProcessName } | Select-Object -First 1
  if ($msfs) { return @{ active = $true; name = 'MSFS'; process = $msfs.ProcessName } }
  $xp = Get-Process -ErrorAction SilentlyContinue | Where-Object { $xpNames -contains $_.ProcessName } | Select-Object -First 1
  if ($xp) { return @{ active = $true; name = 'X-Plane 12'; process = $xp.ProcessName } }
  return @{ active = $false; name = 'None'; process = '' }
}

function Resolve-BridgeExe([string]$simName) {
  if ($simName -eq 'X-Plane 12' -and (Test-Path $desktopExe)) { return $desktopExe }
  if (Test-Path $bridgeExe) { return $bridgeExe }
  if (Test-Path $desktopExe) { return $desktopExe }
  return $null
}

function Start-Bridge([string]$exePath) {
  if ([string]::IsNullOrWhiteSpace($exePath)) { return $null }
  if (-not (Test-Path $exePath)) { return $null }
  try {
    return Start-Process -FilePath $exePath -WorkingDirectory (Split-Path -Parent $exePath) -WindowStyle Hidden -PassThru
  } catch {
    return $null
  }
}

function Stop-Bridge {
  if ($script:runningProcess -and -not $script:runningProcess.HasExited) {
    try { Stop-Process -Id $script:runningProcess.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
  $script:runningProcess = $null
  $script:runningExePath = $null
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'SkyCareer Bridge'
$form.Size = New-Object System.Drawing.Size(520, 300)
$form.StartPosition = 'CenterScreen'
$form.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$form.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false

$title = New-Object System.Windows.Forms.Label
$title.Text = 'SkyCareer Bridge Monitor'
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 16, [System.Drawing.FontStyle]::Bold)
$title.AutoSize = $true
$title.Location = New-Object System.Drawing.Point(18, 18)
$form.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Starts/stops bridge automatically when MSFS or X-Plane 12 opens/closes.'
$subtitle.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$subtitle.AutoSize = $true
$subtitle.Location = New-Object System.Drawing.Point(20, 52)
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$form.Controls.Add($subtitle)

$simStatusLabel = New-Object System.Windows.Forms.Label
$simStatusLabel.Text = 'Simulator: waiting ...'
$simStatusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$simStatusLabel.AutoSize = $true
$simStatusLabel.Location = New-Object System.Drawing.Point(20, 96)
$form.Controls.Add($simStatusLabel)

$bridgeStatusLabel = New-Object System.Windows.Forms.Label
$bridgeStatusLabel.Text = 'Bridge: idle'
$bridgeStatusLabel.Font = New-Object System.Drawing.Font('Segoe UI', 10, [System.Drawing.FontStyle]::Bold)
$bridgeStatusLabel.AutoSize = $true
$bridgeStatusLabel.Location = New-Object System.Drawing.Point(20, 126)
$form.Controls.Add($bridgeStatusLabel)

$pathLabel = New-Object System.Windows.Forms.Label
$pathLabel.Text = 'Executable: -'
$pathLabel.Font = New-Object System.Drawing.Font('Consolas', 9)
$pathLabel.AutoSize = $true
$pathLabel.Location = New-Object System.Drawing.Point(20, 160)
$pathLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$form.Controls.Add($pathLabel)

$monitorLabel = New-Object System.Windows.Forms.Label
$monitorLabel.Text = 'Monitor: ON (2s)'
$monitorLabel.Font = New-Object System.Drawing.Font('Segoe UI', 9)
$monitorLabel.AutoSize = $true
$monitorLabel.Location = New-Object System.Drawing.Point(20, 190)
$monitorLabel.ForeColor = [System.Drawing.Color]::FromArgb(94, 234, 212)
$form.Controls.Add($monitorLabel)

$toggleButton = New-Object System.Windows.Forms.Button
$toggleButton.Text = 'Pause Monitor'
$toggleButton.Size = New-Object System.Drawing.Size(150, 34)
$toggleButton.Location = New-Object System.Drawing.Point(20, 225)
$toggleButton.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$toggleButton.ForeColor = [System.Drawing.Color]::White
$toggleButton.FlatStyle = 'Flat'
$toggleButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
$form.Controls.Add($toggleButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = 'Stop Bridge'
$stopButton.Size = New-Object System.Drawing.Size(120, 34)
$stopButton.Location = New-Object System.Drawing.Point(184, 225)
$stopButton.BackColor = [System.Drawing.Color]::FromArgb(127, 29, 29)
$stopButton.ForeColor = [System.Drawing.Color]::White
$stopButton.FlatStyle = 'Flat'
$stopButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(248, 113, 113)
$form.Controls.Add($stopButton)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 2000

function Refresh-State {
  $sim = Get-SimState
  $simStatusLabel.Text = 'Simulator: ' + (if ($sim.active) { $sim.name + ' (' + $sim.process + ')' } else { 'not running' })
  if (-not $script:monitorEnabled) {
    $monitorLabel.Text = 'Monitor: OFF'
    $monitorLabel.ForeColor = [System.Drawing.Color]::FromArgb(251, 191, 36)
    $bridgeStatusLabel.Text = 'Bridge: manual mode'
    return
  }

  $monitorLabel.Text = 'Monitor: ON (2s)'
  $monitorLabel.ForeColor = [System.Drawing.Color]::FromArgb(94, 234, 212)
  $targetExe = Resolve-BridgeExe $sim.name
  $pathLabel.Text = 'Executable: ' + (if ($targetExe) { $targetExe } else { '-' })

  if ($sim.active) {
    $needsStart = $false
    if (-not $script:runningProcess -or $script:runningProcess.HasExited) {
      $needsStart = $true
    } elseif ($script:runningExePath -ne $targetExe) {
      Stop-Bridge
      $needsStart = $true
    }
    if ($needsStart -and $targetExe) {
      $script:runningProcess = Start-Bridge $targetExe
      $script:runningExePath = $targetExe
    }
  } else {
    Stop-Bridge
  }

  if ($script:runningProcess -and -not $script:runningProcess.HasExited) {
    $bridgeStatusLabel.Text = 'Bridge: running (PID ' + $script:runningProcess.Id + ')'
    $bridgeStatusLabel.ForeColor = [System.Drawing.Color]::FromArgb(74, 222, 128)
  } else {
    $bridgeStatusLabel.Text = 'Bridge: idle'
    $bridgeStatusLabel.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
  }
}

$toggleButton.Add_Click({
  $script:monitorEnabled = -not $script:monitorEnabled
  $toggleButton.Text = if ($script:monitorEnabled) { 'Pause Monitor' } else { 'Resume Monitor' }
  if (-not $script:monitorEnabled) { Stop-Bridge }
  Refresh-State
})

$stopButton.Add_Click({
  Stop-Bridge
  Refresh-State
})

$timer.Add_Tick({ Refresh-State })
$form.Add_Shown({
  Refresh-State
  $timer.Start()
})
$form.Add_FormClosing({
  $timer.Stop()
  Stop-Bridge
})

[void]$form.ShowDialog()
`;

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

async function readFirstAvailable(candidates: URL[]) {
  for (const candidate of candidates) {
    try {
      return await Deno.readFile(candidate);
    } catch {
      // try next
    }
  }
  throw new Error('Bridge zip asset not found');
}

function upsertAppSetting(configText: string, key: string, value: string) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const keyRegex = new RegExp(`(<add\\s+key="${escapedKey}"\\s+value=")[^"]*(")`, 'i');
  if (keyRegex.test(configText)) {
    return configText.replace(keyRegex, `$1${value}$2`);
  }
  return configText.replace(
    /<\/appSettings>/i,
    `    <add key="${key}" value="${value}" />\n  </appSettings>`
  );
}

function patchBridgeConfig(configText: string, apiKey: string, endpoint: string) {
  let patched = configText;
  patched = upsertAppSetting(patched, 'ApiEndpoint', endpoint);
  patched = upsertAppSetting(patched, 'ApiKey', apiKey);
  patched = upsertAppSetting(patched, 'LoopIntervalMs', '2000');
  patched = upsertAppSetting(patched, 'PollIntervalMs', '2000');
  patched = upsertAppSetting(patched, 'SendIntervalMs', '2000');
  patched = upsertAppSetting(patched, 'SampleIntervalMs', '200');
  patched = upsertAppSetting(patched, 'HttpTimeoutMs', '10000');
  patched = upsertAppSetting(patched, 'Simulator', 'auto');
  patched = upsertAppSetting(patched, 'AutoStartOnSimulator', 'true');
  patched = upsertAppSetting(patched, 'MonitorProcesses', 'FlightSimulator;FlightSimulator2024;X-Plane;X-Plane12;XPlane;XPlane12');
  return patched;
}

function normalizeZipPath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function basename(path: string) {
  const normalized = normalizeZipPath(path);
  const parts = normalized.split('/');
  return parts[parts.length - 1] || normalized;
}

async function ensureCompanyApiKey(base44: any, user: any) {
  const companies = await base44.entities.Company.filter({ created_by: user.email });
  const company = companies[0];
  if (!company) {
    throw new Error('Company not found');
  }
  let apiKey = company.xplane_api_key;
  if (!apiKey) {
    apiKey = crypto.randomUUID();
    await base44.entities.Company.update(company.id, { xplane_api_key: apiKey });
  }
  return { company, apiKey };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { apiKey } = await ensureCompanyApiKey(base44, user);
    const endpoint = API_ENDPOINT_DEFAULT;
    const sourceZipBytes = await readFirstAvailable(BRIDGE_ZIP_CANDIDATES);

    const sourceZip = await JSZip.loadAsync(sourceZipBytes);
    const outputZip = new JSZip();

    for (const [name, file] of Object.entries(sourceZip.files)) {
      if (file.dir) continue;
      const targetName = normalizeZipPath(name);
      if (!targetName) continue;
      const fileName = basename(targetName).toLowerCase();

      if (fileName === 'skycareermsfsbridge.exe.config') {
        const configText = await file.async('string');
        outputZip.file(targetName, patchBridgeConfig(configText, apiKey, endpoint));
      } else {
        const data = await file.async('uint8array');
        outputZip.file(targetName, data);
      }
    }
    outputZip.file('SkyCareerBridgeLauncher.cmd', BRIDGE_LAUNCHER_CMD);
    outputZip.file('SkyCareerBridgeLauncher.ps1', BRIDGE_LAUNCHER_PS1);

    const finalZipBytes = await outputZip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return Response.json({
      filename: 'SkyCareer_MSFS_Bridge_Windows.zip',
      mime_type: 'application/zip',
      base64: toBase64(finalZipBytes),
      byte_length: finalZipBytes.length,
      personalized: true,
    });
  } catch (error) {
    console.error('Error serving personalized MSFS bridge exe zip:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});
