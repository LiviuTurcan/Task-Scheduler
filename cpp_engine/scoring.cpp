#include "scoring.h"

#include <stdexcept>

namespace {
[[noreturn]] void ThrowPhaseFourPlaceholder(const char* component) {
  throw std::logic_error(std::string(component) +
                         " is part of the Phase 4 algorithm implementation");
}
}  // namespace

int CalculateScheduleScore(const ScheduleResult&) {
  ThrowPhaseFourPlaceholder("Schedule scoring");
}

int CalculateValidationPenalty(const ScheduleResult&) {
  ThrowPhaseFourPlaceholder("Validation penalties");
}
