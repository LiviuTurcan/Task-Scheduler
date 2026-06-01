#pragma once

#include <ctime>
#include <vector>

#include "../models.h"

int CalculateUrgencyScore(const Task& task, std::time_t reference_time);
std::vector<Task> TopologicalSort(const std::vector<Task>& tasks);
std::vector<Task> PrioritizeTasks(
    const std::vector<Task>& tasks, std::time_t reference_time,
    const std::vector<int>& preferred_task_ids = {});
std::vector<Task> SelectTasksWithDynamicProgramming(
    const std::vector<Task>& tasks, int available_minutes);
