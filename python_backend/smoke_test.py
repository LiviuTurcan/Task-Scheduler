"""Run the Phase 6 backend without a UI."""

from __future__ import annotations

import json
from pathlib import Path
from tempfile import TemporaryDirectory

from .app_controller import AppController


def main() -> int:
    controller = AppController()

    with TemporaryDirectory(prefix="task_scheduler_smoke_") as temp_dir:
        temp_path = Path(temp_dir)
        
        # Define 5 sample tasks
        sample_tasks = [
            {
                "id": 1,
                "name": "Design Database Schema",
                "duration_minutes": 120,
                "deadline": "2026-06-03T18:00:00",
                "priority": 5,
                "difficulty": 3,
                "dependencies": [],
                "can_split": False,
                "fixed": False,
                "fixed_start": None,
                "fixed_end": None
            },
            {
                "id": 2,
                "name": "Implement API Endpoints",
                "duration_minutes": 180,
                "deadline": "2026-06-04T18:00:00",
                "priority": 4,
                "difficulty": 4,
                "dependencies": [1],
                "can_split": False,
                "fixed": False,
                "fixed_start": None,
                "fixed_end": None
            },
            {
                "id": 3,
                "name": "Write Frontend Components",
                "duration_minutes": 240,
                "deadline": "2026-06-05T18:00:00",
                "priority": 3,
                "difficulty": 3,
                "dependencies": [2],
                "can_split": True,
                "fixed": False,
                "fixed_start": None,
                "fixed_end": None
            },
            {
                "id": 4,
                "name": "Setup CI/CD Pipeline",
                "duration_minutes": 90,
                "deadline": "2026-06-06T18:00:00",
                "priority": 2,
                "difficulty": 2,
                "dependencies": [],
                "can_split": False,
                "fixed": False,
                "fixed_start": None,
                "fixed_end": None
            },
            {
                "id": 5,
                "name": "Write Integration Tests",
                "duration_minutes": 150,
                "deadline": "2026-06-07T18:00:00",
                "priority": 4,
                "difficulty": 3,
                "dependencies": [2],
                "can_split": False,
                "fixed": False,
                "fixed_start": None,
                "fixed_end": None
            }
        ]
        
        # Define availability (covering June 3rd to June 7th, 9:00 to 18:00 daily)
        sample_availability = [
            {"start": f"2026-06-0{d}T09:00:00", "end": f"2026-06-0{d}T18:00:00"}
            for d in range(3, 8)
        ]
        
        # Define fixed events (none to ensure zero conflicts)
        sample_fixed_events = []
        
        # Write to temporary paths
        tasks_file = temp_path / "tasks.json"
        availability_file = temp_path / "availability.json"
        fixed_events_file = temp_path / "fixed_events.json"
        output_file = temp_path / "schedule_output.json"
        
        with tasks_file.open("w", encoding="utf-8") as f:
            json.dump(sample_tasks, f, indent=2)
        with availability_file.open("w", encoding="utf-8") as f:
            json.dump(sample_availability, f, indent=2)
        with fixed_events_file.open("w", encoding="utf-8") as f:
            json.dump(sample_fixed_events, f, indent=2)
        with output_file.open("w", encoding="utf-8") as f:
            json.dump({"schedule": [], "unscheduled_tasks": [], "statistics": {"total_tasks": 0, "scheduled_tasks": 0, "unscheduled_tasks": 0, "conflicts": 0, "deadline_violations": 0, "score": 0}}, f, indent=2)
            
        # Re-route the controller to use our temporary files
        controller.tasks_path = tasks_file
        controller.availability_path = availability_file
        controller.fixed_events_path = fixed_events_file
        controller.schedule_output_path = output_file
        
        schedule_output = controller.generate_schedule()
        statistics = schedule_output["statistics"]

        if controller.last_run_result is None or not controller.last_run_result.success:
            raise AssertionError("Python did not run the C++ scheduler successfully")
        if statistics["total_tasks"] != 5:
            raise AssertionError(f"Expected the five sample tasks, got {statistics['total_tasks']}")
        if statistics["conflicts"] != 0:
            raise AssertionError("Expected a schedule without conflicts")

        with TemporaryDirectory(prefix="task_scheduler_phase6_") as temporary_dir:
            txt_path = controller.export_schedule("txt", f"{temporary_dir}/schedule.txt")
            csv_path = controller.export_schedule("csv", f"{temporary_dir}/schedule.csv")
            json_path = controller.export_schedule("json", f"{temporary_dir}/schedule.json")
            if not txt_path.is_file() or not csv_path.is_file() or not json_path.is_file():
                raise AssertionError("Expected TXT, CSV, and JSON exports")
            with json_path.open("r", encoding="utf-8") as json_file:
                if json.load(json_file) != schedule_output:
                    raise AssertionError("JSON export does not match schedule output")

    print(
        "phase6 backend: passed "
        f"({statistics['scheduled_tasks']} of {statistics['total_tasks']} scheduled)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
