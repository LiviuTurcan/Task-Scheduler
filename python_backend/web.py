from __future__ import annotations

import os
import socket
import threading
import webbrowser
from flask import Flask, request, jsonify, render_template

from .app_controller import AppController, SchedulerExecutionError


app = Flask(__name__, template_folder="templates", static_folder="static")
app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 0
app.config["TEMPLATES_AUTO_RELOAD"] = True
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000
MAX_PORT = 65535
PORT_SEARCH_LIMIT = 100


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


def is_port_available(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind((host, port))
        except OSError:
            return False
    return True


def find_available_port(host: str, preferred_port: int = DEFAULT_PORT) -> int:
    last_port = min(preferred_port + PORT_SEARCH_LIMIT - 1, MAX_PORT)
    for port in range(preferred_port, last_port + 1):
        if is_port_available(host, port):
            return port

    raise RuntimeError(
        f"No available port found from {preferred_port} to {last_port}."
    )


def get_preferred_port() -> int:
    raw_port = os.environ.get("TASK_SCHEDULER_PORT")
    if not raw_port:
        return DEFAULT_PORT

    try:
        port = int(raw_port)
    except ValueError as exc:
        raise ValueError("TASK_SCHEDULER_PORT must be an integer.") from exc

    if not 1 <= port <= MAX_PORT:
        raise ValueError(f"TASK_SCHEDULER_PORT must be between 1 and {MAX_PORT}.")

    return port


def maybe_open_browser(url: str) -> None:
    if os.environ.get("TASK_SCHEDULER_OPEN_BROWSER") == "1":
        threading.Timer(1.0, webbrowser.open, args=(url,)).start()


if __name__ == "__main__":
    # Prefer localhost:5000, then use the next free port if it is busy.
    host = os.environ.get("TASK_SCHEDULER_HOST", DEFAULT_HOST)
    port = find_available_port(host, get_preferred_port())
    url = f"http://{host}:{port}/"
    print(f"Task Scheduler server is starting at {url}")
    maybe_open_browser(url)
    app.run(host=host, port=port)
