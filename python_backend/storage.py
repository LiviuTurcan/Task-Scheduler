"""JSON storage helpers shared by the backend and the future UI."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
TASKS_PATH = DATA_DIR / "tasks.json"
AVAILABILITY_PATH = DATA_DIR / "availability.json"
FIXED_EVENTS_PATH = DATA_DIR / "fixed_events.json"
SCHEDULE_OUTPUT_PATH = DATA_DIR / "schedule_output.json"


class StorageError(RuntimeError):
    """Raised when a JSON data file cannot be loaded or saved."""


def _load_json(path: str | Path) -> Any:
    file_path = Path(path)
    try:
        with file_path.open("r", encoding="utf-8") as input_file:
            return json.load(input_file)
    except FileNotFoundError as exc:
        raise StorageError(f"Data file does not exist: {file_path}") from exc
    except json.JSONDecodeError as exc:
        raise StorageError(
            f"Invalid JSON in {file_path}: line {exc.lineno}, column {exc.colno}"
        ) from exc
    except OSError as exc:
        raise StorageError(f"Unable to read data file {file_path}: {exc}") from exc


def _save_json(path: str | Path, data: Any) -> None:
    file_path = Path(path)
    temporary_path = file_path.with_suffix(f"{file_path.suffix}.tmp")
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        with temporary_path.open("w", encoding="utf-8") as output_file:
            json.dump(data, output_file, indent=2)
            output_file.write("\n")
        temporary_path.replace(file_path)
    except OSError as exc:
        try:
            temporary_path.unlink(missing_ok=True)
        except OSError:
            pass
        raise StorageError(f"Unable to save data file {file_path}: {exc}") from exc


def _load_array(path: str | Path, label: str) -> list[dict[str, Any]]:
    data = _load_json(path)
    if not isinstance(data, list):
        raise StorageError(f"{label} JSON must contain an array")
    return data


def load_tasks(path: str | Path = TASKS_PATH) -> list[dict[str, Any]]:
    return _load_array(path, "Tasks")


def save_tasks(tasks: list[dict[str, Any]], path: str | Path = TASKS_PATH) -> None:
    _save_json(path, tasks)


def load_availability(
    path: str | Path = AVAILABILITY_PATH,
) -> list[dict[str, Any]]:
    return _load_array(path, "Availability")


def save_availability(
    availability: list[dict[str, Any]], path: str | Path = AVAILABILITY_PATH
) -> None:
    _save_json(path, availability)


def load_fixed_events(
    path: str | Path = FIXED_EVENTS_PATH,
) -> list[dict[str, Any]]:
    return _load_array(path, "Fixed events")


def save_fixed_events(
    fixed_events: list[dict[str, Any]], path: str | Path = FIXED_EVENTS_PATH
) -> None:
    _save_json(path, fixed_events)


def load_schedule_output(
    path: str | Path = SCHEDULE_OUTPUT_PATH,
) -> dict[str, Any]:
    data = _load_json(path)
    if not isinstance(data, dict):
        raise StorageError("Schedule output JSON must contain an object")
    return data
