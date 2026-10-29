# UGN local GitHub Release updater (Windows PowerShell 5.1+).
# Run from start_windows.bat after the Node server exits, or manually with the server stopped.
# Updates app code only. All private settings live in data/ and are never modified, apart from update status files.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$data = Join-Path $root 'data'
$pendingPath = Join-Path $data 'pending-update.json'
$resultPath = Join-Path $data 'update-result.json'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('ugn-update-' + [guid]::NewGuid().ToString('N'))
$stage = Join-Path $temp 'staging'
$backup = Join-Path $temp 'backup'
$copied = New-Object System.Collections.Generic.List[string]
$backedUp = New-Object System.Collections.Generic.List[string]
$applyStarted = $false

# Only files on this explicit list can ever be installed by a release.
$allowed = @(
  'server.js', 'server.test.js', 'update-manager.js', 'update.test.js',
  'index.html', 'package.json', 'README.md', 'GITHUB_UPDATE_SETUP.md',
  'start_windows.bat', 'update_windows.bat', 'update_windows.ps1', '.gitignore',
  '.github/workflows/release.yml'
)
$required = @('server.js','update-manager.js','index.html','package.json','start_windows.bat','update_windows.ps1')

function Save-Result([bool]$success, [string]$message) {
  New-Item -ItemType Directory -Path $data -Force | Out-Null
  $json = @{success=$success;message=$message;at=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json
  [IO.File]::WriteAllText($resultPath, $json, (New-Object Text.UTF8Encoding($false)))
}
function Require([bool]$condition,[string]$message) {
  if (-not $condition) { throw $message }
}
try {
  Require (Test-Path -LiteralPath $pendingPath) 'No pending update. Use Check for updates and Install update in the dashboard first.'
  $pending = Get-Content -LiteralPath $pendingPath -Raw | ConvertFrom-Json
  Require ([string]$pending.repository -match '^[a-zA-Z0-9-]+/[a-zA-Z0-9_.-]+$') 'Invalid saved repository.'
  Require ([string]$pending.tag -cmatch '^v[0-9]+\.[0-9]+\.[0-9]+$') 'Invalid update version tag.'
  Require ([string]$pending.digest -match '^sha256:[0-9a-f]{64}$') 'Missing verified SHA-256.'
  $repo = [string]$pending.repository
  $tag = [string]$pending.tag
  $releaseZip = 'ugn-auto-advertiser.zip'
  $expectedUrl = "https://github.com/$repo/releases/download/$tag/$releaseZip"
  Require ([string]$pending.url -ceq $expectedUrl) 'Update URL is not a release asset from your configured GitHub repository.'
  $api = "https://api.github.com/repos/$repo/releases/latest"
  Write-Host "Checking latest published GitHub release for $repo..."
  $headers = @{'Accept'='application/vnd.github+json';'User-Agent'='UGN-Windows-Updater';'X-GitHub-Api-Version'='2026-03-10'}
  $release = Invoke-RestMethod -Uri $api -Headers $headers -TimeoutSec 20
  Require ([string]$release.tag_name -ceq $tag) 'The latest GitHub release has changed. Go back and check again.'
  Require (-not ($release.draft -or $release.prerelease)) 'Cannot install an unpublished or prerelease build.'
  $asset = @($release.assets | Where-Object { $_.name -ceq $releaseZip -and $_.state -ceq 'uploaded' }) | Select-Object -First 1
  Require ($null -ne $asset) 'The release has no updater ZIP asset. The GitHub workflow may still be running.'
  Require ([string]$asset.browser_download_url -ceq $expectedUrl) 'Release asset URL changed.'
  Require ([string]$asset.digest -ceq [string]$pending.digest) 'Release package digest changed. Run Check for updates again.'
  Require ([int64]$asset.size -gt 0 -and [int64]$asset.size -le 15728640) 'Release package is larger than 15 MB or empty.'

  New-Item -Path $stage,$backup -ItemType Directory -Force | Out-Null
  $archive = Join-Path $temp 'download.zip'
  Write-Host "Downloading $tag from GitHub..."
  Invoke-WebRequest -Uri $expectedUrl -OutFile $archive -UseBasicParsing -TimeoutSec 90
  Require ((Get-Item -LiteralPath $archive).Length -le 15728640) 'Downloaded package exceeds size limit.'
  $hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  Require (('sha256:' + $hash) -ceq [string]$pending.digest) 'SHA-256 check failed. No files were changed.'

  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [IO.Compression.ZipFile]::OpenRead($archive)
  try {
    $files = @()
    foreach ($item in $zip.Entries) {
      $name = [string]$item.FullName
      if ($name.EndsWith('/')) {
        Require ($name -in @('.github/', '.github/workflows/')) "Disallowed directory in ZIP: $name"
        continue
      }
      Require ($name -in $allowed) "Disallowed file in update archive: $name"
      Require ($name -notmatch '(\\|\.\.|:)' -and -not $name.StartsWith('/')) "Unsafe ZIP entry: $name"
      # Reject UNIX symlinks encoded in a ZIP.
      $unixType = (($item.ExternalAttributes -shr 16) -band 61440)
      Require ($unixType -ne 40960) "Symbolic links are not permitted: $name"
      Require ($files -notcontains $name) "Duplicate ZIP entry: $name"
      $files += $name
    }
    foreach ($needed in $required) { Require ($files -contains $needed) "Required application file missing: $needed" }
  } finally { $zip.Dispose() }

  [IO.Compression.ZipFile]::ExtractToDirectory($archive,$stage)
  $manifest = Get-Content -LiteralPath (Join-Path $stage 'package.json') -Raw | ConvertFrom-Json
  Require ([string]$manifest.name -ceq 'ugn-advertising-command-center') 'The downloaded package is not a UGN website build.'
  Require (('v' + [string]$manifest.version) -ceq $tag) 'The application version does not match the release tag.'
  $current = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
  $cv = [version][string]$current.version
  $nv = [version][string]$manifest.version
  Require ($nv -gt $cv) 'This GitHub release is not newer than your currently installed website.'

  Write-Host "Verified $tag. Making a backup of application files..."
  foreach ($rel in $files) {
    $existing = Join-Path $root $rel
    if (Test-Path -LiteralPath $existing) {
      $saveTo = Join-Path $backup $rel
      New-Item -ItemType Directory -Path (Split-Path -Parent $saveTo) -Force | Out-Null
      Copy-Item -LiteralPath $existing -Destination $saveTo -Force
      $backedUp.Add($rel)
    }
  }
  $applyStarted = $true
  foreach ($rel in $files) {
    $target = Join-Path $root $rel
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    $copied.Add($rel)
    Copy-Item -LiteralPath (Join-Path $stage $rel) -Destination $target -Force
  }
  Remove-Item -LiteralPath $pendingPath -Force
  Save-Result $true "Installed UGN version $($manifest.version). Your schedules, campaign, and private Discord webhooks were preserved."
  Write-Host 'Update installed successfully!'
  exit 0
} catch {
  $err = $_.Exception.Message
  Write-Host "Update failed: $err" -ForegroundColor Red
  if ($applyStarted) {
    Write-Host 'Restoring previous application files...'
    foreach ($rel in $copied) {
      $target = Join-Path $root $rel
      if ($backedUp.Contains($rel)) {
        Copy-Item -LiteralPath (Join-Path $backup $rel) -Destination $target -Force
      } elseif (Test-Path -LiteralPath $target) {
        Remove-Item -LiteralPath $target -Force
      }
    }
  }
  Save-Result $false $err
  if (Test-Path -LiteralPath $pendingPath) { Remove-Item -LiteralPath $pendingPath -Force }
  exit 1
} finally {
  if (Test-Path -LiteralPath $temp) { Remove-Item -LiteralPath $temp -Recurse -Force -ErrorAction SilentlyContinue }
}
