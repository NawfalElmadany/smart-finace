$ErrorActionPreference = 'Stop'

$workspace = Split-Path -Parent $PSCommandPath
$jdkPath = Join-Path $env:LOCALAPPDATA 'Programs\Microsoft\jdk-21.0.10.7-hotspot'
$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'

if (-not (Test-Path $jdkPath)) {
  Write-Error "JDK 21 was not found at $jdkPath"
}

if (-not (Test-Path $sdkRoot)) {
  Write-Error "Android SDK was not found at $sdkRoot"
}

$env:JAVA_HOME = $jdkPath
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:Path = "$jdkPath\bin;$sdkRoot\platform-tools;$env:Path"

Write-Host 'Building web assets...'
& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Write-Host 'Syncing Capacitor Android project...'
& npx.cmd cap sync android
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

Push-Location (Join-Path $workspace 'android')
try {
  Write-Host 'Assembling debug APK...'
  & .\gradlew.bat assembleDebug
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
} finally {
  Pop-Location
}

$apkSource = Join-Path $workspace 'android\app\build\outputs\apk\debug\app-debug.apk'
$apkTarget = Join-Path $workspace 'smart-finance-debug.apk'

if (Test-Path $apkSource) {
  Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force
  Write-Host "APK generated: $apkSource"
  Write-Host "Copied to: $apkTarget"
} else {
  Write-Error "APK not found at $apkSource"
}
