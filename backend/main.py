import logging
import traceback
import threading
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from google.genai.errors import ClientError
from .services.cr_api import get_player, get_battle_log
from .services.analyzer import compute_upgrade_priorities, get_used_decks
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
def player():
    try:
        return get_player()
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/upgrades")
def upgrades(mode: str = "fast"):
    try:
        p = get_player()
        battles = get_battle_log()
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
        return {"priorities": priorities, "advice": advice}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decks")
def decks(mode: str = "fast"):
    try:
        p = get_player()
        battles = get_battle_log()
        priorities = compute_upgrade_priorities(p, battles)
        used_decks = get_used_decks(battles)
        constraints = get_deck_constraints(p.get("arena", {}))

        if mode == "deep":
            job_id = create_job()
            threading.Thread(
                target=run_deck_chain,
                args=(job_id, p, battles, priorities, used_decks, constraints),
                daemon=True,
            ).start()
            return {"job_id": job_id, "status": "running"}

        try:
            ai_advice = prompt_best_decks(p, priorities, used_decks, constraints)
            advice = ai_advice.model_dump()
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = None
        return {"decks": used_decks, "advice": advice, "collection": p.get("cards", [])}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coach/{deck_index}")
def coach(deck_index: int, mode: str = "fast"):
    try:
        p = get_player()
        battles = get_battle_log()
        used_decks = get_used_decks(battles)
        if deck_index >= len(used_decks):
            raise HTTPException(status_code=404, detail="Deck index out of range")
        deck = used_decks[deck_index]
        # Enrich battle-log cards with collection data (adds evolutionLevel, iconUrls, etc.)
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
