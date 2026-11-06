# Fast path for updating the magpie plugin: skip `magpie plugin update` (takes ~3 min),
# sync files directly and restart magpie (1s window, then verify HTTP 200).
# NOTE: keep this file pure ASCII. PowerShell 5.1 reads .ps1 as ANSI, so non-ASCII
#       characters turn into mojibake and can break later syntax.
$ErrorActionPreference = 'Stop'

$src = 'D:\DeepSeek Harness\反代\magpie-marvis'
$dst = Join-Path $env:USERPROFILE '.config\magpie\plugins\node_modules\magpie-marvis'
$exe = Join-Path $env:LOCALAPPDATA 'Programs\magpie\magpie.exe'

Write-Host "[1/3] sync files -> $dst"
if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
New-Item -ItemType Directory -Path $dst -Force | Out-Null
Copy-Item (Join-Path $src 'index.mjs')    $dst -Force
Copy-Item (Join-Path $src 'package.json') $dst -Force
Copy-Item (Join-Path $src 'src')          $dst -Recurse -Force
Copy-Item (Join-Path $src 'native')       $dst -Recurse -Force
$ver = (Get-Content (Join-Path $dst 'package.json') -Raw | ConvertFrom-Json).version
Write-Host "      version = $ver"

Write-Host "[2/3] restart magpie"
Get-Process magpie -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 400
Start-Process $exe
Write-Host "      started"

Write-Host "[3/3] verify gateway"
$ok = $false
foreach ($i in 1..40) {
  Start-Sleep -Milliseconds 500
  try {
    $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3425/v1/models' -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch { }
}
if ($ok) { Write-Host "      HTTP 200 OK" } else { Write-Host "      FAILED - start manually: $exe"; exit 1 }
