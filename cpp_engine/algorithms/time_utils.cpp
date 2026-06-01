#include "time_utils.h"

#include <iomanip>
#include <limits>
#include <sstream>
#include <stdexcept>

std::time_t ParseDateTime(const std::string& value) {
  std::tm parsed{};
  std::istringstream input(value);
  input >> std::get_time(&parsed, "%Y-%m-%dT%H:%M:%S");
  if (input.fail()) {
    throw std::runtime_error(
        "Invalid datetime format; expected YYYY-MM-DDTHH:MM:SS: " + value);
  }

  input >> std::ws;
  if (input.peek() != std::char_traits<char>::eof()) {
    throw std::runtime_error(
        "Invalid datetime format; expected YYYY-MM-DDTHH:MM:SS: " + value);
  }

  parsed.tm_isdst = -1;
  const std::time_t timestamp = std::mktime(&parsed);
  if (timestamp == static_cast<std::time_t>(-1)) {
    throw std::runtime_error("Unable to convert datetime: " + value);
  }
  return timestamp;
}

std::string FormatDateTime(std::time_t value) {
  std::tm local_time{};
#ifdef _WIN32
  if (localtime_s(&local_time, &value) != 0) {
#else
  if (localtime_r(&value, &local_time) == nullptr) {
#endif
    throw std::runtime_error("Unable to format datetime");
  }

  std::ostringstream output;
  output << std::put_time(&local_time, "%Y-%m-%dT%H:%M:%S");
  return output.str();
}

std::string AddMinutes(const std::string& value, int minutes) {
  return FormatDateTime(ParseDateTime(value) +
                        static_cast<std::time_t>(minutes) * 60);
}

int DifferenceInMinutes(const std::string& start, const std::string& end) {
  const double seconds = std::difftime(ParseDateTime(end), ParseDateTime(start));
  if (seconds < 0) {
    throw std::runtime_error("End time is before start time");
  }
  if (seconds / 60.0 > std::numeric_limits<int>::max()) {
    throw std::runtime_error("Datetime interval is too large");
  }
  return static_cast<int>(seconds / 60.0);
}
