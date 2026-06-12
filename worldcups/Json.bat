@echo off
setlocal ENABLEDELAYEDEXPANSION

REM ============================================
REM  PURE BATCH VERSION — NOW SUPPORTS DRAWINGLOTS + ROUND32
REM ============================================

set "ROOT=%~dp0"
set "OUT=%ROOT%\worldcups.json"

echo ROOT: %ROOT%
echo OUT : %OUT%
echo.

> "%OUT%" echo {
>>"%OUT%" echo   "worldcup": [

set firstYear=1

for /d %%Y in ("%ROOT%\*") do (
    if exist "%%Y\teams.json" (

        if !firstYear! equ 0 (
            >>"%OUT%" echo     ,
        )
        set firstYear=0

        set "yearName=%%~nY"

        >>"%OUT%" echo     {
        >>"%OUT%" echo       "year": "!yearName!",
        >>"%OUT%" echo       "paths": {
        >>"%OUT%" echo         "teams": "worldcups/!yearName!/teams.json",
        >>"%OUT%" echo         "season": {

        REM === DETECT FIFA ROUND FILES (ORDERED) ===
        set "roundList="

        REM ⭐ NOW INCLUDES drawinglots.json
        for %%R in (groupstage drawinglots round32 round16 quarterfinals semifinals thirdplace final) do (
            if exist "%%Y\%%R.json" (
                set "roundList=!roundList! %%R"
            )
        )

        REM === GET LAST ROUND FOR COMMA HANDLING ===
        set "lastRound="
        for %%L in (!roundList!) do (
            set "lastRound=%%L"
        )

        REM === OUTPUT ROUNDS ===
        for %%R in (!roundList!) do (
            if "%%R"=="!lastRound!" (
                >>"%OUT%" echo           "%%R": "worldcups/!yearName!/%%R.json"
            ) else (
                >>"%OUT%" echo           "%%R": "worldcups/!yearName!/%%R.json",
            )
        )

        >>"%OUT%" echo         }
        >>"%OUT%" echo       }
        >>"%OUT%" echo     }
    )
)

>>"%OUT%" echo   ]
>>"%OUT%" echo }

echo.
echo SUCCESS: worldcups.json created.
echo.

endlocal
pause
