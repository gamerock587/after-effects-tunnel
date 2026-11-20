$ErrorActionPreference = 'Stop'
$destination = Join-Path $env:APPDATA 'Adobe\CEP\extensions\local.aftereffect.tunnel'
if (Test-Path -LiteralPath $destination) { throw 'Tunnel extension already exists. Close its panel and back up/remove that installation before reinstalling.' }
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'panel\index.html'), (Join-Path $PSScriptRoot 'panel\bridge.js') -Destination $destination
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'panel\CSXS') -Destination $destination -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'host') -Destination $destination -Recurse
Write-Output "Panel files copied to $destination"
Write-Output 'No security, registry, or scripting preferences were changed.'
Write-Output 'Restart AE when convenient, then Window > Extensions > After Effect Tunnel.'
Write-Output 'If unsigned CEP panels are blocked, use tunnel.py --mode script; this installer does not bypass that restriction.'
