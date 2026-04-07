"""Simple file-based JSON cache with TTL."""
import json
import time
from pathlib import Path

_CACHE_DIR = Path(__file__).parent.parent / ".cache"


def _path(key: str) -> Path:
    safe = key.replace("/", "_").replace(" ", "_")
    return _CACHE_DIR / f"{safe}.json"


def cache_get(key: str, ttl_seconds: int = 86400) -> str | None:
    """Return cached value if it exists and is younger than ttl_seconds, else None."""
    p = _path(key)
    if not p.exists():
        return None
    try:
        data = json.loads(p.read_text())
        if time.time() - data["ts"] < ttl_seconds:
            return data["value"]
    except Exception:
        pass
    return None


def cache_set(key: str, value: str) -> None:
    """Write value to cache with current timestamp."""
    _CACHE_DIR.mkdir(exist_ok=True)
    _path(key).write_text(json.dumps({"ts": time.time(), "value": value}))
