<#
  Build the internal-test Android APK and publish it to the VPS download folder.

  Usage (PowerShell, from E:\KhmerX\KhmerX):
    .\scripts\apk\publish.ps1 -ApiBaseUrl https://<api-host>             # build only
    .\scripts\apk\publish.ps1 -ApiBaseUrl https://<api-host> -Upload -SshTarget root@159.223.92.104

  Result on the VPS (see scripts/apk/README.md for the Caddy part):
    /opt/payease/downloads/khmerx-<version>-<sha8>.apk   immutable file
    /opt/payease/downloads/khmerx-latest.apk             points at the newest file
    /opt/payease/downloads/latest.json                   version, sha256, size, url
#>
param(
  [Parameter(Mandatory = $true)][string]$ApiBaseUrl,
  [switch]$Upload,
  [string]$SshTarget = '',
  [string]$RemoteDir = '/opt/payease/downloads',
  [string]$PublicBase = '',   # e.g. https://khmerx.org/download  (only used for latest.json)
  [ValidateSet('arm64','all')][string]$Abi = 'arm64'   # arm64 = modern phones, ~1/3 the size; 'all' also runs on x86 emulators
)
$ErrorActionPreference = 'Stop'
# Windows PowerShell 5.1 turns native stderr text (flutter/gradle warnings, scp progress) into
# terminating errors under 'Stop'; native failures are checked through $LASTEXITCODE instead.
function Invoke-Native([scriptblock]$Cmd) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { & $Cmd } finally { $ErrorActionPreference = $old }
}
$root = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$mobile = Join-Path $root 'mobile'

if ($ApiBaseUrl -notmatch '^https://') { throw 'ApiBaseUrl must be https:// (Android blocks cleartext in release builds).' }

# 1) Build (release mode, signed with the local debug key: INTERNAL TEST ONLY)
$env:KHMERX_INTERNAL_SIGNING = '1'
Push-Location $mobile
try {
  $abiArgs = if ($Abi -eq 'arm64') { @('--target-platform', 'android-arm64') } else { @() }
  Invoke-Native { flutter build apk --release @abiArgs --dart-define=APP_ENV=production --dart-define=API_BASE_URL=$ApiBaseUrl }
  if ($LASTEXITCODE -ne 0) { throw 'flutter build failed' }
} finally { Pop-Location; Remove-Item Env:\KHMERX_INTERNAL_SIGNING -ErrorAction SilentlyContinue }

$built = Join-Path $mobile 'build\app\outputs\flutter-apk\app-release.apk'
if (-not (Test-Path $built)) { throw "APK not found: $built" }

$pubspec = Get-Content (Join-Path $mobile 'pubspec.yaml') -Raw
$version = if ($pubspec -match '(?m)^version:\s*([0-9A-Za-z\.\+\-]+)') { $Matches[1] -replace '\+.*$', '' } else { '0.0.0' }
$sha = (Get-FileHash $built -Algorithm SHA256).Hash.ToLower()
$name = "khmerx-$version-$($sha.Substring(0,8)).apk"
$outDir = Join-Path $root 'build\apk'
New-Item -ItemType Directory -Force $outDir | Out-Null
Copy-Item $built (Join-Path $outDir $name) -Force
$size = (Get-Item (Join-Path $outDir $name)).Length
$manifest = @{ version = $version; file = $name; sha256 = $sha; size = $size; builtAt = (Get-Date).ToUniversalTime().ToString('o') }
if ($PublicBase) { $manifest.url = "$PublicBase/$name"; $manifest.latestUrl = "$PublicBase/khmerx-latest.apk" }
$manifest | ConvertTo-Json | Set-Content (Join-Path $outDir 'latest.json') -Encoding utf8
"$sha  $name" | Set-Content (Join-Path $outDir "$name.sha256") -Encoding ascii
Write-Host "Built: $outDir\$name  ($([math]::Round($size/1MB,1)) MB)  sha256=$sha"

if (-not $Upload) { Write-Host 'Build only (no -Upload).'; return }
if (-not $SshTarget) { throw '-Upload needs -SshTarget user@host' }

# 2) Upload: file first, verify the hash on the server, then switch "latest"
Invoke-Native { scp (Join-Path $outDir $name) "${SshTarget}:$RemoteDir/$name.part" }
if ($LASTEXITCODE -ne 0) { throw 'scp failed' }
Invoke-Native { scp (Join-Path $outDir 'latest.json') "${SshTarget}:$RemoteDir/latest.json.part" }
$remote = "set -e; cd $RemoteDir; echo '$sha  $name.part' | sha256sum -c -; mv $name.part $name; ln -sfn $name khmerx-latest.apk; mv latest.json.part latest.json; chmod 644 $name latest.json; ls -l $RemoteDir"
Invoke-Native { ssh $SshTarget $remote }
if ($LASTEXITCODE -ne 0) { throw 'remote verify/switch failed' }
Write-Host "Published. Latest: $PublicBase/khmerx-latest.apk"
