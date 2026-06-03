"""Input and schedule-output validation for the task scheduler backend."""

from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from typing import Any

DATETIME_FORMAT = "%Y-%m-%dT%H:%M:%S"
TASK_FIELDS = {
    "id",
    "name",
    "duration_minutes",
    "deadline",
    "priority",
    "difficulty",
    "dependencies",
    "can_split",
    "fixed",
    "fixed_start",
    "fixed_end",
}


class ValidationError(ValueError):
    """Raised with all validation failures found in one pass."""

    def __init__(self, errors: list[str]) -> None:
        self.errors = tuple(errors)
        super().__init__("\n".join(self.errors))


def _is_integer(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)


def _require_fields(item: Mapping[str, Any], fields: set[str], label: str) -> list[str]:
    return [f"{label} is missing required field '{field}'" for field in sorted(fields - item.keys())]


def _validate_datetime(value: Any, label: str, errors: list[str]) -> datetime | None:
    if not isinstance(value, str):
        errors.append(f"{label} must be a string in YYYY-MM-DDTHH:MM:SS format")
        return None
    try:
        parsed = datetime.strptime(value, DATETIME_FORMAT)
    except ValueError:
        errors.append(f"{label} must use YYYY-MM-DDTHH:MM:SS format")
        return None
    if parsed.strftime(DATETIME_FORMAT) != value:
        errors.append(f"{label} must use YYYY-MM-DDTHH:MM:SS format")
        return None
    return parsed


def _validate_positive_integer(value: Any, label: str, errors: list[str]) -> int | None:
    if not _is_integer(value) or value <= 0:
        errors.append(f"{label} must be a positive integer")
        return None
    return value


def _validate_rating(value: Any, label: str, errors: list[str]) -> None:
    if not _is_integer(value) or not 1 <= value <= 5:
        errors.append(f"{label} must be an integer from 1 to 5")


def _validate_name(value: Any, label: str, errors: list[str]) -> None:
    if not isinstance(value, str) or not value.strip():
        errors.append(f"{label} must not be empty")


def _validate_dependency_cycles(
    dependencies_by_id: dict[int, list[int]], errors: list[str]
) -> None:
    visiting: set[int] = set()
    visited: set[int] = set()

    def visit(task_id: int) -> bool:
        if task_id in visiting:
            return True
        if task_id in visited:
            return False
        visiting.add(task_id)
        for dependency_id in dependencies_by_id.get(task_id, []):
            if dependency_id in dependencies_by_id and visit(dependency_id):
                return True
        visiting.remove(task_id)
        visited.add(task_id)
        return False

    for task_id in dependencies_by_id:
        if visit(task_id):
            errors.append("Tasks contain a circular dependency")
            return


def validate_tasks(tasks: Any) -> None:
    errors: list[str] = []
    if not isinstance(tasks, list):
        raise ValidationError(["Tasks must be an array"])

    task_ids: set[int] = set()
    dependencies_by_id: dict[int, list[int]] = {}
    for index, task in enumerate(tasks):
        label = f"Task #{index + 1}"
        if not isinstance(task, Mapping):
            errors.append(f"{label} must be an object")
            continue
        errors.extend(_require_fields(task, TASK_FIELDS, label))

        task_id = _validate_positive_integer(task.get("id"), f"{label} id", errors)
        if task_id is not None:
            if task_id in task_ids:
                errors.append(f"{label} has duplicate id {task_id}")
            task_ids.add(task_id)

        _validate_name(task.get("name"), f"{label} name", errors)
        _validate_positive_integer(
            task.get("duration_minutes"), f"{label} duration_minutes", errors
        )
        _validate_datetime(task.get("deadline"), f"{label} deadline", errors)
        _validate_rating(task.get("priority"), f"{label} priority", errors)
        _validate_rating(task.get("difficulty"), f"{label} difficulty", errors)

        dependencies = task.get("dependencies")
        valid_dependencies: list[int] = []
        if not isinstance(dependencies, list):
            errors.append(f"{label} dependencies must be an array")
        else:
            seen_dependencies: set[int] = set()
            for dependency in dependencies:
                if not _is_integer(dependency) or dependency <= 0:
                    errors.append(f"{label} dependencies must contain positive integers")
                    continue
                if dependency in seen_dependencies:
                    errors.append(f"{label} has duplicate dependency {dependency}")
                    continue
                seen_dependencies.add(dependency)
                valid_dependencies.append(dependency)
            if task_id is not None:
                dependencies_by_id[task_id] = valid_dependencies

        can_split = task.get("can_split")
        if not isinstance(can_split, bool):
            errors.append(f"{label} can_split must be true or false")
        fixed = task.get("fixed")
        if not isinstance(fixed, bool):
            errors.append(f"{label} fixed must be true or false")

        fixed_start = task.get("fixed_start")
        fixed_end = task.get("fixed_end")
        if fixed_start is None and fixed_end is None:
            if fixed is True:
                errors.append(f"{label} fixed tasks require fixed_start and fixed_end")
        elif fixed_start is None or fixed_end is None:
            errors.append(f"{label} fixed_start and fixed_end must both be provided")
        else:
            start = _validate_datetime(fixed_start, f"{label} fixed_start", errors)
            end = _validate_datetime(fixed_end, f"{label} fixed_end", errors)
            if start is not None and end is not None and start >= end:
                errors.append(f"{label} fixed_end must be after fixed_start")

    for task_id, dependencies in dependencies_by_id.items():
        for dependency_id in dependencies:
            if dependency_id == task_id:
                errors.append(f"Task id {task_id} cannot depend on itself")
            elif dependency_id not in task_ids:
                errors.append(f"Task id {task_id} has missing dependency {dependency_id}")
    _validate_dependency_cycles(dependencies_by_id, errors)

    if errors:
        raise ValidationError(errors)


def validate_availability(availability: Any) -> None:
    errors: list[str] = []
    if not isinstance(availability, list):
        raise ValidationError(["Availability must be an array"])

    for index, interval in enumerate(availability):
        label = f"Availability interval #{index + 1}"
        if not isinstance(interval, Mapping):
            errors.append(f"{label} must be an object")
            continue
        errors.extend(_require_fields(interval, {"start", "end"}, label))
        start = _validate_datetime(interval.get("start"), f"{label} start", errors)
        end = _validate_datetime(interval.get("end"), f"{label} end", errors)
        if start is not None and end is not None and start >= end:
            errors.append(f"{label} end must be after start")

    if errors:
        raise ValidationError(errors)


def validate_fixed_events(fixed_events: Any) -> None:
    errors: list[str] = []
    if not isinstance(fixed_events, list):
        raise ValidationError(["Fixed events must be an array"])

    event_ids: set[int] = set()
    for index, event in enumerate(fixed_events):
        label = f"Fixed event #{index + 1}"
        if not isinstance(event, Mapping):
            errors.append(f"{label} must be an object")
            continue
        errors.extend(_require_fields(event, {"id", "name", "start", "end"}, label))
        event_id = _validate_positive_integer(event.get("id"), f"{label} id", errors)
        if event_id is not None:
            if event_id in event_ids:
                errors.append(f"{label} has duplicate id {event_id}")
            event_ids.add(event_id)
        _validate_name(event.get("name"), f"{label} name", errors)
        start = _validate_datetime(event.get("start"), f"{label} start", errors)
        end = _validate_datetime(event.get("end"), f"{label} end", errors)
        if start is not None and end is not None and start >= end:
            errors.append(f"{label} end must be after start")

    if errors:
        raise ValidationError(errors)


def validate_inputs(tasks: Any, availability: Any, fixed_events: Any) -> None:
    errors: list[str] = []
    for validator, data in (
        (validate_tasks, tasks),
        (validate_availability, availability),
        (validate_fixed_events, fixed_events),
    ):
        try:
            validator(data)
        except ValidationError as exc:
            errors.extend(exc.errors)

    if isinstance(tasks, list) and isinstance(fixed_events, list):
        task_ids = {
            task.get("id")
            for task in tasks
            if isinstance(task, Mapping) and _is_integer(task.get("id"))
        }
        for event in fixed_events:
            if (
                isinstance(event, Mapping)
                and _is_integer(event.get("id"))
                and event.get("id") in task_ids
            ):
                errors.append(f"Task and fixed event ids must be unique: {event['id']}")

    if errors:
        raise ValidationError(errors)


def validate_schedule_output(schedule_output: Any) -> None:
    errors: list[str] = []
    if not isinstance(schedule_output, Mapping):
        raise ValidationError(["Schedule output must be an object"])

    schedule = schedule_output.get("schedule")
    if not isinstance(schedule, list):
        errors.append("Schedule output schedule must be an array")
    else:
        for index, task in enumerate(schedule):
            label = f"Scheduled task #{index + 1}"
            if not isinstance(task, Mapping):
                errors.append(f"{label} must be an object")
                continue
            errors.extend(
                _require_fields(
                    task,
                    {"task_id", "task_name", "start", "end", "priority", "deadline"},
                    label,
                )
            )
            _validate_positive_integer(task.get("task_id"), f"{label} task_id", errors)
            _validate_name(task.get("task_name"), f"{label} task_name", errors)
            start = _validate_datetime(task.get("start"), f"{label} start", errors)
            end = _validate_datetime(task.get("end"), f"{label} end", errors)
            _validate_rating(task.get("priority"), f"{label} priority", errors)
            _validate_datetime(task.get("deadline"), f"{label} deadline", errors)
            if start is not None and end is not None and start >= end:
                errors.append(f"{label} end must be after start")

    unscheduled_tasks = schedule_output.get("unscheduled_tasks")
    if not isinstance(unscheduled_tasks, list):
        errors.append("Schedule output unscheduled_tasks must be an array")
    else:
        for index, task in enumerate(unscheduled_tasks):
            label = f"Unscheduled task #{index + 1}"
            if not isinstance(task, Mapping):
                errors.append(f"{label} must be an object")
                continue
            errors.extend(
                _require_fields(task, {"task_id", "task_name", "reason"}, label)
            )
            _validate_positive_integer(task.get("task_id"), f"{label} task_id", errors)
            _validate_name(task.get("task_name"), f"{label} task_name", errors)
            _validate_name(task.get("reason"), f"{label} reason", errors)

    statistics = schedule_output.get("statistics")
    statistic_fields = {
        "total_tasks",
        "scheduled_tasks",
        "unscheduled_tasks",
        "conflicts",
        "deadline_violations",
        "score",
    }
    if not isinstance(statistics, Mapping):
        errors.append("Schedule output statistics must be an object")
    else:
        errors.extend(_require_fields(statistics, statistic_fields, "Statistics"))
        for field in statistic_fields:
            value = statistics.get(field)
            if not _is_integer(value):
                errors.append(f"Statistics {field} must be an integer")
            elif field != "score" and value < 0:
                errors.append(f"Statistics {field} must not be negative")

    if errors:
        raise ValidationError(errors)
