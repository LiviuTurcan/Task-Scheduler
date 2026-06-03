from __future__ import annotations

from pathlib import Path
from flask import Flask, request, jsonify, render_template

from .app_controller import AppController, SchedulerExecutionError


app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
app.config["TEMPLATES_AUTO_RELOAD"] = True


@app.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/inputs", methods=("GET",))
def get_inputs():
    controller = AppController()
    try:
        tasks, availability, fixed_events = controller.load_inputs()
        return jsonify({
            "success": True,
            "tasks": tasks,
            "availability": availability,
            "fixed_events": fixed_events
        })
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


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
