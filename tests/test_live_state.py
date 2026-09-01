import json
import os
import sqlite3
import subprocess
import tempfile
import time
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "live_state.py"


def make_profile(
    home: Path,
    profile: str,
    *,
    active=False,
    title="",
    cwd=None,
    activity="",
    input_tokens=0,
    output_tokens=0,
    cache_read_tokens=0,
    cache_write_tokens=0,
    session_id=None,
):
    profile_home = home if profile == "default" else home / "profiles" / profile
    profile_home.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(profile_home / "state.db")
    db.executescript(
        """
        CREATE TABLE sessions (
          id TEXT PRIMARY KEY, source TEXT NOT NULL, title TEXT, model TEXT,
          started_at REAL NOT NULL, ended_at REAL, end_reason TEXT,
          cwd TEXT, git_repo_root TEXT, last_activity_at REAL,
          last_activity_description TEXT, input_tokens INTEGER DEFAULT 0,
          output_tokens INTEGER DEFAULT 0, cache_read_tokens INTEGER DEFAULT 0,
          cache_write_tokens INTEGER DEFAULT 0, reasoning_tokens INTEGER DEFAULT 0
        );
        CREATE TABLE session_turn_leases (
          conversation_id TEXT PRIMARY KEY, holder TEXT NOT NULL,
          acquired_at REAL NOT NULL, expires_at REAL NOT NULL
        );
        """
    )
    now = time.time()
    session_id = session_id or f"{profile}-session"
    db.execute(
        "INSERT INTO sessions VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            session_id, "desktop", title, f"model/{profile}",
            now - 30, None, None, cwd, cwd, now - 2, activity,
            input_tokens, output_tokens, cache_read_tokens,
            cache_write_tokens, 0,
        ),
    )
    if active:
        db.execute(
            "INSERT INTO session_turn_leases VALUES (?,?,?,?)",
            (session_id, "test", now - 2, now + 300),
        )
    db.commit()
    db.close()
    return profile_home


def write_jobs(profile_home: Path, jobs):
    cron = profile_home / "cron"
    cron.mkdir(parents=True, exist_ok=True)
    (cron / "jobs.json").write_text(json.dumps({"jobs": jobs}))


class LiveStateTests(unittest.TestCase):
    def run_adapter(self, home: Path, room: str, extra_env=None):
        env = {**os.environ, "CAMPUS_HERMES_HOME": str(home)}
        if extra_env:
            env.update(extra_env)
        result = subprocess.run(
            ["python3", str(SCRIPT), "--room", room],
            cwd=ROOT,
            env=env,
            text=True,
            capture_output=True,
            check=True,
        )
        return json.loads(result.stdout)

    def test_home_contains_sancho_and_general_assistant_and_all_real_jobs(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            default_home = make_profile(home, "default", active=False)
            ga_home = make_profile(home, "general-assistant", active=True, activity="receiving stream response")
            write_jobs(default_home, [
                {"id": "a", "name": "default-active", "schedule": {"display": "0 3 * * *"}, "enabled": True, "last_status": "ok", "next_run_at": "2026-09-01T03:00:00-04:00"},
                {"id": "b", "name": "default-paused", "schedule": {"display": "0 4 * * *"}, "enabled": False, "last_status": "error", "next_run_at": None},
            ])
            write_jobs(ga_home, [
                {"id": "c", "name": "ga-monitor", "schedule": {"display": "0 9 * * 1,4"}, "enabled": True, "last_status": "ok", "next_run_at": "2026-09-03T09:00:00-04:00"},
            ])

            state = self.run_adapter(home, "home")
            self.assertEqual([a["handle"] for a in state["agents"]], ["default", "general-assistant"])
            self.assertEqual(state["agents"][0]["display_name"], "Sancho")
            self.assertEqual(state["agents"][0]["state"], "idle")
            self.assertEqual(state["agents"][1]["state"], "working")
            self.assertEqual(len(state["jobs"]), 3)
            self.assertTrue(all(job["name"].startswith("Scheduled ") for job in state["jobs"]))
            serialized_names = json.dumps([job["name"] for job in state["jobs"]])
            self.assertNotIn("default-active", serialized_names)
            self.assertNotIn("default-paused", serialized_names)
            self.assertNotIn("ga-monitor", serialized_names)
            self.assertEqual([j["owner"] for j in state["jobs"]], ["default", "default", "general-assistant"])

    def test_malformed_repeat_metadata_cannot_take_down_room_state(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            default_home = make_profile(home, "default", active=False)
            write_jobs(default_home, [
                {"id": "bad-shape", "name": "hidden", "repeat": "not-a-dict", "enabled": True},
                {"id": "numeric-strings", "name": "hidden", "repeat": {"times": "1", "completed": 1}, "enabled": False},
                {"id": "mixed-values", "name": "hidden", "repeat": {"times": "nope", "completed": {}}, "enabled": False},
            ])

            state = self.run_adapter(home, "home")
            self.assertTrue(state["connected"])
            self.assertEqual([job["status"] for job in state["jobs"]], ["active", "completed", "paused"])
            self.assertNotIn("not-a-dict", json.dumps(state))
            self.assertNotIn("numeric-strings", json.dumps(state))

    def test_shared_assistant_moves_to_active_project_and_is_not_duplicated_at_home(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            make_profile(home, "default", active=False)
            make_profile(
                home,
                "general-assistant",
                active=True,
                cwd="/Users/example/projects/wanderpick",
                activity="executing tool: terminal",
            )

            home_state = self.run_adapter(home, "home")
            wanderpick_state = self.run_adapter(home, "wanderpick")
            self.assertNotIn("general-assistant", [a["handle"] for a in home_state["agents"]])
            moved = next(a for a in wanderpick_state["agents"] if a["handle"] == "general-assistant")
            self.assertEqual(moved["state"], "working")
            self.assertEqual(moved["role"], "Shared project support")

    def test_activity_text_is_coarsened_before_it_reaches_the_browser(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            make_profile(
                home,
                "wanderpick",
                active=True,
                activity="tool running: browser password=hunter2 patient name=Example Person",
            )

            state = self.run_adapter(home, "wanderpick")
            agent = state["agents"][0]
            self.assertEqual(agent["current_work"], "Active now")
            serialized = json.dumps(state).lower()
            self.assertNotIn("hunter2", serialized)
            self.assertNotIn("password", serialized)
            self.assertNotIn("patient name", serialized)

    def test_cron_job_ids_with_underscores_route_shared_helpers(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            tsh_home = make_profile(home, "tsh", active=False)
            write_jobs(tsh_home, [
                {
                    "id": "tsh_daily_digest",
                    "name": "private source name",
                    "schedule": {"kind": "cron", "expr": "0 9 * * *"},
                    "enabled": True,
                }
            ])
            make_profile(
                home,
                "general-assistant",
                active=True,
                activity="executing tool: terminal",
                session_id="cron_tsh_daily_digest_20260901_090000",
            )

            home_state = self.run_adapter(home, "home")
            tsh_state = self.run_adapter(home, "tsh")
            self.assertNotIn("general-assistant", [a["handle"] for a in home_state["agents"]])
            self.assertIn("general-assistant", [a["handle"] for a in tsh_state["agents"]])
            self.assertNotIn("private source name", json.dumps(tsh_state))
            self.assertNotIn("tsh_daily_digest", json.dumps(tsh_state))

    def test_adapter_only_returns_allowlisted_real_room_agents(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            make_profile(home, "wanderpick", active=False)
            make_profile(home, "place-curator", active=True, activity="should never leak")

            state = self.run_adapter(home, "wanderpick")
            self.assertEqual([a["handle"] for a in state["agents"]], ["wanderpick"])
            serialized = json.dumps(state)
            self.assertNotIn("place-curator", serialized)
            self.assertNotIn("trip-reviewer", serialized)

    def test_stale_unended_session_is_idle_but_fresh_activity_is_working(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            profile_home = make_profile(home, "wanderpick", active=False, activity="")
            state = self.run_adapter(home, "wanderpick")
            self.assertEqual(state["agents"][0]["state"], "idle")

            db = sqlite3.connect(profile_home / "state.db")
            db.execute("UPDATE sessions SET last_activity_at=?, last_activity_description=?", (time.time(), "tool running: browser"))
            db.commit()
            db.close()
            state = self.run_adapter(home, "wanderpick")
            self.assertEqual(state["agents"][0]["state"], "working")

    def test_agent_and_room_expose_live_token_usage_and_burn(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            make_profile(
                home,
                "wanderpick",
                active=True,
                activity="tool running: browser",
                input_tokens=1200,
                output_tokens=300,
                cache_read_tokens=4000,
                cache_write_tokens=500,
            )

            state = self.run_adapter(home, "wanderpick")
            expected = {
                "input": 1200,
                "output": 300,
                "cache_read": 4000,
                "cache_write": 500,
                "burn": 6000,
            }
            self.assertEqual(state["agents"][0]["token_usage"], expected)
            self.assertEqual(state["token_usage"], expected)


    def test_grok_overlay_without_verifiable_timestamp_fails_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            overlay = Path(tmp) / "grok-staff-presence.json"
            agent = {
                "handle": "chief-of-staff",
                "state": "working",
                "current_work": "private outreach target",
            }
            for generated_at in (None, "not-a-timestamp", "2999-01-01T00:00:00+00:00"):
                payload = {"schema_version": "1.0.0", "agents": [agent]}
                if generated_at is not None:
                    payload["generated_at"] = generated_at
                overlay.write_text(json.dumps(payload))
                state = self.run_adapter(home, "agent-staff", {"CAMPUS_GROK_PRESENCE": str(overlay)})
                chief = next(item for item in state["agents"] if item["handle"] == "chief-of-staff")
                self.assertEqual(chief["state"], "away")
                self.assertNotIn("private outreach target", json.dumps(state))

    def test_grok_overlay_fills_agent_staff_and_drops_unknown_handles(self):
        with tempfile.TemporaryDirectory() as tmp:
            home = Path(tmp)
            overlay = Path(tmp) / "grok-staff-presence.json"
            overlay.write_text(json.dumps({
                "schema_version": "1.0.0",
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "agents": [
                    {
                        "handle": "chief-of-staff",
                        "state": "working",
                        "current_work": "Coordinating staff",
                        "last_work": "Active moments ago",
                        "usage": "Live now",
                        "model": "Grok Bot",
                    },
                    {
                        "handle": "secret-bot",
                        "state": "working",
                        "current_work": "should never leak",
                    },
                ],
            }))
            state = self.run_adapter(home, "agent-staff", {"CAMPUS_GROK_PRESENCE": str(overlay)})
            handles = [agent["handle"] for agent in state["agents"]]
            self.assertIn("chief-of-staff", handles)
            self.assertNotIn("secret-bot", handles)
            self.assertNotIn("outreach-bot", handles)
            chief = next(agent for agent in state["agents"] if agent["handle"] == "chief-of-staff")
            self.assertEqual(chief["state"], "working")
            self.assertEqual(chief["display_name"], "Chief of Staff")
            serialized = json.dumps(state)
            self.assertNotIn("secret-bot", serialized)
            self.assertNotIn("should never leak", serialized)


if __name__ == "__main__":
    unittest.main()
