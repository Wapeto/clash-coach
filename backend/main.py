import logging
import traceback
import threading
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai.errors import ClientError
from .services.cr_api import get_player, get_battle_log
from .services.analyzer import compute_upgrade_priorities, get_used_decks, get_last_battles, compute_deck_score
from .services.gemini import prompt_best_decks, prompt_upgrade_advice, prompt_deck_coach
from .services.arena_rules import get_deck_constraints
from .services.chain import (
    create_job, get_job,
    run_deck_chain, run_upgrade_chain, run_coach_chain,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Clash Coach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

AI_QUOTA_MSG = "AI advice unavailable (Gemini quota exceeded). Check your API key at https://aistudio.google.com/apikey"


def _is_quota_error(e: Exception) -> bool:
    return isinstance(e, ClientError) and "429" in str(e)


def _ai_error_msg(e: Exception) -> str:
    return AI_QUOTA_MSG if _is_quota_error(e) else f"AI unavailable: {e}"


@app.get("/player")
def player(tag: str = None):
    try:
        return get_player(tag)
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Upgrades — split into fast data + async AI
# ---------------------------------------------------------------------------

@app.get("/upgrades")
def upgrades(tag: str = None):
    """Returns upgrade priority list (algorithmic, fast, cached)."""
    try:
        p = get_player(tag)
        battles = get_battle_log(tag)
        priorities = compute_upgrade_priorities(p, battles)
        return {"priorities": priorities}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/upgrades/advice")
def upgrades_advice(mode: str = "fast", tag: str = None):
    """Returns AI upgrade advice. Supports mode=deep for chained analysis."""
    try:
        p = get_player(tag)
        battles = get_battle_log(tag)
        priorities = compute_upgrade_priorities(p, battles)

        if mode == "deep":
            job_id = create_job()
            threading.Thread(
                target=run_upgrade_chain,
                args=(job_id, p, battles, priorities),
                daemon=True,
            ).start()
            return {"job_id": job_id, "status": "running"}

        try:
            advice = prompt_upgrade_advice(priorities, p)
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = _ai_error_msg(e)
        return {"advice": advice}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Decks — split into fast data + async AI suggestions
# ---------------------------------------------------------------------------

@app.get("/decks")
def decks(tag: str = None):
    """Returns battle history, card collection, and arena constraints (no AI, fast, cached)."""
    try:
        p = get_player(tag)
        battles = get_battle_log(tag)
        constraints = get_deck_constraints(p.get("arena", {}))
        last_battles = get_last_battles(battles, p.get("cards", []), n=5, constraints=constraints)
        return {
            "battles": last_battles,
            "collection": p.get("cards", []),
            "constraints": constraints.model_dump(),
        }
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decks/suggestions")
def decks_suggestions(mode: str = "fast", tag: str = None):
    """Returns AI deck suggestions. Supports mode=deep for chained analysis."""
    try:
        p = get_player(tag)
        battles = get_battle_log(tag)
        priorities = compute_upgrade_priorities(p, battles)
        used_decks = get_used_decks(battles)
        constraints = get_deck_constraints(p.get("arena", {}))
        card_lookup = {c["name"].lower(): c for c in p.get("cards", [])}

        if mode == "deep":
            last_battles = get_last_battles(battles, p.get("cards", []), n=5, constraints=constraints)
            job_id = create_job()
            threading.Thread(
                target=run_deck_chain,
                args=(job_id, p, battles, priorities, used_decks, constraints, last_battles),
                daemon=True,
            ).start()
            return {"job_id": job_id, "status": "running"}

        try:
            ai_advice = prompt_best_decks(p, priorities, used_decks, constraints)
            advice = ai_advice.model_dump()
        except Exception as e:
            logger.error(traceback.format_exc())
            raise HTTPException(status_code=503, detail=_ai_error_msg(e))

        # Enrich suggested decks with algorithmic scores
        try:
            for suggested in advice.get("ladder_decks", []):
                cards = [card_lookup.get(n.lower(), {"level": 1, "rarity": "common"}) for n in suggested["cards"]]
                suggested["deck_score"] = compute_deck_score(cards, constraints)
            cw = advice.get("clan_war_deck")
            if cw:
                cards = [card_lookup.get(n.lower(), {"level": 1, "rarity": "common"}) for n in cw["cards"]]
                cw["deck_score"] = compute_deck_score(cards, constraints)
        except Exception:
            logger.error(traceback.format_exc())

        return advice
    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Coach — per-deck coaching (AI only)
# ---------------------------------------------------------------------------

@app.get("/coach/battle/{battle_index}")
def coach_battle(battle_index: int, mode: str = "fast", tag: str = None):
    try:
        p = get_player(tag)
        battles = get_battle_log(tag)
        constraints = get_deck_constraints(p.get("arena", {}))
        last = get_last_battles(battles, p.get("cards", []), n=5, constraints=constraints)
        if battle_index >= len(last):
            raise HTTPException(status_code=404, detail="Battle index out of range")
        enriched_cards = last[battle_index]["player_deck"]["cards"]

        if mode == "deep":
            job_id = create_job()
            threading.Thread(
                target=run_coach_chain,
                args=(job_id, enriched_cards, p["trophies"]),
                daemon=True,
            ).start()
            return {"job_id": job_id, "status": "running"}

        try:
            advice = prompt_deck_coach(enriched_cards, p["trophies"])
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = _ai_error_msg(e)
        return {"advice": advice}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coach/{deck_index}")
def coach(deck_index: int, mode: str = "fast", tag: str = None):
    try:
        p = get_player(tag)
        battles = get_battle_log(tag)
        used_decks = get_used_decks(battles)
        if deck_index >= len(used_decks):
            raise HTTPException(status_code=404, detail="Deck index out of range")
        deck = used_decks[deck_index]
        card_lookup = {c["name"]: c for c in p.get("cards", [])}
        enriched_cards = [card_lookup.get(c["name"], c) for c in deck["cards"]]

        if mode == "deep":
            job_id = create_job()
            threading.Thread(
                target=run_coach_chain,
                args=(job_id, enriched_cards, p["trophies"]),
                daemon=True,
            ).start()
            return {"job_id": job_id, "status": "running"}

        try:
            advice = prompt_deck_coach(enriched_cards, p["trophies"])
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = _ai_error_msg(e)
        return {"deck": deck, "advice": advice}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/status/{job_id}")
def status(job_id: str):
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job.model_dump()
