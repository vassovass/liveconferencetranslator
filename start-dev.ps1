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

Write-Host ""
Write-Host "Starting Vite dev server (window stays open; Ctrl+C to stop)..."
Write-Host ""
npm run dev

Write-Host ""
Write-Host "Dev server stopped. Press Enter to close this window."
[void][System.Console]::ReadLine()

