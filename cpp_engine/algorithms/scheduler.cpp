#include "scheduler.h"

#include <algorithm>
#include <ctime>
#include <limits>
#include <map>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

#include "algorithms.h"
#include "scoring.h"
#include "time_utils.h"

namespace {
struct Placement {
  std::vector<ScheduledTask> segments;
  std::vector<std::size_t> slot_indexes;
};

std::time_t LatestDependencyEnd(
    const Task& task, const std::unordered_map<int, std::time_t>& completion_times,
    bool* dependencies_ready) {
  std::time_t latest_end = std::numeric_limits<std::time_t>::min();
  *dependencies_ready = true;
  for (const int dependency_id : task.dependencies) {
    const auto completion = completion_times.find(dependency_id);
    if (completion == completion_times.end()) {
      *dependencies_ready = false;
      return latest_end;
    }
    latest_end = std::max(latest_end, completion->second);
  }
  return latest_end;
}

bool BuildContinuousPlacementAt(const Task& task,
                                const std::vector<TimeSlot>& slots,
                                std::time_t earliest_start,
                                std::size_t first_slot_index,
                                Placement* placement) {
  if (first_slot_index >= slots.size() || slots[first_slot_index].occupied) {
    return false;
  }

  const std::time_t deadline = ParseDateTime(task.deadline);
  const std::time_t slot_start = ParseDateTime(slots[first_slot_index].start);
  const std::time_t slot_end = ParseDateTime(slots[first_slot_index].end);
  const std::time_t task_start = std::max(slot_start, earliest_start);
  if (task_start >= slot_end || task_start >= deadline) {
    return false;
  }

  std::time_t cursor = task_start;
  int remaining_seconds = task.duration_minutes * 60;
  Placement candidate;
  for (std::size_t index = first_slot_index; index < slots.size(); ++index) {
    if (slots[index].occupied) {
      break;
    }

    const std::time_t current_start = ParseDateTime(slots[index].start);
    const std::time_t current_end = ParseDateTime(slots[index].end);
    if (current_start > cursor) {
      break;
    }
    if (current_end <= cursor) {
      continue;
    }

    candidate.slot_indexes.push_back(index);
    const int available_seconds = static_cast<int>(current_end - cursor);
    if (remaining_seconds <= available_seconds) {
      const std::time_t task_end = cursor + remaining_seconds;
      if (task_end > deadline) {
        return false;
      }
      candidate.segments.push_back(
          {task.id, task.name, FormatDateTime(task_start),
           FormatDateTime(task_end), task.priority});
      *placement = std::move(candidate);
      return true;
    }

    remaining_seconds -= available_seconds;
    cursor = current_end;
  }
  return false;
}

std::vector<Placement> FindContinuousPlacements(const Task& task,
                                                const std::vector<TimeSlot>& slots,
                                                std::time_t earliest_start,
                                                std::size_t limit) {
  std::vector<Placement> placements;
  std::unordered_set<std::string> starts;
  for (std::size_t index = 0; index < slots.size() && placements.size() < limit;
       ++index) {
    Placement placement;
    if (BuildContinuousPlacementAt(task, slots, earliest_start, index,
                                   &placement) &&
        starts.insert(placement.segments.front().start).second) {
      placements.push_back(std::move(placement));
    }
  }
  return placements;
}

bool FindSplitPlacement(const Task& task, const std::vector<TimeSlot>& slots,
                        std::time_t earliest_start, Placement* placement) {
  const std::time_t deadline = ParseDateTime(task.deadline);
  int remaining_seconds = task.duration_minutes * 60;
  Placement candidate;

  for (std::size_t index = 0; index < slots.size(); ++index) {
    if (slots[index].occupied) {
      continue;
    }

    const std::time_t slot_start = ParseDateTime(slots[index].start);
    const std::time_t slot_end = ParseDateTime(slots[index].end);
    const std::time_t segment_start = std::max(slot_start, earliest_start);
    const std::time_t segment_limit = std::min(slot_end, deadline);
    if (segment_start >= segment_limit) {
      continue;
    }

    const int available_seconds =
        static_cast<int>(segment_limit - segment_start);
    const int used_seconds = std::min(remaining_seconds, available_seconds);
    const std::time_t segment_end = segment_start + used_seconds;
    candidate.slot_indexes.push_back(index);

    if (!candidate.segments.empty() &&
        candidate.segments.back().end == FormatDateTime(segment_start)) {
      candidate.segments.back().end = FormatDateTime(segment_end);
    } else {
      candidate.segments.push_back({task.id, task.name,
                                    FormatDateTime(segment_start),
                                    FormatDateTime(segment_end), task.priority});
    }

    remaining_seconds -= used_seconds;
    if (remaining_seconds == 0) {
      *placement = std::move(candidate);
      return true;
    }
  }
  return false;
}

bool FindTaskPlacement(const Task& task, const std::vector<TimeSlot>& slots,
                       std::time_t earliest_start, Placement* placement) {
  if (task.duration_minutes <= 0) {
    throw std::runtime_error("Task duration must be positive: " + task.name);
  }
  if (task.can_split) {
    return FindSplitPlacement(task, slots, earliest_start, placement);
  }

  const std::vector<Placement> placements =
      FindContinuousPlacements(task, slots, earliest_start, 1);
  if (placements.empty()) {
    return false;
  }
  *placement = placements.front();
  return true;
}

void ApplyPlacement(const Placement& placement, std::vector<TimeSlot>* slots,
                    ScheduleResult* result) {
  for (const std::size_t slot_index : placement.slot_indexes) {
    (*slots)[slot_index].occupied = true;
    (*slots)[slot_index].task_id = placement.segments.front().task_id;
  }
  result->schedule.insert(result->schedule.end(), placement.segments.begin(),
                          placement.segments.end());
}

void RefreshStatistics(ScheduleResult* result) {
  std::unordered_set<int> scheduled_task_ids;
  for (const auto& task : result->schedule) {
    scheduled_task_ids.insert(task.task_id);
  }

  result->statistics.scheduled_tasks =
      static_cast<int>(scheduled_task_ids.size());
  result->statistics.unscheduled_tasks =
      static_cast<int>(result->unscheduled_tasks.size());
  result->statistics.conflicts = CountScheduleConflicts(*result);
  result->statistics.score = CalculateScheduleScore(*result);
}

std::unordered_map<int, std::time_t> CompletionTimes(
    const ScheduleResult& result) {
  std::unordered_map<int, std::time_t> completion_times;
  for (const auto& task : result.schedule) {
    completion_times[task.task_id] =
        std::max(completion_times[task.task_id], ParseDateTime(task.end));
  }
  return completion_times;
}

void RemoveUnscheduledTask(int task_id, ScheduleResult* result) {
  result->unscheduled_tasks.erase(
      std::remove_if(result->unscheduled_tasks.begin(),
                     result->unscheduled_tasks.end(),
                     [task_id](const ScheduleResult::UnscheduledTask& task) {
                       return task.task_id == task_id;
                     }),
      result->unscheduled_tasks.end());
}

void BacktrackPlacements(const std::vector<Task>& candidates, std::size_t index,
                         ScheduleResult current_result,
                         std::vector<TimeSlot> current_slots,
                         ScheduleResult* best_result) {
  RefreshStatistics(&current_result);
  if (current_result.statistics.score > best_result->statistics.score) {
    *best_result = current_result;
  }
  if (index == candidates.size()) {
    return;
  }

  int maximum_additional_score = 0;
  for (std::size_t remaining = index; remaining < candidates.size();
       ++remaining) {
    maximum_additional_score += candidates[remaining].priority * 100;
  }
  if (current_result.statistics.score + maximum_additional_score <=
      best_result->statistics.score) {
    return;
  }

  BacktrackPlacements(candidates, index + 1, current_result, current_slots,
                      best_result);

  const Task& task = candidates[index];
  const auto completion_times = CompletionTimes(current_result);
  bool dependencies_ready = false;
  std::time_t earliest_start =
      LatestDependencyEnd(task, completion_times, &dependencies_ready);
  if (!dependencies_ready) {
    return;
  }
  if (task.dependencies.empty() && !current_slots.empty()) {
    earliest_start = ParseDateTime(current_slots.front().start);
  }

  std::vector<Placement> placements;
  if (task.can_split) {
    Placement placement;
    if (FindTaskPlacement(task, current_slots, earliest_start, &placement)) {
      placements.push_back(std::move(placement));
    }
  } else {
    placements = FindContinuousPlacements(task, current_slots, earliest_start, 8);
  }

  for (const auto& placement : placements) {
    ScheduleResult next_result = current_result;
    std::vector<TimeSlot> next_slots = current_slots;
    ApplyPlacement(placement, &next_slots, &next_result);
    RemoveUnscheduledTask(task.id, &next_result);
    BacktrackPlacements(candidates, index + 1, std::move(next_result),
                        std::move(next_slots), best_result);
  }
}
}  // namespace

bool HasOverlap(const std::string& first_start, const std::string& first_end,
                const std::string& second_start, const std::string& second_end) {
  return ParseDateTime(first_start) < ParseDateTime(second_end) &&
         ParseDateTime(second_start) < ParseDateTime(first_end);
}

std::vector<TimeSlot> GenerateTimeSlots(const std::vector<TimeSlot>& availability,
                                        int slot_minutes) {
  if (slot_minutes <= 0) {
    throw std::runtime_error("Slot duration must be positive");
  }

  std::vector<TimeSlot> intervals = availability;
  std::sort(intervals.begin(), intervals.end(),
            [](const TimeSlot& left, const TimeSlot& right) {
              return ParseDateTime(left.start) < ParseDateTime(right.start);
            });

  std::vector<TimeSlot> merged;
  for (const auto& interval : intervals) {
    if (ParseDateTime(interval.start) >= ParseDateTime(interval.end)) {
      throw std::runtime_error("Availability interval must have a positive duration");
    }
    if (!merged.empty() &&
        ParseDateTime(interval.start) <= ParseDateTime(merged.back().end)) {
      if (ParseDateTime(interval.end) > ParseDateTime(merged.back().end)) {
        merged.back().end = interval.end;
      }
    } else {
      merged.push_back(interval);
    }
  }

  std::vector<TimeSlot> slots;
  for (const auto& interval : merged) {
    std::time_t cursor = ParseDateTime(interval.start);
    const std::time_t interval_end = ParseDateTime(interval.end);
    while (cursor < interval_end) {
      const std::time_t end =
          std::min(cursor + static_cast<std::time_t>(slot_minutes) * 60,
                   interval_end);
      slots.push_back({FormatDateTime(cursor), FormatDateTime(end), false, 0});
      cursor = end;
    }
  }
  return slots;
}

void BlockFixedEvents(std::vector<TimeSlot>* slots,
                      const std::vector<Task>& fixed_events) {
  if (slots == nullptr) {
    throw std::runtime_error("Cannot block fixed events in null slots");
  }

  for (const auto& event : fixed_events) {
    if (ParseDateTime(event.fixed_start) >= ParseDateTime(event.fixed_end)) {
      throw std::runtime_error("Fixed event must have a positive duration: " +
                               event.name);
    }
    for (auto& slot : *slots) {
      if (HasOverlap(slot.start, slot.end, event.fixed_start, event.fixed_end)) {
        slot.occupied = true;
        slot.task_id = event.id;
      }
    }
  }
}

ScheduleResult RunGreedyScheduler(const std::vector<Task>& tasks,
                                  const std::vector<TimeSlot>& slots) {
  ScheduleResult result;
  result.generated_by = "cpp_engine";
  result.statistics.total_tasks = static_cast<int>(tasks.size());
  std::vector<TimeSlot> working_slots = slots;
  std::unordered_map<int, std::time_t> completion_times;

  for (const auto& task : tasks) {
    bool dependencies_ready = false;
    std::time_t earliest_start =
        LatestDependencyEnd(task, completion_times, &dependencies_ready);
    if (!dependencies_ready) {
      result.unscheduled_tasks.push_back(
          {task.id, task.name, "A dependency could not be scheduled"});
      continue;
    }
    if (task.dependencies.empty() && !working_slots.empty()) {
      earliest_start = ParseDateTime(working_slots.front().start);
    }

    Placement placement;
    if (!FindTaskPlacement(task, working_slots, earliest_start, &placement)) {
      result.unscheduled_tasks.push_back(
          {task.id, task.name, "Insufficient available time before deadline"});
      continue;
    }

    ApplyPlacement(placement, &working_slots, &result);
    completion_times[task.id] = ParseDateTime(placement.segments.back().end);
  }

  RefreshStatistics(&result);
  return result;
}

ScheduleResult RepairScheduleWithBacktracking(
    const ScheduleResult& initial_result, const std::vector<Task>& tasks,
    const std::vector<TimeSlot>& slots) {
  ScheduleResult best_result = initial_result;
  RefreshStatistics(&best_result);
  if (initial_result.unscheduled_tasks.empty()) {
    return best_result;
  }

  std::unordered_map<int, Task> tasks_by_id;
  for (const auto& task : tasks) {
    tasks_by_id.emplace(task.id, task);
  }

  std::vector<Task> candidates;
  for (const auto& unscheduled : initial_result.unscheduled_tasks) {
    const auto task = tasks_by_id.find(unscheduled.task_id);
    if (task != tasks_by_id.end()) {
      candidates.push_back(task->second);
    }
  }
  std::sort(candidates.begin(), candidates.end(),
            [](const Task& left, const Task& right) {
              if (left.priority != right.priority) {
                return left.priority > right.priority;
              }
              return ParseDateTime(left.deadline) < ParseDateTime(right.deadline);
            });
  if (candidates.size() > 4) {
    candidates.resize(4);
  }

  std::vector<TimeSlot> working_slots = slots;
  for (const auto& scheduled : initial_result.schedule) {
    for (auto& slot : working_slots) {
      if (HasOverlap(slot.start, slot.end, scheduled.start, scheduled.end)) {
        slot.occupied = true;
        slot.task_id = scheduled.task_id;
      }
    }
  }

  BacktrackPlacements(candidates, 0, initial_result, working_slots, &best_result);
  RefreshStatistics(&best_result);
  return best_result;
}

ScheduleResult GenerateSchedule(const std::vector<Task>& tasks,
                                const std::vector<TimeSlot>& availability,
                                const std::vector<Task>& fixed_events) {
  (void)TopologicalSort(tasks);

  std::vector<TimeSlot> slots = GenerateTimeSlots(availability);
  BlockFixedEvents(&slots, fixed_events);

  const std::time_t reference_time =
      slots.empty() ? std::time(nullptr) : ParseDateTime(slots.front().start);
  std::map<std::string, int> free_minutes_by_day;
  for (const auto& slot : slots) {
    if (!slot.occupied) {
      free_minutes_by_day[slot.start.substr(0, 10)] +=
          DifferenceInMinutes(slot.start, slot.end);
    }
  }

  std::vector<int> selected_ids;
  std::vector<Task> remaining_tasks = tasks;
  for (const auto& [day, free_minutes] : free_minutes_by_day) {
    const std::time_t day_start = ParseDateTime(day + "T00:00:00");
    std::vector<Task> candidates;
    for (const auto& task : remaining_tasks) {
      if (ParseDateTime(task.deadline) >= day_start) {
        candidates.push_back(task);
      }
    }

    std::vector<Task> selected =
        SelectTasksWithDynamicProgramming(candidates, free_minutes);
    std::sort(selected.begin(), selected.end(),
              [reference_time](const Task& left, const Task& right) {
                const std::time_t left_deadline = ParseDateTime(left.deadline);
                const std::time_t right_deadline = ParseDateTime(right.deadline);
                if (left_deadline != right_deadline) {
                  return left_deadline < right_deadline;
                }
                return CalculateUrgencyScore(left, reference_time) >
                       CalculateUrgencyScore(right, reference_time);
              });

    std::unordered_set<int> selected_on_day;
    for (const auto& task : selected) {
      selected_ids.push_back(task.id);
      selected_on_day.insert(task.id);
    }
    remaining_tasks.erase(
        std::remove_if(remaining_tasks.begin(), remaining_tasks.end(),
                       [&selected_on_day](const Task& task) {
                         return selected_on_day.find(task.id) !=
                                selected_on_day.end();
                       }),
        remaining_tasks.end());
  }

  const std::vector<Task> prioritized =
      PrioritizeTasks(tasks, reference_time, selected_ids);
  const ScheduleResult greedy_result = RunGreedyScheduler(prioritized, slots);
  return RepairScheduleWithBacktracking(greedy_result, prioritized, slots);
}
