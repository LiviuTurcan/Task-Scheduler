#pragma once

#include <string>
#include <vector>

#include "../models.h"

std::vector<TimeSlot> GenerateTimeSlots(const std::vector<TimeSlot>& availability,
                                        int slot_minutes = 30);
void BlockFixedEvents(std::vector<TimeSlot>* slots,
                      const std::vector<Task>& fixed_events);
bool HasOverlap(const std::string& first_start, const std::string& first_end,
                const std::string& second_start, const std::string& second_end);
ScheduleResult RunGreedyScheduler(const std::vector<Task>& tasks,
                                  const std::vector<TimeSlot>& slots);
ScheduleResult RepairScheduleWithBacktracking(const ScheduleResult& initial_result,
                                              const std::vector<Task>& tasks,
                                              const std::vector<TimeSlot>& slots);
ScheduleResult GenerateSchedule(const std::vector<Task>& tasks,
                                const std::vector<TimeSlot>& availability,
                                const std::vector<Task>& fixed_events);
