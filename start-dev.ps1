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

function Get-KeyFromFile {
  param(
    [string]$Path,
    [string[]]$Names
  )
  if (-not (Test-Path $Path)) { return $null }
  $lines = Get-Content -Path $Path
  foreach ($line in $lines) {
    $trimmed = $line.Trim()
    if ($trimmed -like '#*' -or $trimmed -eq '') { continue }
    $parts = $trimmed -split '=', 2
    if ($parts.Count -lt 2) { continue }
    $name = $parts[0].Trim()
    $val = $parts[1].Trim()
    # strip surrounding quotes
    if ($val.StartsWith('"') -and $val.EndsWith('"')) { $val = $val.Substring(1, $val.Length-2) }
    if ($val.StartsWith("'") -and $val.EndsWith("'")) { $val = $val.Substring(1, $val.Length-2) }
    if ($Names -contains $name) { return $val }
  }
  return $null
}

# Load API key and model from env or .env.local / .env (PowerShell 5 compatible, no ??)
if (-not $env:VITE_GEMINI_API_KEY -and -not $env:GEMINI_API_KEY -and -not $env:API_KEY) {
  $key = Get-KeyFromFile -Path ".env.local" -Names @('VITE_GEMINI_API_KEY','GEMINI_API_KEY','API_KEY')
  if (-not $key) {
    $key = Get-KeyFromFile -Path ".env" -Names @('VITE_GEMINI_API_KEY','GEMINI_API_KEY','API_KEY')
  }
  if ($key) {
    $env:VITE_GEMINI_API_KEY = $key
    Write-Host "Loaded API key from $(if (Test-Path '.env.local') { '.env.local' } else { '.env' }) (length: $($key.Length))"
  }
}

$existingModel = $env:VITE_GEMINI_MODEL
if (-not $existingModel) {
  $model = Get-KeyFromFile -Path ".env.local" -Names @('VITE_GEMINI_MODEL')
  if (-not $model) {
    $model = Get-KeyFromFile -Path ".env" -Names @('VITE_GEMINI_MODEL')
  }
  if ($model) {
    $env:VITE_GEMINI_MODEL = $model
    Write-Host "Loaded model from $(if (Test-Path '.env.local') { '.env.local' } else { '.env' }): $model"
  }
}

function Invoke-SMokeTest {
  Write-Host "Running Gemini model smoke test..."
  $cmd = @'
import { createRequire } from "module";
const cwd = process.env.SMOKE_CWD || process.cwd();
try { process.chdir(cwd); } catch {}
const require = createRequire(cwd + "/");
let GoogleGenAI;
try {
  ({ GoogleGenAI } = require("@google/genai"));
} catch (err) {
  console.error("SMOKE_FAIL Unable to load @google/genai from", cwd, err?.message ?? err);
  process.exit(4);
}
const key = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.API_KEY;
if (!key) {
  console.error("SMOKE_FAIL Missing API key (set VITE_GEMINI_API_KEY or GEMINI_API_KEY).");
  process.exit(2);
}
const client = new GoogleGenAI({ apiKey: key });
try {
  const model = process.env.VITE_GEMINI_MODEL || "models/gemini-2.5-flash-native-audio-preview-09-2025";
  const modelId = model.startsWith("models/") ? model : "models/" + model;
  await client.getModel(modelId);
  console.log("SMOKE_OK", modelId, "reachable");
} catch (e) {
  console.error("SMOKE_FAIL", e?.message ?? e);
  console.error("Ensure this key has access to gemini-2.5-flash-native-audio-preview-09-2025");
  process.exit(3);
}
'@
  $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "gemini-smoke-" + [System.Guid]::NewGuid().ToString() + ".mjs")
  Set-Content -Path $tmp -Value $cmd -Encoding UTF8
  try {
    if (-not $env:NODE_PATH) {
      $env:NODE_PATH = (Join-Path $ScriptDir "node_modules")
    }
    $env:SMOKE_CWD = $ScriptDir
    node $tmp
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Gemini smoke test failed (exit $LASTEXITCODE). Aborting startup."
      exit $LASTEXITCODE
    } else {
      Write-Host "Smoke test passed."
    }
  }
  finally {
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
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

