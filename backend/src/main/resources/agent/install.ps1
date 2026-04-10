# ═══════════════════════════════════════════════════════════════
# BlackWolf SOC Agent — Windows Installer
#
# Installs the BlackWolf SOC agent as a Windows Service using NSSM
# or as a Scheduled Task fallback.
#
# Usage (PowerShell as Administrator):
#   .\install.ps1 -SocUrl <URL> -ApiKey <KEY> -CompanyId <ID>
#
# Or interactively:
#   .\install.ps1
# ═══════════════════════════════════════════════════════════════

param(
    [string]$SocUrl,
    [string]$ApiKey,
    [string]$CompanyId,
    [string]$SensorId = "agent-$env:COMPUTERNAME"
)

$ErrorActionPreference = "Stop"

$AgentDir = "$env:ProgramData\BlackWolfAgent"
$ConfigPath = "$AgentDir\agent.conf"
$ServiceName = "BlackWolfAgent"

function Write-Banner {
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║  BLACKWOLF SOC AGENT INSTALLER (Windows) ║" -ForegroundColor Cyan
    Write-Host "  ║              v1.0.0                      ║" -ForegroundColor Cyan
    Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Ok   { param($msg) Write-Host "  [OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "  [>>] $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "  [!!] $msg" -ForegroundColor Red }

Write-Banner

# ── Admin check ──
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Err "Must run as Administrator"
    exit 1
}

# ── Interactive if missing params ──
if (-not $SocUrl) {
    $SocUrl = Read-Host "  SOC URL (e.g., https://soc.blackwolfsec.io/api/v1)"
}
if (-not $ApiKey) {
    $ApiKey = Read-Host "  API Key"
}
if (-not $CompanyId) {
    $CompanyId = Read-Host "  Company ID"
}

if (-not $SocUrl -or -not $ApiKey -or -not $CompanyId) {
    Write-Err "SOC URL, API Key, and Company ID are required"
    exit 1
}

# ── Check Python3 ──
Write-Info "Checking Python..."
$pythonCmd = $null
foreach ($cmd in @("python3", "python", "py")) {
    try {
        $ver = & $cmd --version 2>&1
        if ($ver -match "Python 3") {
            $pythonCmd = $cmd
            break
        }
    } catch { }
}

if (-not $pythonCmd) {
    Write-Err "Python 3 not found. Download from https://www.python.org/downloads/"
    Write-Err "Make sure to check 'Add Python to PATH' during installation."
    exit 1
}
Write-Ok "Python: $(& $pythonCmd --version)"

# ── Create directories ──
Write-Info "Creating directories..."
New-Item -ItemType Directory -Force -Path $AgentDir | Out-Null
Write-Ok "Directory: $AgentDir"

# ── Create venv and install dependencies ──
Write-Info "Creating Python virtual environment..."
& $pythonCmd -m venv "$AgentDir\venv"
& "$AgentDir\venv\Scripts\pip.exe" install --quiet requests 2>$null
Write-Ok "Virtual environment created with requests module"

# ── Copy agent ──
Write-Info "Installing agent..."
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$scriptDir\blackwolf-agent.py" "$AgentDir\blackwolf-agent.py" -Force
Write-Ok "Agent installed to $AgentDir"

# ── Write config ──
Write-Info "Writing configuration..."
$sysRoot = $env:SystemRoot
$config = @{
    soc_url = $SocUrl
    api_key = $ApiKey
    company_id = $CompanyId
    sensor_id = $SensorId
    heartbeat_interval = 60
    fim_interval = 300
    process_interval = 30
    network_interval = 60
    fim_paths = @(
        "$sysRoot\System32\drivers\etc\hosts",
        "$sysRoot\System32\config\SAM",
        "$sysRoot\System32\config\SYSTEM",
        "$sysRoot\System32\config\SECURITY"
    )
    fim_dirs = @(
        "$sysRoot\System32\Tasks"
    )
    suspicious_processes = @(
        "ncat", "nc.traditional", "nmap", "masscan", "hydra", "john",
        "hashcat", "mimikatz", "meterpreter", "cobalt", "empire",
        "chisel", "plink", "socat", "cryptominer", "xmrig"
    )
    suspicious_ports = @(4444, 5555, 8888, 1234, 31337, 9001, 9002)
    max_batch_size = 50
} | ConvertTo-Json -Depth 3

$config | Out-File -Encoding UTF8 -FilePath $ConfigPath
Write-Ok "Config: $ConfigPath"

# ── Create Scheduled Task (works without NSSM) ──
Write-Info "Creating scheduled task..."

# Remove existing task if present
Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false -ErrorAction SilentlyContinue

$venvPython = "$AgentDir\venv\Scripts\python.exe"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit (New-TimeSpan -Days 365)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Set environment variable for config path and use venv Python
$envAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c set AGENT_CONFIG=$ConfigPath && `"$venvPython`" `"$AgentDir\blackwolf-agent.py`""

Register-ScheduledTask -TaskName $ServiceName -Action $envAction -Trigger $trigger -Settings $settings -Principal $principal -Description "BlackWolf SOC Agent - EDR monitoring" | Out-Null

# Start the task now
Start-ScheduledTask -TaskName $ServiceName
Write-Ok "Scheduled task created and started"

# ── Verify ──
Start-Sleep -Seconds 2
$task = Get-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
if ($task -and $task.State -eq "Running") {
    Write-Ok "Agent is running!"
} else {
    Write-Info "Agent task created. It will start at next boot or you can start it manually."
}

Write-Host ""
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Green
Write-Host "  Installation complete!" -ForegroundColor Green
Write-Host "  ═══════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Useful commands:"
Write-Host "    Status : Get-ScheduledTask -TaskName $ServiceName"
Write-Host "    Start  : Start-ScheduledTask -TaskName $ServiceName"
Write-Host "    Stop   : Stop-ScheduledTask -TaskName $ServiceName"
Write-Host "    Config : $ConfigPath"
Write-Host "    Remove : .\uninstall.ps1"
Write-Host ""
