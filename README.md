# Task Scheduler

The C++ engine JSON IO uses the header-only `nlohmann/json` library. Ensure the header is available on the include path when building the C++ engine.

## Install dependencies:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
## Build

```powershell
g++ -std=c++17 -Wall -Wextra -pedantic `
  cpp_engine\main.cpp `
  cpp_engine\json_io.cpp `
  cpp_engine\algorithms\time_utils.cpp `
  cpp_engine\algorithms\algorithms.cpp `
  cpp_engine\algorithms\scheduler.cpp `
  cpp_engine\algorithms\scoring.cpp `
  -o cpp_engine\scheduler.exe
```

## Run

```powershell
.\cpp_engine\scheduler.exe `
  data\tasks.json `
  data\availability.json `
  data\fixed_events.json `
  data\schedule_output.json
```

## Python Backend

run the backend  test before connecting a UI:

```powershell
python -m python_backend.smoke_test
```

## Run locally:

### Start the server from the project root:

```bash
python -m python_backend.web
```
### Open the UI in a browser at http://127.0.0.1:5000/
