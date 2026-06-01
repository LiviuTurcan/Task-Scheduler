"""Schedule export helpers for TXT, CSV, and JSON reports."""

from __future__ import annotations

import csv
import json
from pathlib import Path
from typing import Any

from .validators import validate_schedule_output


def _prepare_destination(destination: str | Path) -> Path:
    path = Path(destination)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def export_schedule_txt(schedule_output: dict[str, Any], destination: str | Path) -> Path:
    validate_schedule_output(schedule_output)
    path = _prepare_destination(destination)
    statistics = schedule_output["statistics"]
    lines = [
        "Task Scheduler Report",
        "",
        (
            f"Scheduled: {statistics['scheduled_tasks']} / "
            f"{statistics['total_tasks']}"
        ),
        f"Unscheduled: {statistics['unscheduled_tasks']}",
        f"Conflicts: {statistics['conflicts']}",
        f"Deadline violations: {statistics['deadline_violations']}",
        f"Score: {statistics['score']}",
        "",
        "Schedule:",
    ]
    for task in schedule_output["schedule"]:
        lines.append(
            f"- {task['start']} -> {task['end']} | {task['task_name']} "
            f"(priority {task['priority']}, deadline {task['deadline']})"
        )
    if not schedule_output["schedule"]:
        lines.append("- No scheduled tasks")

    lines.extend(["", "Unscheduled tasks:"])
    for task in schedule_output["unscheduled_tasks"]:
        lines.append(f"- {task['task_name']}: {task['reason']}")
    if not schedule_output["unscheduled_tasks"]:
        lines.append("- None")

    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def export_schedule_csv(schedule_output: dict[str, Any], destination: str | Path) -> Path:
    validate_schedule_output(schedule_output)
    path = _prepare_destination(destination)
    fieldnames = ["task_id", "task_name", "start", "end", "priority", "deadline"]
    with path.open("w", encoding="utf-8", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(schedule_output["schedule"])
    return path


def export_schedule_json(
    schedule_output: dict[str, Any], destination: str | Path
) -> Path:
    validate_schedule_output(schedule_output)
    path = _prepare_destination(destination)
    with path.open("w", encoding="utf-8") as output_file:
        json.dump(schedule_output, output_file, indent=2)
        output_file.write("\n")
    return path
