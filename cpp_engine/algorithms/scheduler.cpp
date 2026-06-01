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
constexpr std::size_t kBacktrackingTaskLimit = 6;
constexpr std::size_t kBacktrackingUnscheduledLimit = 3;
constexpr std::size_t kBacktrackingPlacementLimit = 4;
constexpr int kLocalSearchIterations = 3;

struct Placement {
  std::vector<ScheduledTask> segments;
  std::vector<std::size_t> slot_indexes;
};

std::unordered_set<int> ScheduledTaskIds(const ScheduleResult& result) {
  std::unordered_set<int> task_ids;
  for (const auto& task : result.schedule) {
    task_ids.insert(task.task_id);
  }
  return task_ids;
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

std::time_t LatestDependencyEnd(
    const Task& task, const std::unordered_map<int, std::time_t>& completion_times,
    const std::vector<TimeSlot>& slots, bool* dependencies_ready) {
  *dependencies_ready = true;
  if (task.dependencies.empty()) {
    return slots.empty() ? std::numeric_limits<std::time_t>::min()
                         : ParseDateTime(slots.front().start);
  }

  std::time_t latest_end = std::numeric_limits<std::time_t>::min();
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
      candidate.segments.push_back({task.id, task.name, FormatDateTime(task_start),
                                    FormatDateTime(task_end), task.priority,
                                    task.deadline});
      *placement = std::move(candidate);
      return true;
    }

    remaining_seconds -= available_seconds;
    cursor = current_end;
  }
  return false;
}

bool BuildSplitPlacementAt(const Task& task, const std::vector<TimeSlot>& slots,
                           std::time_t earliest_start,
                           std::size_t first_slot_index,
                           Placement* placement) {
  if (first_slot_index >= slots.size() || slots[first_slot_index].occupied) {
    return false;
  }

  const std::time_t deadline = ParseDateTime(task.deadline);
  const std::time_t first_start =
      std::max(ParseDateTime(slots[first_slot_index].start), earliest_start);
  const std::time_t first_end =
      std::min(ParseDateTime(slots[first_slot_index].end), deadline);
  if (first_start >= first_end) {
    return false;
  }

  int remaining_seconds = task.duration_minutes * 60;
  Placement candidate;
  for (std::size_t index = first_slot_index; index < slots.size(); ++index) {
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
                                    FormatDateTime(segment_end), task.priority,
                                    task.deadline});
    }

    remaining_seconds -= used_seconds;
    if (remaining_seconds == 0) {
      *placement = std::move(candidate);
      return true;
    }
  }
  return false;
}

std::vector<Placement> FindTaskPlacements(const Task& task,
                                          const std::vector<TimeSlot>& slots,
                                          std::time_t earliest_start,
                                          std::size_t limit) {
  if (task.duration_minutes <= 0) {
    throw std::runtime_error("Task duration must be positive: " + task.name);
  }

  std::vector<Placement> placements;
  std::unordered_set<std::string> starts;
  for (std::size_t index = 0; index < slots.size() && placements.size() < limit;
       ++index) {
    Placement placement;
    const bool placed =
        task.can_split
            ? BuildSplitPlacementAt(task, slots, earliest_start, index, &placement)
            : BuildContinuousPlacementAt(task, slots, earliest_start, index,
                                         &placement);
    if (placed && starts.insert(placement.segments.front().start).second) {
      placements.push_back(std::move(placement));
    }
  }
  return placements;
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

void MarkScheduledTasksOccupied(const ScheduleResult& result,
                                std::vector<TimeSlot>* slots) {
  for (const auto& scheduled : result.schedule) {
    for (auto& slot : *slots) {
      if (HasOverlap(slot.start, slot.end, scheduled.start, scheduled.end)) {
        slot.occupied = true;
        slot.task_id = scheduled.task_id;
      }
    }
  }
}

void RefreshStatistics(ScheduleResult* result) {
  std::sort(result->schedule.begin(), result->schedule.end(),
            [](const ScheduledTask& left, const ScheduledTask& right) {
              if (left.start != right.start) {
                return left.start < right.start;
              }
              return left.task_id < right.task_id;
            });
  result->statistics.scheduled_tasks =
      static_cast<int>(ScheduledTaskIds(*result).size());
  result->statistics.unscheduled_tasks =
      static_cast<int>(result->unscheduled_tasks.size());
  result->statistics.conflicts = CountScheduleConflicts(*result);
  result->statistics.deadline_violations = CountDeadlineViolations(*result);
  result->statistics.score = CalculateScheduleScore(*result);
}

void RebuildUnscheduledTasks(const std::vector<Task>& tasks,
                             const std::string& reason,
                             ScheduleResult* result) {
  const std::unordered_set<int> scheduled_task_ids = ScheduledTaskIds(*result);
  result->unscheduled_tasks.clear();
  for (const auto& task : tasks) {
    if (scheduled_task_ids.find(task.id) == scheduled_task_ids.end()) {
      result->unscheduled_tasks.push_back({task.id, task.name, reason});
    }
  }
}

bool IsBetterSchedule(const ScheduleResult& candidate,
                      const ScheduleResult& current_best) {
  if (candidate.statistics.score != current_best.statistics.score) {
    return candidate.statistics.score > current_best.statistics.score;
  }
  if (candidate.statistics.scheduled_tasks !=
      current_best.statistics.scheduled_tasks) {
    return candidate.statistics.scheduled_tasks >
           current_best.statistics.scheduled_tasks;
  }
  if (candidate.statistics.deadline_violations !=
      current_best.statistics.deadline_violations) {
    return candidate.statistics.deadline_violations <
           current_best.statistics.deadline_violations;
  }
  return candidate.statistics.conflicts < current_best.statistics.conflicts;
}

void EvaluateBacktrackingCandidate(const std::vector<Task>& all_tasks,
                                   ScheduleResult candidate,
                                   ScheduleResult* best_result) {
  RebuildUnscheduledTasks(all_tasks, "Not selected by schedule optimization",
                          &candidate);
  RefreshStatistics(&candidate);
  if (IsBetterSchedule(candidate, *best_result)) {
    *best_result = std::move(candidate);
  }
}

void BacktrackPlacements(const std::vector<Task>& all_tasks,
                         const std::vector<Task>& candidates, std::size_t index,
                         ScheduleResult current_result,
                         std::vector<TimeSlot> current_slots,
                         ScheduleResult* best_result) {
  RefreshStatistics(&current_result);
  EvaluateBacktrackingCandidate(all_tasks, current_result, best_result);
  if (index == candidates.size()) {
    return;
  }

  int maximum_additional_score = current_result.statistics.score;
  const std::unordered_set<int> scheduled_task_ids =
      ScheduledTaskIds(current_result);
  for (std::size_t remaining = index; remaining < candidates.size();
       ++remaining) {
    if (scheduled_task_ids.find(candidates[remaining].id) ==
        scheduled_task_ids.end()) {
      maximum_additional_score += candidates[remaining].priority * 100;
    }
  }
  if (maximum_additional_score < best_result->statistics.score) {
    return;
  }

  const Task& task = candidates[index];
  const auto completion_times = CompletionTimes(current_result);
  bool dependencies_ready = false;
  const std::time_t earliest_start =
      LatestDependencyEnd(task, completion_times, current_slots,
                          &dependencies_ready);
  if (dependencies_ready) {
    const std::vector<Placement> placements =
        FindTaskPlacements(task, current_slots, earliest_start,
                           kBacktrackingPlacementLimit);
    for (const auto& placement : placements) {
      ScheduleResult next_result = current_result;
      std::vector<TimeSlot> next_slots = current_slots;
      ApplyPlacement(placement, &next_slots, &next_result);
      BacktrackPlacements(all_tasks, candidates, index + 1,
                          std::move(next_result), std::move(next_slots),
                          best_result);
    }
  }

  BacktrackPlacements(all_tasks, candidates, index + 1,
                      std::move(current_result), std::move(current_slots),
                      best_result);
}

std::vector<int> SchedulePreferenceIds(const ScheduleResult& result,
                                       const std::vector<Task>& tasks) {
  std::vector<int> task_ids;
  std::unordered_set<int> added;
  for (const auto& scheduled : result.schedule) {
    if (added.insert(scheduled.task_id).second) {
      task_ids.push_back(scheduled.task_id);
    }
  }
  for (const auto& task : tasks) {
    if (added.insert(task.id).second) {
      task_ids.push_back(task.id);
    }
  }
  return task_ids;
}

std::vector<Task> SelectBacktrackingCandidates(
    const ScheduleResult& initial_result, const std::vector<Task>& tasks,
    std::time_t reference_time) {
  std::unordered_set<int> selected_ids;
  std::vector<Task> selected;
  const auto add_task = [&](const Task& task, std::vector<Task>* output,
                            std::unordered_set<int>* ids) {
    if (output->size() < kBacktrackingTaskLimit && ids->insert(task.id).second) {
      output->push_back(task);
    }
  };

  std::unordered_map<int, Task> tasks_by_id;
  for (const auto& task : tasks) {
    tasks_by_id.emplace(task.id, task);
  }

  std::vector<Task> unscheduled;
  for (const auto& task : initial_result.unscheduled_tasks) {
    const auto found = tasks_by_id.find(task.task_id);
    if (found != tasks_by_id.end()) {
      unscheduled.push_back(found->second);
    }
  }
  std::sort(unscheduled.begin(), unscheduled.end(),
            [reference_time](const Task& left, const Task& right) {
              return CalculateUrgencyScore(left, reference_time) >
                     CalculateUrgencyScore(right, reference_time);
            });
  for (std::size_t index = 0;
       index < unscheduled.size() && index < kBacktrackingUnscheduledLimit;
       ++index) {
    const Task& task = unscheduled[index];
    add_task(task, &selected, &selected_ids);
  }

  std::vector<Task> scheduled;
  const std::unordered_set<int> scheduled_ids = ScheduledTaskIds(initial_result);
  for (const auto& task : tasks) {
    if (scheduled_ids.find(task.id) != scheduled_ids.end()) {
      scheduled.push_back(task);
    }
  }
  std::sort(scheduled.begin(), scheduled.end(),
            [](const Task& left, const Task& right) {
              if (left.priority != right.priority) {
                return left.priority < right.priority;
              }
              return ParseDateTime(left.deadline) > ParseDateTime(right.deadline);
            });
  for (const auto& task : scheduled) {
    add_task(task, &selected, &selected_ids);
  }

  bool changed = true;
  while (changed) {
    changed = false;
    for (const auto& task : scheduled) {
      if (selected_ids.find(task.id) != selected_ids.end()) {
        continue;
      }
      for (const int dependency_id : task.dependencies) {
        if (selected_ids.find(dependency_id) == selected_ids.end()) {
          continue;
        }

        if (selected.size() < kBacktrackingTaskLimit) {
          add_task(task, &selected, &selected_ids);
        } else {
          selected_ids.erase(dependency_id);
          selected.erase(
              std::remove_if(selected.begin(), selected.end(),
                             [dependency_id](const Task& selected_task) {
                               return selected_task.id == dependency_id;
                             }),
              selected.end());
        }
        changed = true;
        break;
      }
    }
  }

  const std::vector<Task> prioritized =
      PrioritizeTasks(tasks, reference_time, SchedulePreferenceIds(initial_result,
                                                                   tasks));
  std::vector<Task> ordered;
  for (const auto& task : prioritized) {
    if (selected_ids.find(task.id) != selected_ids.end()) {
      ordered.push_back(task);
    }
  }
  return ordered;
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
    const std::time_t earliest_start =
        LatestDependencyEnd(task, completion_times, working_slots,
                            &dependencies_ready);
    if (!dependencies_ready) {
      result.unscheduled_tasks.push_back(
          {task.id, task.name, "A dependency could not be scheduled"});
      continue;
    }

    const std::vector<Placement> placements =
        FindTaskPlacements(task, working_slots, earliest_start, 1);
    if (placements.empty()) {
      result.unscheduled_tasks.push_back(
          {task.id, task.name, "Insufficient available time before deadline"});
      continue;
    }

    ApplyPlacement(placements.front(), &working_slots, &result);
    completion_times[task.id] =
        ParseDateTime(placements.front().segments.back().end);
  }

  RefreshStatistics(&result);
  return result;
}

ScheduleResult RepairScheduleWithBacktracking(
    const ScheduleResult& initial_result, const std::vector<Task>& tasks,
    const std::vector<TimeSlot>& slots) {
  ScheduleResult best_result = initial_result;
  RefreshStatistics(&best_result);
  if (initial_result.unscheduled_tasks.empty() || tasks.empty()) {
    return best_result;
  }

  const std::time_t reference_time =
      slots.empty() ? std::time(nullptr) : ParseDateTime(slots.front().start);
  const std::vector<Task> candidates =
      SelectBacktrackingCandidates(initial_result, tasks, reference_time);
  const std::unordered_set<int> candidate_ids = [&candidates]() {
    std::unordered_set<int> ids;
    for (const auto& task : candidates) {
      ids.insert(task.id);
    }
    return ids;
  }();

  ScheduleResult base_result;
  base_result.generated_by = initial_result.generated_by;
  base_result.statistics.total_tasks = static_cast<int>(tasks.size());
  for (const auto& task : initial_result.schedule) {
    if (candidate_ids.find(task.task_id) == candidate_ids.end()) {
      base_result.schedule.push_back(task);
    }
  }

  std::vector<TimeSlot> base_slots = slots;
  MarkScheduledTasksOccupied(base_result, &base_slots);
  BacktrackPlacements(tasks, candidates, 0, std::move(base_result),
                      std::move(base_slots), &best_result);
  RefreshStatistics(&best_result);
  return best_result;
}

ScheduleResult ImproveScheduleWithLocalSearch(
    const ScheduleResult& initial_result, const std::vector<Task>& tasks,
    const std::vector<TimeSlot>& slots) {
  ScheduleResult best_result = initial_result;
  RefreshStatistics(&best_result);
  if (tasks.size() < 2) {
    return best_result;
  }

  const std::time_t reference_time =
      slots.empty() ? std::time(nullptr) : ParseDateTime(slots.front().start);
  std::vector<int> preference_ids = SchedulePreferenceIds(best_result, tasks);
  for (int iteration = 0; iteration < kLocalSearchIterations; ++iteration) {
    bool improved = false;
    for (std::size_t from = 0; from < preference_ids.size(); ++from) {
      for (std::size_t to = 0; to < preference_ids.size(); ++to) {
        if (from == to) {
          continue;
        }

        std::vector<int> candidate_preferences = preference_ids;
        const int moved_task_id = candidate_preferences[from];
        candidate_preferences.erase(candidate_preferences.begin() + from);
        candidate_preferences.insert(candidate_preferences.begin() + to,
                                     moved_task_id);

        const std::vector<Task> prioritized =
            PrioritizeTasks(tasks, reference_time, candidate_preferences);
        ScheduleResult candidate = RunGreedyScheduler(prioritized, slots);
        if (IsBetterSchedule(candidate, best_result)) {
          best_result = std::move(candidate);
          preference_ids = std::move(candidate_preferences);
          improved = true;
        }
      }
    }
    if (!improved) {
      break;
    }
  }
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
  const ScheduleResult repaired_result =
      RepairScheduleWithBacktracking(greedy_result, prioritized, slots);
  return ImproveScheduleWithLocalSearch(repaired_result, prioritized, slots);
}
