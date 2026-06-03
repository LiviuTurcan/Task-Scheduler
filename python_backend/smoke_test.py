"""Run the Phase 6 backend without a UI."""

from __future__ import annotations

import json
from tempfile import TemporaryDirectory

from .app_controller import AppController


def main() -> int:
    controller = AppController()
    schedule_output = controller.generate_schedule()
    statistics = schedule_output["statistics"]

    if controller.last_run_result is None or not controller.last_run_result.success:
        raise AssertionError("Python did not run the C++ scheduler successfully")
    if statistics["total_tasks"] != 5:
        raise AssertionError("Expected the five sample tasks")
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
