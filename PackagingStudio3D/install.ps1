# Packaging Studio 3D Installer
$ErrorActionPreference = "Stop"

$regKeys = @(
    "HKCU:\Software\Adobe\CSXS.7",
    "HKCU:\Software\Adobe\CSXS.8",
    "HKCU:\Software\Adobe\CSXS.9",
    "HKCU:\Software\Adobe\CSXS.10",
    "HKCU:\Software\Adobe\CSXS.11",
    "HKCU:\Software\Adobe\CSXS.12",
    "HKCU:\Software\Adobe\CSXS.13",
    "HKCU:\Software\Adobe\CSXS.14",
    "HKCU:\Software\Adobe\CSXS.15",
    "HKCU:\Software\Adobe\CSXS.16"
)
foreach ($k in $regKeys) {
    if (-not (Test-Path $k)) { New-Item -Path $k -Force | Out-Null }
    Set-ItemProperty -Path $k -Name "PlayerDebugMode" -Value "1" -Type String -Force
}

$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $srcDir -or -not (Test-Path $srcDir)) { $srcDir = "F:\adobe illu\Code - Mockup 3d\PackagingStudio3D" }
$cepDir = "$env:APPDATA\Adobe\CEP\extensions\PackagingStudio3D"
if (Test-Path $cepDir) { Remove-Item $cepDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $cepDir | Out-Null
if (Test-Path "$srcDir\.debug") { Copy-Item "$srcDir\.debug" "$cepDir\.debug" -Force }

$subFolders = @("CSXS", "css", "js", "jsx", "templates")
foreach ($sf in $subFolders) {
    New-Item -ItemType Directory -Force -Path "$cepDir\$sf" | Out-Null
}

Copy-Item "$srcDir\CSXS\manifest.xml" "$cepDir\CSXS\manifest.xml" -Force
Copy-Item "$srcDir\index.html" "$cepDir\index.html" -Force
Copy-Item "$srcDir\preview_3d.html" "$cepDir\preview_3d.html" -Force
Copy-Item "$srcDir\css\style.css" "$cepDir\css\style.css" -Force
Copy-Item "$srcDir\js\*" "$cepDir\js\" -Recurse -Force
Copy-Item "$srcDir\jsx\host.jsx" "$cepDir\jsx\host.jsx" -Force
Copy-Item "$srcDir\templates\*" "$cepDir\templates\" -Recurse -Force
if (Test-Path "$srcDir\preview_config.js") { Copy-Item "$srcDir\preview_config.js" "$cepDir\preview_config.js" -Force }

Write-Host "CAI DAT HOAN TAT!" -ForegroundColor Green
Write-Host "Khoi dong lai Illustrator va vao menu: Window -> Extensions (Legacy) -> Packaging Studio 3D"
