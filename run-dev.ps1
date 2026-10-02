$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSCommandPath
$localNodeDir = Join-Path $workspace '.tools\node-v22.22.2-win-x64'
$localNpm = Join-Path $localNodeDir 'npm.cmd'
$nodeModules = Join-Path $workspace 'node_modules'

$npmCommand = $null

if (Get-Command npm -ErrorAction SilentlyContinue) {
  $npmCommand = 'npm'
} elseif (Test-Path $localNpm) {
  $env:Path = "$localNodeDir;$env:Path"
  $npmCommand = $localNpm
} else {
  Write-Error "Node.js was not found. Install Node.js or place the portable runtime in $localNodeDir."
}

if (-not (Test-Path $nodeModules)) {
  Write-Host 'Installing dependencies...'
  & $npmCommand install
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
}

Write-Host 'Starting dev server on http://localhost:3000 ...'
& $npmCommand run dev
exit $LASTEXITCODE
