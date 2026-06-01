#pragma once

#include <ctime>
#include <string>

std::time_t ParseDateTime(const std::string& value);
std::string FormatDateTime(std::time_t value);
std::string AddMinutes(const std::string& value, int minutes);
int DifferenceInMinutes(const std::string& start, const std::string& end);
