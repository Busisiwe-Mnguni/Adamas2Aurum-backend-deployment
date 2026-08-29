# ---------------------------------------------------------------------------
# NOTICE: This script was converted from the project's setup.sh (bash) to
# PowerShell with the help of AI (Claude, Anthropic). Please review it before
# relying on it in CI or production tooling.
# ---------------------------------------------------------------------------

<#
.SYNOPSIS
    Installs dependencies, optionally sets up a local MySQL DB via Docker,
    then starts the backend and frontend together.

.USAGE
    .\setup.ps1            # start:backend / start:frontend
    .\setup.ps1 -Dev       # dev:backend / dev:frontend

.NOTES
    Requires PowerShell 5.1+ and, for the DB step, Docker Desktop.
    If your terminal blocks script execution, run:
        powershell -ExecutionPolicy Bypass -File .\setup.ps1
#>

param(
    [switch]$Dev
)

$ErrorActionPreference = "Stop"

# ---------- config ----------
$EnvExample = "app/src/backend/.env.example"
$EnvFile    = "app/src/backend/.env"
$Mode       = if ($Dev) { "dev" } else { "start" }

# ---------- helpers ----------
function Info { param($msg) Write-Host "[info] $msg" -ForegroundColor Blue }
function Warn { param($msg) Write-Host "[warn] $msg" -ForegroundColor Yellow }
function Fail { param($msg) Write-Host "[error] $msg" -ForegroundColor Red }

# Runs an external command and throws if it exits non-zero (mirrors `set -e`,
# since PowerShell doesn't stop on a failed native command by default).
function Invoke-Checked {
    param(
        [Parameter(Mandatory)] [string]$FilePath,
        [Parameter(Mandatory)] [string[]]$ArgumentList
    )
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath $($ArgumentList -join ' ') failed with exit code $LASTEXITCODE"
    }
}

function Read-YesNo {
    param([string]$Prompt)
    while ($true) {
        $reply = Read-Host "$Prompt [y/N]"
        switch -Regex ($reply) {
            '^[Yy]$'    { return $true }
            '^[Nn]$|^$' { return $false }
            default     { Write-Host "Please answer y or n." }
        }
    }
}

# ---------- 1. install deps ----------
Info "Installing dependencies..."
Invoke-Checked "npm.cmd" @("run", "install-deps")

# ---------- 2. optional local DB setup ----------
if (Read-YesNo "Would you like to set up a local MySQL DB using Docker?") {

    Info "Checking for Docker..."
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Fail "Docker is not installed or not on PATH. Install it first: https://docs.docker.com/get-docker/"
        exit 1
    }

    Info "Checking for Docker Compose..."
    & docker compose version *> $null
    if ($LASTEXITCODE -ne 0) {
        Fail "Docker Compose is not available. Install it first: https://docs.docker.com/compose/install/"
        exit 1
    }

    if (Test-Path $EnvFile) {
        Info "$EnvFile already exists."
    }
    elseif (Test-Path $EnvExample) {
        Info "Copying $EnvExample to $EnvFile..."
        Copy-Item $EnvExample $EnvFile
    }
    else {
        Warn "$EnvExample not found."
    }

    # Note: unlike the bash version, this does NOT use sudo. Docker Desktop on
    # Windows manages permissions itself, so elevation is normally unnecessary.
    # If you hit a permissions error, re-launch this script from an elevated
    # ("Run as Administrator") PowerShell window instead.
    Info "Starting the database..."
    Invoke-Checked "npm.cmd" @("run", "db:up")

    Info "Resetting the database"
    Invoke-Checked "npm.cmd" @("run", "db:reset")

    Info "Seeding the database"
    Invoke-Checked "npm.cmd" @("run", "db:seed")

    @"

Database is up.

Usage:
  Stop the database:   npm run db:down
  Delete DB entirely:  docker compose down -v   (run from app/src/backend)

"@ | Write-Host
}
else {
    Info "Skipping local database setup."
}

# ---------- 3. run backend + frontend together ----------
Info "Starting backend and frontend in $Mode mode... (Ctrl+C stops both)"

$backendProc  = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "$Mode`:backend"  -NoNewWindow -PassThru
$frontendProc = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "$Mode`:frontend" -NoNewWindow -PassThru

try {
    Wait-Process -Id $backendProc.Id, $frontendProc.Id
}
finally {
    Info "Stopping services..."
    Stop-Process -Id $backendProc.Id  -ErrorAction SilentlyContinue
    Stop-Process -Id $frontendProc.Id -ErrorAction SilentlyContinue
}

