# setup.ps1 — Windows wrapper for the cross-platform Node.js installer
# Usage: powershell -NoProfile -File setup.ps1 [-Uninstall] [-Test]
param(
    [switch]$Uninstall,
    [switch]$Test
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Check Node.js is available
try {
    $null = Get-Command node -ErrorAction Stop
} catch {
    Write-Host "[FAIL] Node.js is required but not found." -ForegroundColor Red
    Write-Host "       Claude Code requires Node.js, so it should be installed." -ForegroundColor Red
    Write-Host "       Install: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

$setupScript = Join-Path $scriptDir "setup.js"

if ($Uninstall) {
    node $setupScript --uninstall
} elseif ($Test) {
    node $setupScript --test
} else {
    node $setupScript
}

exit $LASTEXITCODE
