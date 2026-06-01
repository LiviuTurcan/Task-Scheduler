#include "scoring.h"

#include <unordered_set>

#include "time_utils.h"

namespace {
bool HasOverlap(const ScheduledTask& first, const ScheduledTask& second) {
  return ParseDateTime(first.start) < ParseDateTime(second.end) &&
         ParseDateTime(second.start) < ParseDateTime(first.end);
}
}  // namespace

int CountScheduleConflicts(const ScheduleResult& result) {
  int conflicts = 0;
  for (std::size_t first = 0; first < result.schedule.size(); ++first) {
    for (std::size_t second = first + 1; second < result.schedule.size();
         ++second) {
      if (HasOverlap(result.schedule[first], result.schedule[second])) {
        ++conflicts;
      }
    }
  }
  return conflicts;
}

int CalculateValidationPenalty(const ScheduleResult& result) {
  return result.statistics.conflicts * 1000 +
         result.statistics.deadline_violations * 1000;
}

int CalculateScheduleScore(const ScheduleResult& result) {
  std::unordered_set<int> counted_task_ids;
  int score = 0;
  for (const auto& task : result.schedule) {
    if (counted_task_ids.insert(task.task_id).second) {
      score += task.priority * 100;
    }
  }
  return score - CalculateValidationPenalty(result);
}
