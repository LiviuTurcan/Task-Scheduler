# Task Scheduler

A smart task scheduling application with a C++ optimization engine and a Python/Flask web interface.

## Quick Start (One-Click Setup)

### Windows
Double-click **`setup_and_run.bat`** or run in a terminal:
```powershell
.\setup_and_run.bat
```

### macOS / Linux
Open a terminal in the project folder and run:
```bash
chmod +x setup_and_run.sh
./setup_and_run.sh
```

The script will:
1. ✅ Check that Python 3 is installed
2. ✅ Create a virtual environment (`.venv`)
3. ✅ Install all Python dependencies from `requirements.txt`
4. ✅ Compile the C++ engine (if `g++` / `clang++` is available)
5. ✅ Start the Flask server and open the browser at **http://127.0.0.1:5000/**

---

## Prerequisites

| Requirement | Windows | macOS | Linux (Ubuntu) |
|---|---|---|---|
| **Python 3.10+** | [python.org](https://www.python.org/downloads/) | `brew install python3` | `sudo apt install python3 python3-venv python3-pip` |
| **C++ Compiler** | MinGW-w64 / MSYS2 (`g++`) | `xcode-select --install` | `sudo apt install g++` |

> **Note:** The C++ scheduler binary (`scheduler.exe` on Windows, `scheduler` on macOS/Linux) is already pre-compiled for Windows in the repository. macOS and Linux users need a C++ compiler to build it on first run.

---

## Manual Setup (Advanced)

### 1. Install Python dependencies
```bash
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Build the C++ Engine

**Windows (PowerShell):**
```powershell
g++ -std=c++17 -O2 `
  cpp_engine\main.cpp `
  cpp_engine\json_io.cpp `
  cpp_engine\algorithms\time_utils.cpp `
  cpp_engine\algorithms\algorithms.cpp `
  cpp_engine\algorithms\scheduler.cpp `
  cpp_engine\algorithms\scoring.cpp `
  -o cpp_engine\scheduler.exe
```

**macOS / Linux:**
```bash
g++ -std=c++17 -O2 \
  cpp_engine/main.cpp \
  cpp_engine/json_io.cpp \
  cpp_engine/algorithms/time_utils.cpp \
  cpp_engine/algorithms/algorithms.cpp \
  cpp_engine/algorithms/scheduler.cpp \
  cpp_engine/algorithms/scoring.cpp \
  -o cpp_engine/scheduler
```

### 3. Run the Server
```bash
python -m python_backend.web
```
Then open http://127.0.0.1:5000/ in your browser.

### 4. Run Smoke Tests
```bash
python -m python_backend.smoke_test
```

---

## Project Structure

```
Task-Scheduler-main/
├── setup_and_run.bat       # Windows one-click launcher
├── setup_and_run.sh        # macOS / Linux one-click launcher
├── requirements.txt        # Python dependencies (Flask)
├── README.md
├── cpp_engine/             # C++ scheduling optimization engine
│   ├── main.cpp
│   ├── json_io.cpp / .h
│   ├── models.h
│   ├── scheduler.exe       # Pre-compiled Windows binary
│   ├── algorithms/         # Scheduling algorithms
│   └── nlohmann/           # JSON library (header-only)
├── data/                   # Runtime data (JSON)
│   ├── tasks.json
│   ├── availability.json
│   ├── fixed_events.json
│   └── schedule_output.json
└── python_backend/         # Flask web backend
    ├── web.py              # HTTP routes
    ├── app_controller.py   # Business logic
    ├── cpp_bridge.py       # Subprocess bridge to C++ engine
    ├── storage.py          # JSON file persistence
    ├── validators.py       # Input validation
    ├── reports.py          # Export helpers (TXT/CSV/JSON)
    ├── smoke_test.py       # Automated tests
    ├── static/             # Frontend assets
    │   ├── css/            # Stylesheets
    │   └── js/             # JavaScript modules
    └── templates/
        └── index.html      # Main UI template
```

---

## Technology

- **Backend:** Python 3 + Flask
- **Scheduling Engine:** C++ 17 with backtracking optimization
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **JSON Library:** nlohmann/json (header-only, included)
