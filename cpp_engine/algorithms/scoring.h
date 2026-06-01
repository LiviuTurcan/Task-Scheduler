#pragma once

#include "../models.h"

int CountScheduleConflicts(const ScheduleResult& result);
int CountDeadlineViolations(const ScheduleResult& result);
int CalculateValidationPenalty(const ScheduleResult& result);
int CalculateScheduleScore(const ScheduleResult& result);
