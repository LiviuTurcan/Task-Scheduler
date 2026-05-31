#pragma once

#include <string>
#include <vector>

#include "models.h"

std::vector<Task> ReadTasks(const std::string& path);
std::vector<TimeSlot> ReadAvailability(const std::string& path);
std::vector<Task> ReadFixedEvents(const std::string& path);
void WriteScheduleResult(const std::string& path, const ScheduleResult& result);
