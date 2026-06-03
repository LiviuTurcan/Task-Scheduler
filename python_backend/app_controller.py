"""Backend controller used by the future desktop UI."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from . import cpp_bridge, reports, storage, validators


class SchedulerExecutionError(RuntimeError):
    """Raised when the C++ scheduling process fails."""


class AppController:
    def __init__(self, project_root: str | Path | None = None) -> None:
        self.project_root = Path(project_root or storage.PROJECT_ROOT).resolve()
        self.data_dir = self.project_root / "data"
        self.tasks_path = self.data_dir / "tasks.json"
        self.availability_path = self.data_dir / "availability.json"
        self.fixed_events_path = self.data_dir / "fixed_events.json"
        self.schedule_output_path = self.data_dir / "schedule_output.json"
        self.last_run_result: cpp_bridge.SchedulerRunResult | None = None

    def load_inputs(
        self,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
        tasks = storage.load_tasks(self.tasks_path)
        availability = storage.load_availability(self.availability_path)
        fixed_events = storage.load_fixed_events(self.fixed_events_path)
        validators.validate_inputs(tasks, availability, fixed_events)
        return tasks, availability, fixed_events

    def save_inputs(
        self,
        tasks: list[dict[str, Any]],
        availability: list[dict[str, Any]],
        fixed_events: list[dict[str, Any]],
    ) -> None:
        validators.validate_inputs(tasks, availability, fixed_events)
        storage.save_tasks(tasks, self.tasks_path)
        storage.save_availability(availability, self.availability_path)
        storage.save_fixed_events(fixed_events, self.fixed_events_path)

    def save_tasks(self, tasks: list[dict[str, Any]]) -> None:
        fixed_events = storage.load_fixed_events(self.fixed_events_path)
        validators.validate_inputs(tasks, [], fixed_events)
        storage.save_tasks(tasks, self.tasks_path)

    def save_availability(self, availability: list[dict[str, Any]]) -> None:
        validators.validate_availability(availability)
        storage.save_availability(availability, self.availability_path)

    def save_fixed_events(self, fixed_events: list[dict[str, Any]]) -> None:
        tasks = storage.load_tasks(self.tasks_path)
        validators.validate_inputs(tasks, [], fixed_events)
        storage.save_fixed_events(fixed_events, self.fixed_events_path)

    def load_schedule_output(self) -> dict[str, Any]:
        schedule_output = storage.load_schedule_output(self.schedule_output_path)
        validators.validate_schedule_output(schedule_output)
        return schedule_output

    def generate_schedule(self) -> dict[str, Any]:
        # 1. Load inputs
        tasks, availability, fixed_events = self.load_inputs()

        # 2. Partition tasks into active and fixed
        active_tasks = []
        fixed_tasks = []
        for t in tasks:
            if t.get("fixed", False):
                fixed_tasks.append(t)
            else:
                active_tasks.append(t)

        # 3. Create virtual fixed events for fixed tasks
        merged_fixed_events = list(fixed_events)
        for ft in fixed_tasks:
            virtual_event = {
                "id": ft["id"] + 10000,
                "name": ft["name"],
                "start": ft["fixed_start"],
                "end": ft["fixed_end"]
            }
            merged_fixed_events.append(virtual_event)

        # 4. Save to temporary file paths
        tmp_tasks_path = self.data_dir / "tasks_tmp.json"
        tmp_fixed_events_path = self.data_dir / "fixed_events_tmp.json"
        tmp_output_path = self.data_dir / "schedule_output_tmp.json"

        storage.save_tasks(active_tasks, tmp_tasks_path)
        storage.save_fixed_events(merged_fixed_events, tmp_fixed_events_path)

        try:
            # 5. Run the scheduler with the temporary files
            self.last_run_result = cpp_bridge.run_scheduler(
                self.project_root,
                tasks_path=tmp_tasks_path,
                availability_path=self.availability_path,
                fixed_events_path=tmp_fixed_events_path,
                output_path=tmp_output_path,
            )

            if not self.last_run_result.success:
                message = self.last_run_result.message or "Unknown scheduler error"
                raise SchedulerExecutionError(message)

            # 6. Load temporary output and merge fixed tasks back into the schedule
            tmp_output = storage.load_schedule_output(tmp_output_path)

            schedule = tmp_output.get("schedule", [])
            for ft in fixed_tasks:
                schedule.append({
                    "task_id": ft["id"],
                    "task_name": ft["name"],
                    "start": ft["fixed_start"],
                    "end": ft["fixed_end"],
                    "priority": ft.get("priority", 0),
                    "deadline": ft.get("deadline", "")
                })

            # Sort schedule chronologically by start time
            schedule.sort(key=lambda s: s.get("start", ""))
            tmp_output["schedule"] = schedule

            # Update statistics
            stats = tmp_output.get("statistics", {})
            stats["total_tasks"] = len(tasks)
            stats["scheduled_tasks"] = len(schedule)
            stats["unscheduled_tasks"] = len(tmp_output.get("unscheduled_tasks", []))
            tmp_output["statistics"] = stats

            # Save the final merged schedule to the final output path
            storage._save_json(self.schedule_output_path, tmp_output)

        finally:
            # 7. Clean up temporary files
            try:
                tmp_tasks_path.unlink(missing_ok=True)
                tmp_fixed_events_path.unlink(missing_ok=True)
                tmp_output_path.unlink(missing_ok=True)
            except OSError:
                pass

        return self.load_schedule_output()

    def export_schedule(
        self, report_format: str, destination: str | Path
    ) -> Path:
        schedule_output = self.load_schedule_output()
        exporters = {
            "txt": reports.export_schedule_txt,
            "csv": reports.export_schedule_csv,
            "json": reports.export_schedule_json,
        }
        try:
            exporter = exporters[report_format.lower()]
        except KeyError as exc:
            raise ValueError("Report format must be txt, csv, or json") from exc
        return exporter(schedule_output, destination)
