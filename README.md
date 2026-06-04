# Task Scheduler

Task Scheduler made for PBL Sem 2 AIA.  
A smart task scheduling application with a **C++ optimization engine** and a **Python/Flask web interface**.

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
5. ✅ Start the Flask server and open the browser. It prefers **http://127.0.0.1:5000/** and automatically uses the next available port if 5000 is busy.

---

## Prerequisites

| Requirement | Windows | macOS | Linux (Ubuntu) |
|---|---|---|---|
| **Python 3.10+** | [python.org](https://www.python.org/downloads/) | `brew install python3` | `sudo apt install python3 python3-venv python3-pip` |
| **C++ Compiler** | MinGW-w64 / MSYS2 (`g++`) | `xcode-select --install` | `sudo apt install g++` |

> **Note:** The pre-compiled `scheduler.exe` (Windows) is included in the repository. macOS and Linux users will need a C++ compiler — the setup script handles compilation automatically.

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
Then open the URL printed in the terminal. By default it is http://127.0.0.1:5000/, or the next available port if 5000 is busy.

### 4. Run Smoke Tests
```bash
python -m python_backend.smoke_test
```

---

## Project Structure

```
Task-Scheduler/
├── setup_and_run.bat          # Windows one-click launcher
├── setup_and_run.sh           # macOS / Linux one-click launcher
├── requirements.txt           # Python dependencies (Flask)
├── README.md
├── .gitignore
│
├── cpp_engine/                # C++ scheduling optimization engine
│   ├── main.cpp               #   Entry point
│   ├── json_io.cpp / .h       #   JSON file I/O
│   ├── models.h               #   Data models (Task, TimeSlot, etc.)
│   ├── scheduler.exe          #   Pre-compiled Windows binary
│   ├── algorithms/            #   Scheduling algorithms
│   │   ├── scheduler.cpp/.h   #     Core backtracking scheduler
│   │   ├── algorithms.cpp/.h  #     Utility algorithms
│   │   ├── scoring.cpp/.h     #     Schedule scoring
│   │   └── time_utils.cpp/.h  #     DateTime helpers
│   └── nlohmann/              #   JSON library (header-only)
│       └── json.hpp
│
├── data/                      # Runtime data (JSON)
│   ├── tasks.json
│   ├── availability.json
│   ├── fixed_events.json
│   └── schedule_output.json
│
└── python_backend/            # Flask web backend
    ├── __init__.py            #   Package init
    ├── web.py                 #   HTTP routes (Flask app)
    ├── app_controller.py      #   Business logic controller
    ├── cpp_bridge.py          #   Subprocess bridge to C++ engine
    ├── storage.py             #   JSON file persistence
    ├── validators.py          #   Input validation
    ├── reports.py             #   Export helpers (TXT/CSV/JSON)
    ├── smoke_test.py          #   Automated smoke tests
    ├── static/                #   Frontend assets
    │   ├── css/
    │   │   ├── global.css     #     CSS variables & base styles
    │   │   ├── dashboard.css  #     Layout, cards, modals
    │   │   └── calendar.css   #     Calendar view styles
    │   └── js/
    │       ├── state.js       #     App state & API calls
    │       ├── modals.js      #     Modal dialogs (add/edit/fix)
    │       ├── calendar_views.js  #  Week & agenda calendar
    │       ├── charts.js      #     Chart.js analytics
    │       ├── exports.js     #     Download & compiler log
    │       ├── canvas.js      #     Particle background
    │       └── tour.js        #     Interactive guided tour
    └── templates/
        └── index.html         #   Main SPA template
```

---

## Technology

- **Backend:** Python 3 + Flask
- **Scheduling Engine:** C++17 with backtracking optimization
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **Charts:** Chart.js
- **Icons:** Lucide Icons
- **JSON Library:** nlohmann/json (header-only, included)
