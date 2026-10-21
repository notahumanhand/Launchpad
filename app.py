import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests
from flask import Flask, jsonify, render_template

app = Flask(__name__)

# These URLs are intentionally fixed server-side. Do not accept arbitrary target
# URLs from browser requests; that could turn the launcher into an SSRF proxy.
APPLICATIONS = [
    {
        "id": "caseflow",
        "name": "CaseFlow",
        "tagline": "Immigration workflow automation demonstration",
        "description": (
            "A document-heavy case review proof of concept that extracts "
            "information from synthetic records, compares findings, and flags "
            "potential discrepancies for human review."
        ),
        "url": os.getenv("CASEFLOW_URL", "https://konaredemo.onrender.com").rstrip("/"),
        # This endpoint returns the demo's document list without calling Gemini.
        # It also works with the uploaded project version, which has no /health route.
        "health_path": "/api/cases/MG-2026-001/documents",
        "stack": "Python · FastAPI · HTML/CSS/JavaScript · Google Gemini · python-docx",
        "accent": "#2463a6",
    },
    {
        "id": "commonthread",
        "name": "Commonthread",
        "tagline": "University advancement analytics",
        "description": (
            "An interactive dashboard for exploring synthetic fundraising "
            "activity, donor behavior, campaign timing, and gift-level records."
        ),
        "url": os.getenv("COMMONTHREAD_URL", "https://commonthread-xrub.onrender.com").rstrip("/"),
        "health_path": "/health",
        "stack": "Python · Flask · SQLite · HTML/CSS/JavaScript",
        "accent": "#287d69",
    },
    {
        "id": "verifhir",
        "name": "VeriFHIR",
        "tagline": "FHIR source validation proof of concept",
        "description": (
            "A Streamlit tool that compares FHIR R4 observations with evidence "
            "in synthetic EHR screenshots using Azure AI Vision OCR."
        ),
        "url": os.getenv("VERIFHIR_URL", "https://verifhir-s05f.onrender.com").rstrip("/"),
        "health_path": "/_stcore/health",
        "stack": "Python · Streamlit · FHIR R4 · Azure AI Vision · pandas · Pillow",
        "accent": "#7653a6",
    },
]

STATUS_LOCK = threading.Lock()
STATUS = {
    item["id"]: {
        "state": "idle",
        "message": "Not checked yet",
        "checked_at": None,
        "http_status": None,
        "elapsed_ms": None,
    }
    for item in APPLICATIONS
}
WAKE_IN_PROGRESS = False
LAST_RUN_STARTED = None
EXECUTOR = ThreadPoolExecutor(max_workers=3)


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def public_application(item):
    with STATUS_LOCK:
        current = dict(STATUS[item["id"]])
    return dict(item) | {"status": current}


def check_application(item, initial=False):
    app_id = item["id"]
    target = item["url"] + item["health_path"]
    started = time.monotonic()

    # Mark as waking before making the request. Requests to sleeping Render
    # services can take a while while Render starts the instance.
    with STATUS_LOCK:
        STATUS[app_id].update({
            "state": "waking" if initial else "checking",
            "message": "Sending health check; the service may be starting.",
            "checked_at": utc_now(),
            "http_status": None,
            "elapsed_ms": None,
        })

    try:
        response = requests.get(
            target,
            timeout=(5, 18),
            allow_redirects=True,
            headers={"User-Agent": "Render-Launchpad/1.0"},
        )
        elapsed = round((time.monotonic() - started) * 1000)
        if 200 <= response.status_code < 400:
            state = "online"
            message = "Application responded successfully."
        else:
            state = "unavailable"
            message = f"Health check returned HTTP {response.status_code}."
        http_status = response.status_code
    except requests.Timeout:
        elapsed = round((time.monotonic() - started) * 1000)
        state = "waking"
        message = "Still waiting for the service. It may need more time to start."
        http_status = None
    except requests.RequestException as exc:
        elapsed = round((time.monotonic() - started) * 1000)
        state = "unavailable"
        message = f"Could not reach the service: {exc.__class__.__name__}."
        http_status = None

    with STATUS_LOCK:
        STATUS[app_id].update({
            "state": state,
            "message": message,
            "checked_at": utc_now(),
            "http_status": http_status,
            "elapsed_ms": elapsed,
        })
    return state


def wake_and_monitor(item):
    """Trigger a request, then retry until ready or the bounded check window ends."""
    deadline = time.monotonic() + 150
    while True:
        state = check_application(item, initial=True)
        if state == "online":
            return
        if time.monotonic() >= deadline:
            with STATUS_LOCK:
                if STATUS[item["id"]]["state"] != "online":
                    STATUS[item["id"]].update({
                        "state": "unavailable",
                        "message": "The service did not become ready within 150 seconds. You can retry or open it directly.",
                        "checked_at": utc_now(),
                    })
            return
        # Back off gently between checks. A request to a sleeping service is
        # itself the wake-up trigger; the next check verifies readiness.
        time.sleep(5)


def run_wake_cycle():
    global WAKE_IN_PROGRESS
    try:
        # Each target is checked independently so one slow service does not
        # prevent the other two from starting.
        with ThreadPoolExecutor(max_workers=3) as pool:
            futures = [pool.submit(wake_and_monitor, item) for item in APPLICATIONS]
            for future in futures:
                future.result()
    finally:
        with STATUS_LOCK:
            WAKE_IN_PROGRESS = False


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/status")
def api_status():
    with STATUS_LOCK:
        in_progress = WAKE_IN_PROGRESS
        last_started = LAST_RUN_STARTED
    return jsonify({
        "wake_in_progress": in_progress,
        "last_run_started": last_started,
        "applications": [public_application(item) for item in APPLICATIONS],
    })


@app.post("/api/wake")
def api_wake():
    global WAKE_IN_PROGRESS, LAST_RUN_STARTED
    with STATUS_LOCK:
        if WAKE_IN_PROGRESS:
            return jsonify({"started": False, "message": "A wake-up check is already running."})
        WAKE_IN_PROGRESS = True
        LAST_RUN_STARTED = utc_now()
        for item in APPLICATIONS:
            STATUS[item["id"]].update({
                "state": "waking",
                "message": "Wake-up request queued.",
                "checked_at": utc_now(),
                "http_status": None,
                "elapsed_ms": None,
            })
    threading.Thread(target=run_wake_cycle, daemon=True).start()
    return jsonify({"started": True, "message": "Wake-up checks started."}), 202


@app.post("/api/retry/<app_id>")
def api_retry(app_id):
    global WAKE_IN_PROGRESS, LAST_RUN_STARTED
    item = next((app_item for app_item in APPLICATIONS if app_item["id"] == app_id), None)
    if item is None:
        return jsonify({"error": "Unknown application."}), 404
    # Retry just one target in the background.
    def retry_one():
        global WAKE_IN_PROGRESS
        try:
            wake_and_monitor(item)
        finally:
            with STATUS_LOCK:
                WAKE_IN_PROGRESS = any(
                    status["state"] in {"waking", "checking"}
                    for status in STATUS.values()
                )
    with STATUS_LOCK:
        STATUS[app_id].update({"state": "waking", "message": "Retrying health check."})
        WAKE_IN_PROGRESS = True
        LAST_RUN_STARTED = utc_now()
    threading.Thread(target=retry_one, daemon=True).start()
    return jsonify({"started": True}), 202


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", "10000")))
