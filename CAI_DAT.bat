@echo off
chcp 65001 >nul
title Cai dat Packaging Studio 3D cho Adobe Illustrator
echo ================================================
echo   CAI DAT PACKAGING STUDIO 3D (Illustrator CEP)
echo ================================================
echo.
echo Hay TAT Illustrator truoc khi cai dat.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PackagingStudio3D\install.ps1"
if errorlevel 1 (
  echo.
  echo [LOI] Cai dat that bai. Kiem tra lai thu muc PackagingStudio3D.
) else (
  echo.
  echo Mo Illustrator ^> Window ^> Extensions ^> Packaging Studio 3D
)
echo.
pause
