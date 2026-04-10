# BlackWolf SOC Agent — Windows Uninstaller
# Run as Administrator

$ErrorActionPreference = "Stop"

$AgentDir = "$env:ProgramData\BlackWolfAgent"
$ServiceName = "BlackWolfAgent"

Write-Host "Uninstalling BlackWolf SOC Agent (Windows)..." -ForegroundColor Cyan

# Stop and remove scheduled task
$task = Get-ScheduledTask -TaskName $ServiceName -ErrorAction SilentlyContinue
if ($task) {
    if ($task.State -eq "Running") {
        Stop-ScheduledTask -TaskName $ServiceName
        Write-Host "  Stopped task"
    }
    Unregister-ScheduledTask -TaskName $ServiceName -Confirm:$false
    Write-Host "  Removed scheduled task"
}

# Remove agent directory
if (Test-Path $AgentDir) {
    Remove-Item -Recurse -Force $AgentDir
    Write-Host "  Removed $AgentDir"
}

Write-Host "Done. BlackWolf SOC Agent has been removed." -ForegroundColor Green
