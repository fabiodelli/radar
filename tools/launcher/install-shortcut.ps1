# Crea (o aggiorna) la scorciatoia "Radar" sul desktop puntata a dist-app/Radar.exe.
# Uso: powershell -ExecutionPolicy Bypass -File tools\launcher\install-shortcut.ps1

$root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$exe = Join-Path $root "dist-app\Radar.exe"
$ico = Join-Path $root "dist-app\radar.ico"

if (-not (Test-Path $exe)) {
  Write-Error "Radar.exe non trovato. Esegui prima: npm run build:exe"
  exit 1
}

$lnk = Join-Path ([Environment]::GetFolderPath('Desktop')) "Radar.lnk"
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = $exe
$sc.WorkingDirectory = (Split-Path $exe)
if (Test-Path $ico) { $sc.IconLocation = "$ico,0" }
$sc.Description = "Avvia Radar - tool di prospecting"
$sc.Save()
Write-Output "Scorciatoia creata/aggiornata: $lnk"
