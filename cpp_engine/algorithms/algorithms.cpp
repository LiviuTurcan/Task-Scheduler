#include "algorithms.h"
#include <algorithm>
#include <functional>
#include <limits>
#include <queue>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

#include "time_utils.h"

namespace {
struct DependencyGraph {
  std::unordered_map<int, Task> tasks_by_id;
  std::unordered_map<int, std::vector<int>> neighbors;
  std::unordered_map<int, int> indegrees;
};

DependencyGraph BuildDependencyGraph(const std::vector<Task>& tasks) {
  DependencyGraph graph;

  for (const auto& task : tasks) {
    if (!graph.tasks_by_id.emplace(task.id, task).second) {
      throw std::runtime_error("Duplicate task id: " + std::to_string(task.id));
    }
    graph.indegrees[task.id] = 0;
  }

  for (const auto& task : tasks) {
    for (const int dependency_id : task.dependencies) {
      if (graph.tasks_by_id.find(dependency_id) == graph.tasks_by_id.end()) {
        throw std::runtime_error("Task " + std::to_string(task.id) +
                                 " has missing dependency " +
                                 std::to_string(dependency_id));
      }
      graph.neighbors[dependency_id].push_back(task.id);
      ++graph.indegrees[task.id];
    }
  }

  return graph;
}

struct ReadyTask {
  Task task;
  int urgency = 0;
  std::size_t preference_rank = std::numeric_limits<std::size_t>::max();
  std::time_t deadline = 0;
};

struct ReadyTaskCompare {
  bool operator()(const ReadyTask& left, const ReadyTask& right) const {
    if (left.preference_rank != right.preference_rank) {
      return left.preference_rank > right.preference_rank;
    }
    if (left.urgency != right.urgency) {
      return left.urgency < right.urgency;
    }
    if (left.deadline != right.deadline) {
      return left.deadline > right.deadline;
    }
    return left.task.id > right.task.id;
  }
};
}  // namespace

int CalculateUrgencyScore(const Task& task, std::time_t reference_time) {
  const double seconds_until_deadline =
      std::difftime(ParseDateTime(task.deadline), reference_time);
  const long long hours_until_deadline =
      static_cast<long long>(seconds_until_deadline / 3600.0);
  const long long score = static_cast<long long>(task.priority) * 100 +
                          static_cast<long long>(task.difficulty) * 10 -
                          hours_until_deadline;

  if (score > std::numeric_limits<int>::max()) {
    return std::numeric_limits<int>::max();
  }
  if (score < std::numeric_limits<int>::min()) {
    return std::numeric_limits<int>::min();
  }
  return static_cast<int>(score);
}

std::vector<Task> TopologicalSort(const std::vector<Task>& tasks) {
  DependencyGraph graph = BuildDependencyGraph(tasks);
  std::priority_queue<int, std::vector<int>, std::greater<int>> ready;

  for (const auto& [task_id, indegree] : graph.indegrees) {
    if (indegree == 0) {
      ready.push(task_id);
    }
  }

  std::vector<Task> ordered;
  ordered.reserve(tasks.size());
  while (!ready.empty()) {
    const int task_id = ready.top();
    ready.pop();
    ordered.push_back(graph.tasks_by_id.at(task_id));

    for (const int neighbor_id : graph.neighbors[task_id]) {
      if (--graph.indegrees[neighbor_id] == 0) {
        ready.push(neighbor_id);
      }
    }
  }

  if (ordered.size() != tasks.size()) {
    throw std::runtime_error("Circular task dependency detected");
  }
  return ordered;
}

std::vector<Task> PrioritizeTasks(const std::vector<Task>& tasks,
                                  std::time_t reference_time,
                                  const std::vector<int>& preferred_task_ids) {
  DependencyGraph graph = BuildDependencyGraph(tasks);
  std::unordered_map<int, std::size_t> preference_ranks;
  for (std::size_t index = 0; index < preferred_task_ids.size(); ++index) {
    preference_ranks.emplace(preferred_task_ids[index], index);
  }
  std::priority_queue<ReadyTask, std::vector<ReadyTask>, ReadyTaskCompare> ready;

  const auto push_ready_task = [&](int task_id) {
    const Task& task = graph.tasks_by_id.at(task_id);
    const auto preference = preference_ranks.find(task_id);
    const std::size_t rank =
        preference == preference_ranks.end()
            ? std::numeric_limits<std::size_t>::max()
            : preference->second;
    ready.push({task, CalculateUrgencyScore(task, reference_time), rank,
                ParseDateTime(task.deadline)});
  };

  for (const auto& [task_id, indegree] : graph.indegrees) {
    if (indegree == 0) {
      push_ready_task(task_id);
    }
  }

  std::vector<Task> ordered;
  ordered.reserve(tasks.size());
  while (!ready.empty()) {
    const int task_id = ready.top().task.id;
    ordered.push_back(ready.top().task);
    ready.pop();

    for (const int neighbor_id : graph.neighbors[task_id]) {
      if (--graph.indegrees[neighbor_id] == 0) {
        push_ready_task(neighbor_id);
      }
    }
  }

  if (ordered.size() != tasks.size()) {
    throw std::runtime_error("Circular task dependency detected");
  }
  return ordered;
}

std::vector<Task> SelectTasksWithDynamicProgramming(
    const std::vector<Task>& tasks, int available_minutes) {
  if (available_minutes < 0) {
    throw std::runtime_error("Available minutes cannot be negative");
  }

  const std::size_t task_count = tasks.size();
  std::vector<std::vector<int>> dp(
      task_count + 1, std::vector<int>(available_minutes + 1, 0));

  for (std::size_t index = 1; index <= task_count; ++index) {
    const Task& task = tasks[index - 1];
    if (task.duration_minutes <= 0) {
      throw std::runtime_error("Task duration must be positive: " + task.name);
    }

    const int value = task.priority * 100 + task.difficulty * 10;
    for (int minutes = 0; minutes <= available_minutes; ++minutes) {
      dp[index][minutes] = dp[index - 1][minutes];
      if (task.duration_minutes <= minutes) {
        dp[index][minutes] =
            std::max(dp[index][minutes],
                     dp[index - 1][minutes - task.duration_minutes] + value);
      }
    }
  }

  std::vector<Task> selected;
  int minutes = available_minutes;
  for (std::size_t index = task_count; index > 0; --index) {
    if (dp[index][minutes] != dp[index - 1][minutes]) {
      const Task& task = tasks[index - 1];
      selected.push_back(task);
      minutes -= task.duration_minutes;
    }
  }
  std::reverse(selected.begin(), selected.end());
  return selected;
}
