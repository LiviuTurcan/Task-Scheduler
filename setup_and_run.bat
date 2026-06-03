@echo off
chcp 65001 >nul 2>&1
setlocal EnableDelayedExpansion

echo ======================================================
echo    Task Scheduler - Windows Setup and Launcher
echo ======================================================
echo.

:: ---- Step 1: Locate Python ----
echo [1/5] Checking for Python...
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    where python3 >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Python is not installed or not in PATH.
        echo         Please install Python 3.10+ from https://www.python.org/downloads/
        echo         Make sure to check "Add Python to PATH" during installation.
        pause
        exit /b 1
    )
    set PYTHON_CMD=python3
) else (
    set PYTHON_CMD=python
)

:: Verify version
%PYTHON_CMD% --version 2>&1
echo [OK] Python found.
echo.

:: ---- Step 2: Create virtual environment ----
echo [2/5] Setting up virtual environment...
if not exist ".venv" (
    %PYTHON_CMD% -m venv .venv
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
) else (
    echo [OK] Virtual environment already exists.
)
echo.

:: Activate
call .venv\Scripts\activate.bat

:: ---- Step 3: Install dependencies ----
echo [3/5] Installing Python dependencies...
pip install --upgrade pip >nul 2>&1
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed.
echo.

:: ---- Step 4: Build C++ engine (optional) ----
echo [4/5] Checking C++ engine...
if exist "cpp_engine\scheduler.exe" (
    echo [OK] scheduler.exe already exists — skipping compilation.
) else (
    echo [INFO] scheduler.exe not found. Attempting to compile...
    where g++ >nul 2>&1
    if %ERRORLEVEL% neq 0 (
        echo [WARNING] g++ not found. Please compile the C++ engine manually.
        echo           Install MinGW-w64 or MSYS2, then run:
        echo           g++ -std=c++17 -O2 cpp_engine\main.cpp cpp_engine\json_io.cpp ^
        echo             cpp_engine\algorithms\time_utils.cpp cpp_engine\algorithms\algorithms.cpp ^
        echo             cpp_engine\algorithms\scheduler.cpp cpp_engine\algorithms\scoring.cpp ^
        echo             -o cpp_engine\scheduler.exe
    ) else (
        g++ -std=c++17 -O2 ^
            cpp_engine\main.cpp ^
            cpp_engine\json_io.cpp ^
            cpp_engine\algorithms\time_utils.cpp ^
            cpp_engine\algorithms\algorithms.cpp ^
            cpp_engine\algorithms\scheduler.cpp ^
            cpp_engine\algorithms\scoring.cpp ^
            -o cpp_engine\scheduler.exe
        if %ERRORLEVEL% neq 0 (
            echo [ERROR] C++ compilation failed.
            pause
            exit /b 1
        )
        echo [OK] scheduler.exe compiled successfully.
    )
)
echo.

:: ---- Step 5: Launch the server ----
echo [5/5] Starting the Task Scheduler server...
echo.
echo ======================================================
echo   Server is starting at http://127.0.0.1:5000/
echo   Press Ctrl+C to stop the server.
echo ======================================================
echo.

:: Open browser after a short delay
start "" http://127.0.0.1:5000/

%PYTHON_CMD% -m python_backend.web
pause
