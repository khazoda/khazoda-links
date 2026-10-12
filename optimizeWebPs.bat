@echo off
where cwebp >nul 2>&1 || exit /b 1
for %%I in ("%~dp0static\mods\*.webp") do (
  cwebp -quiet -lossless -m 6 -q 100 -metadata icc "%%I" -o "%%I.tmp" && (
    for %%T in ("%%I.tmp") do if %%~zT LSS %%~zI (move /y "%%T" "%%I" >nul) else del "%%T"
  )
)
