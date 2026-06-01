#include "algorithms.h"

#include <stdexcept>

namespace {
[[noreturn]] void ThrowPhaseFourPlaceholder(const char* component) {
  throw std::logic_error(std::string(component) +
                         " is part of the Phase 4 algorithm implementation");
}
}  // namespace

std::vector<Task> TopologicalSort(const std::vector<Task>&) {
  ThrowPhaseFourPlaceholder("Topological sort");
}

std::vector<Task> PrioritizeTasks(const std::vector<Task>&) {
  ThrowPhaseFourPlaceholder("Priority queue logic");
}

std::vector<Task> SelectTasksWithDynamicProgramming(const std::vector<Task>&,
                                                    int) {
  ThrowPhaseFourPlaceholder("Dynamic programming selection");
}
