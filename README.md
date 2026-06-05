# Task Scheduler

Task Scheduler is a hybrid Python and C++ application that automatically generates optimized schedules based on task priorities, deadlines, dependencies, user availability, and fixed events.

The system combines a Flask-based web interface with a high-performance C++ scheduling engine to help users transform a collection of tasks into a structured, conflict-free execution plan.

---

## Features

* Automatic schedule generation
* Dependency-aware task ordering
* Priority and deadline-based task ranking
* Support for fixed events and unavailable periods
* Task splitting across multiple time slots
* Conflict detection and validation
* Export functionality (JSON, CSV, TXT)
* Interactive web interface
* Cross-platform support (Windows, Linux, macOS)

---

## Technology Stack

### Backend

* Python 3
* Flask

### Scheduling Engine

* C++17
* STL
* nlohmann/json

### Frontend

* HTML
* CSS
* JavaScript

### Data Storage

* JSON

---

# Getting Started

## Prerequisites

Before running the project, ensure that the following are installed:

* Python 3.10 or newer
* A C++17 compatible compiler (if rebuilding the engine)
* Git

---

## Clone the Repository

```bash
git clone https://github.com/LiviuTurcan/Task-Scheduler.git
cd Task-Scheduler
```

---

## Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Run the Application

### Windows

```bash
setup_and_run.bat
```

### Linux / macOS

```bash
chmod +x setup_and_run.sh
./setup_and_run.sh
```

Alternatively:

```bash
python python_backend/web.py
```

Once started, open:

```text
http://localhost:5000
```

---

# How It Works

The application follows a layered architecture:

```text
User Interface
      │
      ▼
Flask Web Backend
      │
      ▼
Validation & Data Management
      │
      ▼
C++ Scheduling Engine
      │
      ▼
Generated Schedule
```

The Python backend handles user interaction, validation, persistence, and reporting, while the C++ engine performs scheduling and optimization.

---

# Scheduling Approach

The scheduling process consists of two main stages.

## Task Prioritization

Tasks are ranked according to:

* Priority
* Difficulty
* Deadline proximity
* Dependency constraints

Dependencies are modeled as a Directed Acyclic Graph (DAG). A topological ordering ensures that prerequisite tasks are completed before dependent tasks become eligible for scheduling.

## Time Allocation

Once tasks are prioritized, the scheduler allocates them into available time intervals while:

* Respecting deadlines
* Avoiding fixed events
* Preventing overlaps
* Enforcing dependency completion
* Supporting task splitting when enabled

The resulting schedule is deterministic and conflict-free.

---

# Project Structure

```text
Task-Scheduler/
├── setup_and_run.bat
├── setup_and_run.sh
├── requirements.txt
├── README.md
├── .gitignore
│
├── cpp_engine/
│   ├── main.cpp
│   ├── json_io.cpp
│   ├── json_io.h
│   ├── models.h
│   ├── scheduler.exe
│   ├── algorithms/
│   │   ├── scheduler.cpp
│   │   ├── scheduler.h
│   │   ├── algorithms.cpp
│   │   ├── algorithms.h
│   │   ├── scoring.cpp
│   │   ├── scoring.h
│   │   ├── time_utils.cpp
│   │   └── time_utils.h
│   └── nlohmann/
│       └── json.hpp
│
├── data/
│   ├── tasks.json
│   ├── availability.json
│   ├── fixed_events.json
│   └── schedule_output.json
│
└── python_backend/
    ├── __init__.py
    ├── web.py
    ├── app_controller.py
    ├── cpp_bridge.py
    ├── storage.py
    ├── validators.py
    ├── reports.py
    ├── smoke_test.py
    ├── static/
    │   ├── css/
    │   │   ├── global.css
    │   │   ├── dashboard.css
    │   │   └── calendar.css
    │   └── js/
    │       ├── state.js
    │       ├── modals.js
    │       ├── calendar_views.js
    │       ├── charts.js
    │       ├── exports.js
    │       └── tour.js
    └── templates/
        └── index.html
```

---

# Input Files

The scheduler operates using three primary datasets stored in the `data` directory.

### Tasks

Defines the workload to be scheduled.

```json
{
  "id": 1,
  "name": "Algorithms Assignment",
  "duration_minutes": 120,
  "priority": 5,
  "difficulty": 4,
  "deadline": "2026-06-10T18:00:00",
  "dependencies": [],
  "can_split": true
}
```

### Availability

Defines periods where work may be scheduled.

### Fixed Events

Defines non-negotiable calendar events such as classes, meetings, or exams.

---

# Output

After schedule generation, results are written to:

```text
data/schedule_output.json
```

The output includes:

* Scheduled tasks
* Unscheduled tasks
* Scheduling statistics
* Constraint validation results

Reports can also be exported as:

* JSON
* CSV
* TXT

---

# Testing

Run the smoke tests using:

```bash
python python_backend/smoke_test.py
```

---

# Future Improvements

* Google Calendar integration
* Outlook synchronization
* Mobile support
* Smarter schedule recommendations
* Advanced optimization techniques
* Multi-user scheduling

---

# Authors

Developed by the FAF-252 team at the Technical University of Moldova.

* Mihai Botezat
* Liviu Turcan
* Dmitrii Bejan
* Pavel Ciobanu
* Veaceslav Coltuc
* Ludmila Goțonoaga

---

