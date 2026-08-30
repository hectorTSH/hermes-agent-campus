#!/usr/bin/env python3
"""Legacy OpenRouter bake utility for archived mockups.

New Campus work uses gpt-5.6-sol-900k via openai-codex and the shared
ProjectContext → RoomSpec → renderer pipeline. This script deliberately has no
default model so it cannot silently revive the superseded Kimi lock.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRIEF = (ROOT / "briefs" / "midas-room.md").read_text()

ENV_CANDIDATES = [
    ROOT / ".env",
    Path.home() / ".hermes" / ".env",
]


def load_openrouter_key() -> str:
    if os.environ.get("OPENROUTER_API_KEY"):
        return os.environ["OPENROUTER_API_KEY"].strip()
    for p in ENV_CANDIDATES:
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            if line.startswith("OPENROUTER_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("OPENROUTER_API_KEY not found")


SYSTEM = """You generate a single playable 3D environment mockup as one HTML file.

Return ONLY the HTML document. No markdown fences. No commentary before or after.
The first characters must be <!DOCTYPE html>
The last tag must be </html>
If you think, keep thinking internal; the user-visible output is HTML only.
"""


def user_prompt(model_label: str) -> str:
    return f"""{BRIEF}

HUD model label (exact): {model_label}

Implement the entire scene with Three.js in one HTML file now.
Quality bar: must look like a small 3D game room on first paint, not a tutorial.
"""


def extract_html(text: str) -> str:
    if not text:
        raise ValueError("empty model output")
    text = text.strip()
    fence = re.search(r"```(?:html)?\s*([\s\S]*?)```", text, re.I)
    if fence:
        text = fence.group(1).strip()
    start = text.lower().find("<!doctype html")
    if start == -1:
        start = text.lower().find("<html")
    if start == -1:
        raise ValueError("no HTML document in model output")
    text = text[start:]
    end = text.lower().rfind("</html>")
    if end == -1:
        raise ValueError("HTML missing </html>")
    return text[: end + len("</html>")].strip() + "\n"


def chat(model: str, model_label: str, max_tokens: int, timeout: int) -> dict:
    key = load_openrouter_key()
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_prompt(model_label)},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.4,
    }
    # Reasoning models: keep effort bounded so we still get a long HTML payload.
    if "gpt-5.6" in model or "kimi-k3" in model or "sonnet-5" in model:
        body["reasoning"] = {"effort": "medium"}
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=data,
        method="POST",
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/hectorTSH/hermes-agent-campus",
            "X-Title": "hermes-agent-campus mockup bake",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", "replace")
        raise SystemExit(f"HTTP {e.code} from OpenRouter for {model}: {err[:2000]}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="Legacy OpenRouter model id; no default because new Campus work uses the shared GPT-5.6 Sol RoomSpec pipeline")
    ap.add_argument("--label", required=True, help="Legacy provenance label")
    ap.add_argument("--out", required=True)
    ap.add_argument("--max-tokens", type=int, default=24000)
    ap.add_argument("--timeout", type=int, default=600)
    args = ap.parse_args()

    raw_path = Path(args.out).with_suffix(".raw.json")
    raw_path.parent.mkdir(parents=True, exist_ok=True)

    payload = chat(args.model, args.label, args.max_tokens, args.timeout)
    raw_path.write_text(json.dumps(payload, indent=2)[:2_000_000])

    choice = (payload.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    content = msg.get("content") or ""
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    usage = payload.get("usage") or {}
    meta = {
        "model_requested": args.model,
        "model_returned": payload.get("model"),
        "label": args.label,
        "finish_reason": choice.get("finish_reason"),
        "usage": usage,
        "content_chars": len(content),
        "has_reasoning": bool(msg.get("reasoning") or msg.get("reasoning_details")),
    }
    Path(args.out).with_suffix(".meta.json").write_text(json.dumps(meta, indent=2) + "\n")
    print(json.dumps(meta), flush=True)

    html = extract_html(content)
    Path(args.out).write_text(html)
    print(f"wrote {args.out} ({len(html)} bytes)", flush=True)


if __name__ == "__main__":
    main()
