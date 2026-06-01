from __future__ import annotations

from pathlib import Path
from flask import Flask, request, jsonify, render_template

from .app_controller import AppController, SchedulerExecutionError


app = Flask(__name__, template_folder="templates")


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/run", methods=("POST",))
def run():
    payload = request.get_json(silent=True) or {}
    controller = AppController()

    # If the client provided inputs, save them before running
    try:
        if any(k in payload for k in ("tasks", "availability", "fixed_events")):
            # load current values as defaults
            current_tasks, current_availability, current_fixed = controller.load_inputs()
            tasks = payload.get("tasks", current_tasks)
            availability = payload.get("availability", current_availability)
            fixed_events = payload.get("fixed_events", current_fixed)
            controller.save_inputs(tasks, availability, fixed_events)

        schedule = controller.generate_schedule()
    except SchedulerExecutionError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    except Exception as exc:  # pragma: no cover - surface unexpected errors to the client
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify({"success": True, "schedule": schedule})


if __name__ == "__main__":
    # Run a dev server on localhost:5000
    app.run(host="127.0.0.1", port=5000)
