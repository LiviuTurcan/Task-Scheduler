#include "json_io.h"

#include <fstream>
#include <stdexcept>

#include "algorithms/time_utils.h"
#include "nlohmann/json.hpp"

namespace {
using nlohmann::json;

json LoadJsonFile(const std::string& path) {
  std::ifstream input(path);
  if (!input.is_open()) {
    throw std::runtime_error("Failed to open JSON file: " + path);
  }

  json data;
  try {
    input >> data;
  } catch (const json::parse_error& ex) {
    throw std::runtime_error("Failed to parse JSON file: " + path + " (" +
                             std::string(ex.what()) + ")");
  }
  return data;
}

}  // namespace

std::vector<Task> ReadTasks(const std::string& path) {
  json data = LoadJsonFile(path);
  if (!data.is_array()) {
    throw std::runtime_error("Tasks JSON must be an array");
  }

  std::vector<Task> tasks;
  tasks.reserve(data.size());

  for (const auto& item : data) {
    if (!item.is_object()) {
      throw std::runtime_error("Task entry must be an object");
    }

    Task task;
    task.id = item.at("id").get<int>();
    task.name = item.at("name").get<std::string>();
    task.duration_minutes = item.at("duration_minutes").get<int>();
    task.deadline = item.at("deadline").get<std::string>();
    task.priority = item.at("priority").get<int>();
    task.difficulty = item.at("difficulty").get<int>();
    task.dependencies = item.at("dependencies").get<std::vector<int>>();
    task.can_split = item.at("can_split").get<bool>();
    task.fixed = item.at("fixed").get<bool>();

    const auto& fixed_start = item.at("fixed_start");
    const auto& fixed_end = item.at("fixed_end");
    task.fixed_start = fixed_start.is_null() ? std::string() : fixed_start.get<std::string>();
    task.fixed_end = fixed_end.is_null() ? std::string() : fixed_end.get<std::string>();

    tasks.push_back(std::move(task));
  }

  return tasks;
}

std::vector<TimeSlot> ReadAvailability(const std::string& path) {
  json data = LoadJsonFile(path);
  if (!data.is_array()) {
    throw std::runtime_error("Availability JSON must be an array");
  }

  std::vector<TimeSlot> slots;
  slots.reserve(data.size());

  for (const auto& item : data) {
    if (!item.is_object()) {
      throw std::runtime_error("Availability entry must be an object");
    }

    TimeSlot slot;
    slot.start = item.at("start").get<std::string>();
    slot.end = item.at("end").get<std::string>();
    slots.push_back(std::move(slot));
  }

  return slots;
}

std::vector<Task> ReadFixedEvents(const std::string& path) {
  json data = LoadJsonFile(path);
  if (!data.is_array()) {
    throw std::runtime_error("Fixed events JSON must be an array");
  }

  std::vector<Task> fixed_events;
  fixed_events.reserve(data.size());

  for (const auto& item : data) {
    if (!item.is_object()) {
      throw std::runtime_error("Fixed event entry must be an object");
    }

    Task event_task;
    event_task.id = item.at("id").get<int>();
    event_task.name = item.at("name").get<std::string>();
    event_task.fixed_start = item.at("start").get<std::string>();
    event_task.fixed_end = item.at("end").get<std::string>();
    event_task.duration_minutes =
        DifferenceInMinutes(event_task.fixed_start, event_task.fixed_end);
    event_task.deadline = event_task.fixed_end;
    event_task.priority = 0;
    event_task.difficulty = 0;
    event_task.can_split = false;
    event_task.fixed = true;

    fixed_events.push_back(std::move(event_task));
  }

  return fixed_events;
}

void WriteScheduleResult(const std::string& path, const ScheduleResult& result) {
  json data;
  data["generated_by"] = result.generated_by;

  json schedule = json::array();
  for (const auto& item : result.schedule) {
    schedule.push_back({
        {"task_id", item.task_id},
        {"task_name", item.task_name},
        {"start", item.start},
        {"end", item.end},
        {"priority", item.priority},
    });
  }
  data["schedule"] = std::move(schedule);

  json unscheduled = json::array();
  for (const auto& item : result.unscheduled_tasks) {
    unscheduled.push_back({
        {"task_id", item.task_id},
        {"task_name", item.task_name},
        {"reason", item.reason},
    });
  }
  data["unscheduled_tasks"] = std::move(unscheduled);

  data["statistics"] = {
      {"total_tasks", result.statistics.total_tasks},
      {"scheduled_tasks", result.statistics.scheduled_tasks},
      {"unscheduled_tasks", result.statistics.unscheduled_tasks},
      {"conflicts", result.statistics.conflicts},
      {"deadline_violations", result.statistics.deadline_violations},
      {"score", result.statistics.score},
  };

  std::ofstream output(path);
  if (!output.is_open()) {
    throw std::runtime_error("Failed to open output JSON file: " + path);
  }

  output << data.dump(2);
  output << '\n';
}
