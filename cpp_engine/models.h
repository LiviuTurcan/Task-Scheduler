#pragma once

#include <string>
#include <vector>

struct Task {
  int id = 0;
  std::string name;
  int duration_minutes = 0;
  std::string deadline;
  int priority = 0;
  int difficulty = 0;
  std::vector<int> dependencies;
  bool can_split = false;
  bool fixed = false;
  std::string fixed_start;
  std::string fixed_end;
};

struct TimeSlot {
  std::string start;
  std::string end;
  bool occupied = false;
  int task_id = 0;
};

struct ScheduledTask {
  int task_id = 0;
  std::string task_name;
  std::string start;
  std::string end;
  int priority = 0;
};

struct ScheduleResult {
  struct UnscheduledTask {
    int task_id = 0;
    std::string task_name;
    std::string reason;
  };

  struct Statistics {
    int total_tasks = 0;
    int scheduled_tasks = 0;
    int unscheduled_tasks = 0;
    int conflicts = 0;
    int deadline_violations = 0;
    int score = 0;
  };

  std::string generated_by;
  std::vector<ScheduledTask> schedule;
  std::vector<UnscheduledTask> unscheduled_tasks;
  Statistics statistics;
};
