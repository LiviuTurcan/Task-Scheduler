"""Subprocess bridge for running the C++ scheduler executable."""

from __future__ import annotations

import platform
import subprocess
from dataclasses import dataclass
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Use .exe on Windows, plain binary name elsewhere (macOS / Linux)
_SCHEDULER_BINARY = "scheduler.exe" if platform.system() == "Windows" else "scheduler"


def _resolve_path(root: Path, value: str | Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


@dataclass(frozen=True)
class SchedulerRunResult:
    returncode: int | None
    stdout: str = ""
    stderr: str = ""
    error: str = ""

    @property
    def success(self) -> bool:
        return self.returncode == 0 and not self.error

    @property
    def message(self) -> str:
        return self.error or self.stderr.strip() or self.stdout.strip()


def run_scheduler(
    project_root: str | Path = PROJECT_ROOT,
    *,
    executable: str | Path | None = None,
    tasks_path: str | Path | None = None,
    availability_path: str | Path | None = None,
    fixed_events_path: str | Path | None = None,
    output_path: str | Path | None = None,
    timeout_seconds: float = 30.0,
) -> SchedulerRunResult:
    root = Path(project_root).resolve()
    scheduler_executable = _resolve_path(
        root, executable or root / "cpp_engine" / _SCHEDULER_BINARY
    )
    tasks = _resolve_path(root, tasks_path or root / "data" / "tasks.json")
    availability = _resolve_path(
        root, availability_path or root / "data" / "availability.json"
    )
    fixed_events = _resolve_path(
        root, fixed_events_path or root / "data" / "fixed_events.json"
    )
    output = _resolve_path(
        root, output_path or root / "data" / "schedule_output.json"
    )

    if not scheduler_executable.is_file():
        return SchedulerRunResult(
            returncode=None,
            error=f"Scheduler executable does not exist: {scheduler_executable}",
        )

    try:
        completed = subprocess.run(
            [
                str(scheduler_executable),
                str(tasks),
                str(availability),
                str(fixed_events),
                str(output),
            ],
            cwd=root,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return SchedulerRunResult(
            returncode=None,
            stdout=exc.stdout or "",
            stderr=exc.stderr or "",
            error=f"Scheduler timed out after {timeout_seconds:g} seconds",
        )
    except OSError as exc:
        return SchedulerRunResult(
            returncode=None,
            error=f"Unable to start scheduler executable: {exc}",
        )

    return SchedulerRunResult(
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
