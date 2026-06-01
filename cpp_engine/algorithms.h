#pragma once

#include <vector>

#include "models.h"

std::vector<Task> TopologicalSort(const std::vector<Task>& tasks);
std::vector<Task> PrioritizeTasks(const std::vector<Task>& tasks);
std::vector<Task> SelectTasksWithDynamicProgramming(const std::vector<Task>& tasks,
                                                    int available_minutes);
