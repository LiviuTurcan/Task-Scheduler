#include <exception>
#include <iostream>
#include <string>

#include "json_io.h"
#include "scheduler.h"

namespace {
void PrintUsage(const char* executable) {
  std::cerr << "Usage: " << executable
            << " <tasks.json> <availability.json> <fixed_events.json>"
               " <schedule_output.json>\n";
}
}  // namespace

int main(int argc, char* argv[]) {
  if (argc != 5) {
    PrintUsage(argv[0]);
    return 1;
  }

  try {
    const std::vector<Task> tasks = ReadTasks(argv[1]);
    const std::vector<TimeSlot> availability = ReadAvailability(argv[2]);
    const std::vector<Task> fixed_events = ReadFixedEvents(argv[3]);
    const ScheduleResult result =
        GenerateSchedule(tasks, availability, fixed_events);

    WriteScheduleResult(argv[4], result);
    std::cout << "warning: Phase 3 engine skeleton loaded " << tasks.size()
              << " tasks, " << availability.size() << " availability intervals, and "
              << fixed_events.size()
              << " fixed event(s). Scheduling algorithms are implemented in Phase 4.\n";
    return 0;
  } catch (const std::exception& ex) {
    std::cerr << "error: " << ex.what() << '\n';
    return 1;
  }
}
