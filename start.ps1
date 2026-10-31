$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
  throw 'Install the project libraries with npm install or pnpm install, then run this script again.'
}
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
