#!/usr/bin/env python3
"""Sanitized read-only Hermes presence and cron adapter for Campus.

The browser receives only allowlisted profile handles, coarse activity metadata,
and safe cron fields. Prompts, messages, paths, secrets, tool arguments, and
error bodies never cross this boundary.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
HERMES_HOME = Path(os.environ.get("CAMPUS_HERMES_HOME", Path.home() / ".hermes")).expanduser()
SHARED_PROFILES = ("default", "general-assistant")
ACTIVE_WINDOW_SECONDS = 90
DISPLAY_NAMES = {
    "default": "Sancho",
    "chief-of-staff": "Chief of Staff",
    "scout-robinson": "Scout Robinson",
    "demo": "Demo",
    "closer": "Closer",
    "general-assistant": "General Assistant",
}
OVERLAY_WORKING_SECONDS = 180
OVERLAY_MAX_AGE_SECONDS = 24 * 3600
OVERLAY_FUTURE_SKEW_SECONDS = 30
SENSITIVE_TEXT = re.compile(
    r"(?:api[_-]?(?:key|token)|secret|password|passwd|authorization|bearer)\s*[:=]"
    r"|private[_ -]?key|seed phrase|recovery phrase|wallet address|patient name|client name"
    r"|medical record|diagnos(?:is|es)",
    re.IGNORECASE,
)
EMAIL_TEXT = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
PHONE_TEXT = re.compile(r"(?<!\d)(?:\+?1[ .-]?)?(?:\(?\d{3}\)?[ .-]?)\d{3}[ .-]?\d{4}(?!\d)")
WALLET_TEXT = re.compile(r"\b0x[a-fA-F0-9]{40}\b")
ROOM_HINTS = (
    ("folio-work-kits", ("digital-product-factory", "folio-work-kits", "folio work kits")),
    ("wanderpick", ("wanderpick",)),
    ("midas", ("/midas", "\\midas")),
    ("tsh", ("/tsh", "\\tsh", "time strong", "mobilecommandcenter")),
    ("agent-staff", ("agent-staff", "agent staff")),
)


def profile_home(profile: str) -> Path:
    return HERMES_HOME if profile == "default" else HERMES_HOME / "profiles" / profile


def load_room(room_id: str) -> dict[str, Any]:
    path = ROOT / "rooms" / f"{room_id}.json"
    if not path.is_file():
        raise ValueError(f"Unknown room: {room_id}")
    return json.loads(path.read_text(encoding="utf-8"))


def safe_text(value: Any, limit: int = 96, fallback: str = "Private detail hidden") -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    has_private_path = bool(
        re.search(r"(?:[A-Za-z]:\\|/)(?:[^\s/\\]+[/\\]){2,}[^\s]*", text)
        or re.search(r"(?:^|\s)~[/\\]", text)
        or "/.hermes/" in text
    )
    if has_private_path or SENSITIVE_TEXT.search(text) or EMAIL_TEXT.search(text) or PHONE_TEXT.search(text) or WALLET_TEXT.search(text):
        return fallback[:limit]
    return text[:limit]


def coarse_activity(value: Any) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    if not text:
        return ""
    tool = re.fullmatch(r"(?:executing tool|tool running):\s*([A-Za-z0-9_.:-]{1,48})", text, re.IGNORECASE)
    if tool:
        return f"Tool running: {tool.group(1)}"
    if re.fullmatch(r"starting API call(?: #\d+)?", text, re.IGNORECASE):
        return "Model request in progress"
    if re.fullmatch(r"receiving stream response", text, re.IGNORECASE):
        return "Receiving model response"
    if re.fullmatch(r"(?:compacting conversation|waiting for user clarify response)", text, re.IGNORECASE):
        return "Session maintenance in progress"
    return "Active now"


def job_reference(profile: str, job_id: Any) -> str:
    return hashlib.sha256(f"{profile}:{job_id or 'unknown'}".encode("utf-8")).hexdigest()[:8]


def public_job_name(profile: str, reference: str) -> str:
    owner = DISPLAY_NAMES.get(profile, profile.replace("-", " ").title())
    return f"Scheduled {owner} job {reference}"


def public_schedule(job: dict[str, Any]) -> str:
    schedule = job.get("schedule")
    if not isinstance(schedule, dict):
        return "Scheduled"
    kind = schedule.get("kind")
    if kind == "cron":
        expression = str(schedule.get("expr") or "").strip()
        if expression and re.fullmatch(r"[0-9*?,/\-\s]+", expression):
            return expression[:72]
        return "Recurring schedule"
    if kind == "interval":
        try:
            minutes = max(1, int(schedule.get("minutes")))
        except (TypeError, ValueError):
            return "Recurring schedule"
        return f"Every {minutes} minutes"
    if kind == "once":
        return "One-time schedule"
    return "Scheduled"


def repeat_is_completed(value: Any) -> bool:
    if not isinstance(value, dict) or value.get("times") is None:
        return False
    try:
        times = max(0, int(value["times"]))
        completed = max(0, int(value.get("completed", 0)))
    except (TypeError, ValueError):
        return False
    return completed >= times


def age_label(timestamp: Any) -> str:
    try:
        age = max(0, int(time.time() - float(timestamp)))
    except (TypeError, ValueError):
        return "No prior activity"
    if age < 60:
        return "Active moments ago"
    if age < 3600:
        return f"Last active {age // 60}m ago"
    if age < 86400:
        return f"Last active {age // 3600}h ago"
    return f"Last active {age // 86400}d ago"


def connect_readonly(path: Path):
    return sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=0.25)


def token_usage(row: Any = None) -> dict[str, int]:
    def count(key: str) -> int:
        if row is None:
            return 0
        try:
            return max(0, int(row[key] or 0))
        except (KeyError, TypeError, ValueError, IndexError):
            return 0

    usage = {
        "input": count("input_tokens"),
        "output": count("output_tokens"),
        "cache_read": count("cache_read_tokens"),
        "cache_write": count("cache_write_tokens"),
    }
    usage["burn"] = sum(usage.values())
    return usage


def session_snapshot(profile: str) -> dict[str, Any]:
    path = profile_home(profile) / "state.db"
    result = {
        "state": "idle",
        "model": "Local profile",
        "usage": "No live activity",
        "current_work": None,
        "last_work": "No prior activity",
        "token_usage": token_usage(),
        "location_text": "",
        "session_id": "",
    }
    if not path.is_file():
        result["state"] = "away"
        result["usage"] = "Profile unavailable"
        return result

    try:
        db = connect_readonly(path)
        db.row_factory = sqlite3.Row
        now = time.time()
        lease = db.execute(
            "SELECT conversation_id FROM session_turn_leases WHERE expires_at > ? ORDER BY expires_at DESC LIMIT 1",
            (now,),
        ).fetchone()
        if lease:
            row = db.execute(
                "SELECT id, model, ended_at, end_reason, last_activity_at, "
                "last_activity_description, cwd, git_repo_root, input_tokens, "
                "output_tokens, cache_read_tokens, cache_write_tokens "
                "FROM sessions WHERE id = ? LIMIT 1",
                (lease["conversation_id"],),
            ).fetchone()
        else:
            row = db.execute(
                "SELECT id, model, ended_at, end_reason, last_activity_at, "
                "last_activity_description, cwd, git_repo_root, input_tokens, "
                "output_tokens, cache_read_tokens, cache_write_tokens "
                "FROM sessions ORDER BY COALESCE(last_activity_at, started_at) DESC LIMIT 1"
            ).fetchone()
        db.close()
    except (sqlite3.Error, OSError):
        result["state"] = "away"
        result["usage"] = "Live state unavailable"
        return result

    if not row:
        return result

    last_at = row["last_activity_at"]
    raw_activity = row["last_activity_description"]
    activity = coarse_activity(raw_activity)
    fresh_activity = bool(
        row["ended_at"] is None
        and activity
        and last_at is not None
        and now - float(last_at) < ACTIVE_WINDOW_SECONDS
    )
    is_working = bool(lease) or fresh_activity
    recent_failure = bool(
        row["ended_at"]
        and row["end_reason"]
        and any(token in str(row["end_reason"]).lower() for token in ("error", "fail", "crash"))
        and last_at is not None
        and now - float(last_at) < 300
    )
    result.update(
        state="working" if is_working else "error" if recent_failure else "idle",
        model=safe_text(row["model"], 64) or "Local profile",
        usage="Live now" if is_working else "Connected · idle",
        current_work=activity if is_working else None,
        last_work=age_label(last_at),
        token_usage=token_usage(row),
        # Internal-only routing hint; agent_payload deliberately never emits it.
        location_text=" ".join(filter(None, (str(row["cwd"] or ""), str(row["git_repo_root"] or "")))),
        session_id=safe_text(row["id"], 80),
    )
    return result


def load_job_records(profile: str) -> list[dict[str, Any]]:
    path = profile_home(profile) / "cron" / "jobs.json"
    if not path.is_file():
        return []
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        jobs = raw.get("jobs", []) if isinstance(raw, dict) else raw
    except (OSError, json.JSONDecodeError):
        return []
    return [job for job in jobs if isinstance(job, dict)] if isinstance(jobs, list) else []


def read_jobs(profile: str) -> list[dict[str, Any]]:
    safe_jobs = []
    for job in load_job_records(profile):
        completed = repeat_is_completed(job.get("repeat"))
        enabled = bool(job.get("enabled"))
        status = "completed" if completed else "active" if enabled else "paused"
        last_status_raw = str(job.get("last_status") or "never").lower()
        last_status = last_status_raw if last_status_raw in {"ok", "error", "blocked", "skipped", "never"} else "unknown"
        last_at = job.get("last_run_at")
        next_at = job.get("next_run_at")
        raw_job_id = str(job.get("id") or "")
        reference = job_reference(profile, raw_job_id)
        safe_jobs.append(
            {
                "id": reference,
                "name": public_job_name(profile, reference),
                "owner": profile,
                "schedule": public_schedule(job),
                "last_run": f"{last_status} · {format_time(last_at)}" if last_at else last_status,
                "next_run": format_time(next_at) if next_at else "None",
                "enabled": enabled,
                "status": status,
            }
        )
    return safe_jobs


def format_time(value: Any) -> str:
    if not value:
        return "None"
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed.astimezone().strftime("%b %-d, %-I:%M %p %Z")
    except (ValueError, TypeError, OSError):
        return "Unknown"



def overlay_path() -> Path:
    return Path(os.environ.get("CAMPUS_GROK_PRESENCE", ROOT / "tmp" / "grok-staff-presence.json")).expanduser()


def load_grok_overlay() -> tuple[dict[str, dict[str, Any]], float | None]:
    path = overlay_path()
    if not path.is_file():
        return {}, None
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}, None
    if not isinstance(raw, dict):
        return {}, None
    generated_at = raw.get("generated_at")
    if not generated_at:
        return {}, None
    try:
        parsed = datetime.fromisoformat(str(generated_at).replace("Z", "+00:00"))
        delta = time.time() - parsed.timestamp()
    except (ValueError, TypeError, OSError):
        return {}, None
    if delta < -OVERLAY_FUTURE_SKEW_SECONDS:
        return {}, None
    age = max(0.0, delta)
    agents: dict[str, dict[str, Any]] = {}
    for item in raw.get("agents") or []:
        if not isinstance(item, dict):
            continue
        handle = safe_text(item.get("handle"), 48)
        if handle:
            agents[handle] = item
    return agents, age


def overlay_snapshot(item: dict[str, Any], age: float | None) -> dict[str, Any]:
    state = str(item.get("state") or "away")
    if state not in ("working", "idle", "away", "error"):
        state = "away"
    if age is None:
        state = "away"
    elif age > OVERLAY_MAX_AGE_SECONDS:
        state = "away"
    elif state == "working" and age > OVERLAY_WORKING_SECONDS:
        state = "idle"
    last_work = "Active moments ago" if age is not None and age < 60 else "Recent overlay activity" if age is not None and age < 86400 else "No recent activity"
    return {
        "state": state,
        "model": "Grok Bot",
        "usage": "Live now" if state == "working" else "Connected · idle" if state == "idle" else "No live activity",
        "current_work": "Coordinating Agent Staff" if state == "working" else None,
        "last_work": last_work,
        "token_usage": token_usage(),
        "location_text": "",
        "session_id": "",
    }


def merge_presence(hermes: dict[str, Any], overlay_item: dict[str, Any] | None, age: float | None) -> dict[str, Any]:
    if not overlay_item:
        return hermes
    overlay = overlay_snapshot(overlay_item, age)
    if hermes.get("state") == "away" or overlay["state"] == "working":
        return overlay
    return hermes


def cron_room_index() -> dict[str, str]:
    index: dict[str, str] = {}
    for room_id in ("home", "tsh", "folio-work-kits", "midas", "wanderpick", "agent-staff"):
        room = load_room(room_id)
        for owner in room["jobs_wall"]["job_scope"]:
            for job in load_job_records(owner):
                job_id = str(job.get("id") or "")
                if job_id:
                    index[job_id] = room_id
    return index


def infer_room(snapshot: dict[str, Any], job_rooms: dict[str, str]) -> str:
    session_id = snapshot.get("session_id", "")
    if session_id.startswith("cron_"):
        for job_id in sorted(job_rooms, key=len, reverse=True):
            if session_id.startswith(f"cron_{job_id}_"):
                return job_rooms[job_id]
    text = snapshot.get("location_text", "").lower()
    for room_id, hints in ROOM_HINTS:
        if any(hint in text for hint in hints):
            return room_id
    return "home"


def station_for_shared(room: dict[str, Any], handle: str) -> str:
    preferred = "builder" if handle == "general-assistant" else "reviewer"
    ids = {station["id"] for station in room["stations"]}
    if preferred in ids:
        return preferred
    return room["stations"][0]["id"]


def agent_payload(base: dict[str, Any], snapshot: dict[str, Any], *, dynamic=False) -> dict[str, Any]:
    handle = base["handle"]
    return {
        "handle": handle,
        "display_name": DISPLAY_NAMES.get(handle, handle),
        "role": "Shared project support" if dynamic else base["role"],
        "station": base["station"],
        "state": snapshot["state"],
        "team_member": False if dynamic else base["team_member"],
        "model": snapshot["model"],
        "usage": snapshot["usage"],
        "current_work": snapshot["current_work"],
        "last_work": snapshot["last_work"],
        "token_usage": snapshot["token_usage"],
        "scale": base.get("scale", 1),
        "variant": base.get("variant", 0),
    }


def collect(room_id: str) -> dict[str, Any]:
    room = load_room(room_id)
    job_rooms = cron_room_index()
    snapshots: dict[str, dict[str, Any]] = {}

    def snapshot(profile: str):
        if profile not in snapshots:
            snapshots[profile] = session_snapshot(profile)
        return snapshots[profile]

    overlay_agents, overlay_age = load_grok_overlay()
    agents = []
    base_handles = {agent["handle"] for agent in room["agents"]}
    for base in room["agents"]:
        handle = base["handle"]
        state = merge_presence(snapshot(handle), overlay_agents.get(handle), overlay_age)
        if handle in SHARED_PROFILES and infer_room(state, job_rooms) != room_id:
            continue
        agents.append(agent_payload(base, state))

    for handle in SHARED_PROFILES:
        state = snapshot(handle)
        if handle not in base_handles and infer_room(state, job_rooms) == room_id and state["state"] == "working":
            agents.append(
                agent_payload(
                    {
                        "handle": handle,
                        "role": "Shared project support",
                        "station": station_for_shared(room, handle),
                        "team_member": False,
                        "scale": 0.98,
                        "variant": 7 if handle == "default" else 6,
                    },
                    state,
                    dynamic=True,
                )
            )

    jobs = []
    for owner in room["jobs_wall"]["job_scope"]:
        jobs.extend(read_jobs(owner))

    room_usage = {
        key: sum(agent["token_usage"][key] for agent in agents)
        for key in ("input", "output", "cache_read", "cache_write", "burn")
    }

    return {
        "schema_version": "1.0.0",
        "room_id": room_id,
        "generated_at": datetime.now().astimezone().isoformat(),
        "connected": True,
        "token_usage": room_usage,
        "agents": agents,
        "jobs": jobs,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--room", required=True)
    args = parser.parse_args()
    try:
        payload = collect(args.room)
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        raise SystemExit(str(exc))
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))


if __name__ == "__main__":
    main()
