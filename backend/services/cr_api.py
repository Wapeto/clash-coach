import json
import os
import urllib.parse
from pathlib import Path
import httpx
from dotenv import load_dotenv
from .cache import cache_get, cache_set

load_dotenv(Path(__file__).parent.parent / ".env")

CR_BASE_URL = "https://api.clashroyale.com/v1"
CR_API_KEY = os.getenv("CR_API_KEY")
PLAYER_TAG = os.getenv("PLAYER_TAG")

HEADERS = {"Authorization": f"Bearer {CR_API_KEY}"}

_PLAYER_TTL = 900   # 15 min
_BATTLES_TTL = 600  # 10 min


def _encode_tag(tag: str) -> str:
    return urllib.parse.quote(tag, safe="")


def get_player(tag: str = None) -> dict:
    tag = tag or PLAYER_TAG
    key = f"player_{tag}"
    cached = cache_get(key, ttl_seconds=_PLAYER_TTL)
    if cached:
        return json.loads(cached)
    url = f"{CR_BASE_URL}/players/{_encode_tag(tag)}"
    r = httpx.get(url, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    cache_set(key, json.dumps(data))
    return data


def get_battle_log(tag: str = None) -> list:
    tag = tag or PLAYER_TAG
    key = f"battles_{tag}"
    cached = cache_get(key, ttl_seconds=_BATTLES_TTL)
    if cached:
        return json.loads(cached)
    url = f"{CR_BASE_URL}/players/{_encode_tag(tag)}/battlelog"
    r = httpx.get(url, headers=HEADERS)
    r.raise_for_status()
    data = r.json()
    cache_set(key, json.dumps(data))
    return data
