#!/usr/bin/env bash
set -euo pipefail

echo "======================================================"
echo "   Task Scheduler - macOS / Linux Setup and Launcher"
echo "======================================================"
echo

# ---- Step 1: Locate Python ----
echo "[1/5] Checking for Python..."
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
    PYTHON_CMD="python"
else
    echo "[ERROR] Python is not installed."
    echo "        macOS:  brew install python3"
    echo "        Ubuntu: sudo apt install python3 python3-venv python3-pip"
    exit 1
fi

$PYTHON_CMD --version
echo "[OK] Python found."
echo

# ---- Step 2: Create virtual environment ----
echo "[2/5] Setting up virtual environment..."
if [ ! -d ".venv" ]; then
    $PYTHON_CMD -m venv .venv
    echo "[OK] Virtual environment created."
else
    echo "[OK] Virtual environment already exists."
fi
echo

# Activate
source .venv/bin/activate

# ---- Step 3: Install dependencies ----
echo "[3/5] Installing Python dependencies..."
pip install --upgrade pip > /dev/null 2>&1
pip install -r requirements.txt
echo "[OK] Dependencies installed."
echo

# ---- Step 4: Build C++ engine (optional) ----
echo "[4/5] Checking C++ engine..."
SCHEDULER_BIN="cpp_engine/scheduler"
if [ -f "$SCHEDULER_BIN" ]; then
    echo "[OK] scheduler binary already exists — skipping compilation."
else
    echo "[INFO] scheduler binary not found. Attempting to compile..."
    if command -v g++ &>/dev/null; then
        g++ -std=c++17 -O2 \
            cpp_engine/main.cpp \
            cpp_engine/json_io.cpp \
            cpp_engine/algorithms/time_utils.cpp \
            cpp_engine/algorithms/algorithms.cpp \
            cpp_engine/algorithms/scheduler.cpp \
            cpp_engine/algorithms/scoring.cpp \
            -o cpp_engine/scheduler
        chmod +x cpp_engine/scheduler
        echo "[OK] scheduler compiled successfully."
    elif command -v clang++ &>/dev/null; then
        clang++ -std=c++17 -O2 \
            cpp_engine/main.cpp \
            cpp_engine/json_io.cpp \
            cpp_engine/algorithms/time_utils.cpp \
            cpp_engine/algorithms/algorithms.cpp \
            cpp_engine/algorithms/scheduler.cpp \
            cpp_engine/algorithms/scoring.cpp \
            -o cpp_engine/scheduler
        chmod +x cpp_engine/scheduler
        echo "[OK] scheduler compiled successfully."
    else
        echo "[WARNING] Neither g++ nor clang++ found."
        echo "          macOS:  xcode-select --install"
        echo "          Ubuntu: sudo apt install g++"
        echo "          Then re-run this script."
    fi
fi
echo

# ---- Step 5: Launch the server ----
echo "[5/5] Starting the Task Scheduler server..."
echo
echo "======================================================"
echo "  Server is starting at http://127.0.0.1:5000/"
echo "  Press Ctrl+C to stop the server."
echo "======================================================"
echo

# Open browser (best-effort, non-fatal if it fails)
if command -v xdg-open &>/dev/null; then
    xdg-open "http://127.0.0.1:5000/" &
elif command -v open &>/dev/null; then
    open "http://127.0.0.1:5000/" &
fi

$PYTHON_CMD -m python_backend.web
