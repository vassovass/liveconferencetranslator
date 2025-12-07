Param(
  [switch]$Inspect
)

$ErrorActionPreference = "Stop"

# Move to repo root (where this script lives)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ScriptDir

Write-Host "[liveconferencetranslator] Optional: use -Inspect to enable Node inspector on port 9229."

if ($Inspect) {
  $env:NODE_OPTIONS="--inspect"
  Write-Host "Node inspector enabled on port 9229 (NODE_OPTIONS=--inspect)"
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing npm dependencies..."
  npm install
}

# Load API key from env or .env.local
if (-not $env:VITE_GEMINI_API_KEY -and -not $env:GEMINI_API_KEY -and -not $env:API_KEY) {
  if (Test-Path ".env.local") {
    $match = Select-String -Path ".env.local" -Pattern "VITE_GEMINI_API_KEY\s*=\s*(.+)" | Select-Object -First 1
    if ($match) {
      $env:VITE_GEMINI_API_KEY = $match.Matches[0].Groups[1].Value.Trim()
      Write-Host "Loaded VITE_GEMINI_API_KEY from .env.local"
    }
  }
}

function Invoke-SMokeTest {
  Write-Host "Running Gemini model smoke test..."
  $cmd = @"
import { GoogleGenAI } from '@google/genai';
const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!key) {
  console.error('SMOKE_FAIL Missing API key (set VITE_GEMINI_API_KEY or GEMINI_API_KEY).');
  process.exit(2);
}
const client = new GoogleGenAI({ apiKey: key });
try {
  await client.getModel('models/gemini-1.5-flash');
  console.log('SMOKE_OK model reachable');
} catch (e) {
  console.error('SMOKE_FAIL', e?.message ?? e);
  process.exit(3);
}
"@
  node --input-type=module -e $cmd
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Gemini smoke test failed (exit $LASTEXITCODE). Aborting startup."
    exit $LASTEXITCODE
  } else {
    Write-Host "Smoke test passed."
  }
}

Invoke-SMokeTest

Write-Host ""
Write-Host "Starting Vite dev server (window stays open; Ctrl+C to stop)..."
Write-Host ""
npm run dev

Write-Host ""
Write-Host "Dev server stopped. Press Enter to close this window."
[void][System.Console]::ReadLine()

