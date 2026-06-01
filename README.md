# Task Scheduler

The C++ engine JSON IO uses the header-only `nlohmann/json` library. Ensure the header is available on the include path when building the C++ engine.

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
