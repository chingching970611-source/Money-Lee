$root = Split-Path -Parent $PSScriptRoot
$www = Join-Path $root "www"
$icons = Join-Path $www "icons"
$vendor = Join-Path $www "vendor"

New-Item -ItemType Directory -Force -Path $www | Out-Null
New-Item -ItemType Directory -Force -Path $icons | Out-Null
New-Item -ItemType Directory -Force -Path $vendor | Out-Null

Copy-Item -LiteralPath (Join-Path $root "index.html") -Destination (Join-Path $www "index.html") -Force
Copy-Item -LiteralPath (Join-Path $root "styles.css") -Destination (Join-Path $www "styles.css") -Force
Copy-Item -LiteralPath (Join-Path $root "script.js") -Destination (Join-Path $www "script.js") -Force
Copy-Item -LiteralPath (Join-Path $root "manifest.webmanifest") -Destination (Join-Path $www "manifest.webmanifest") -Force
Copy-Item -LiteralPath (Join-Path $root "service-worker.js") -Destination (Join-Path $www "service-worker.js") -Force
Copy-Item -LiteralPath (Join-Path $root "icons\icon.svg") -Destination (Join-Path $icons "icon.svg") -Force
Copy-Item -LiteralPath (Join-Path $root "icons\icon-192.png") -Destination (Join-Path $icons "icon-192.png") -Force
Copy-Item -LiteralPath (Join-Path $root "icons\icon-512.png") -Destination (Join-Path $icons "icon-512.png") -Force
Copy-Item -Path (Join-Path $root "vendor\*") -Destination $vendor -Recurse -Force
