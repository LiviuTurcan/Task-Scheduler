#include "scheduler.h"

#include <stdexcept>
#include <string>

namespace {
[[noreturn]] void ThrowPhaseFourPlaceholder(const char* component) {
  throw std::logic_error(std::string(component) +
                         " is part of the Phase 4 algorithm implementation");
}
}  // namespace

std::vector<TimeSlot> GenerateTimeSlots(const std::vector<TimeSlot>&, int) {
  ThrowPhaseFourPlaceholder("Time-slot generation");
}

void BlockFixedEvents(std::vector<TimeSlot>*, const std::vector<Task>&) {
  ThrowPhaseFourPlaceholder("Fixed-event blocking");
}

bool HasOverlap(const std::string&, const std::string&, const std::string&,
                const std::string&) {
  ThrowPhaseFourPlaceholder("Interval overlap detection");
}

ScheduleResult RunGreedyScheduler(const std::vector<Task>&,
                                  const std::vector<TimeSlot>&) {
  ThrowPhaseFourPlaceholder("Greedy scheduling");
}

ScheduleResult RepairScheduleWithBacktracking(const ScheduleResult&,
                                              const std::vector<Task>&,
                                              const std::vector<TimeSlot>&) {
  ThrowPhaseFourPlaceholder("Backtracking repair");
}

ScheduleResult GenerateSchedule(const std::vector<Task>& tasks,
                                const std::vector<TimeSlot>& availability,
                                const std::vector<Task>& fixed_events) {
  (void)availability;
  (void)fixed_events;

  ScheduleResult result;
  result.generated_by = "cpp_engine_phase_3_skeleton";
  result.statistics.total_tasks = static_cast<int>(tasks.size());

  for (const auto& task : tasks) {
    result.unscheduled_tasks.push_back(
        {task.id, task.name, "Scheduler pipeline is implemented in Phase 4"});
  }

  result.statistics.unscheduled_tasks =
      static_cast<int>(result.unscheduled_tasks.size());
  return result;
}
