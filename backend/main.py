import logging
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai.errors import ClientError
from .services.cr_api import get_player, get_battle_log
from .services.analyzer import compute_upgrade_priorities, get_used_decks
from .services.gemini import prompt_best_decks, prompt_upgrade_advice, prompt_deck_coach

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
    return isinstance(e, ClientError) and e.status_code == 429


@app.get("/player")
def player():
    try:
        return get_player()
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/upgrades")
def upgrades():
    try:
        p = get_player()
        battles = get_battle_log()
        priorities = compute_upgrade_priorities(p, battles)
        try:
            advice = prompt_upgrade_advice(priorities, p)
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = AI_QUOTA_MSG if _is_quota_error(e) else f"AI unavailable: {e}"
        return {"priorities": priorities, "advice": advice}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decks")
def decks():
    try:
        p = get_player()
        battles = get_battle_log()
        priorities = compute_upgrade_priorities(p, battles)
        used_decks = get_used_decks(battles)
        try:
            ai_advice = prompt_best_decks(p, priorities, used_decks)
            advice = ai_advice.model_dump()
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = None
        return {"decks": used_decks, "advice": advice, "collection": p.get("cards", [])}
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/coach/{deck_index}")
def coach(deck_index: int):
    try:
        p = get_player()
        battles = get_battle_log()
        used_decks = get_used_decks(battles)
        if deck_index >= len(used_decks):
            raise HTTPException(status_code=404, detail="Deck index out of range")
        deck = used_decks[deck_index]
        try:
            advice = prompt_deck_coach(deck["cards"], p["trophies"])
        except Exception as e:
            logger.error(traceback.format_exc())
            advice = AI_QUOTA_MSG if _is_quota_error(e) else f"AI unavailable: {e}"
        return {"deck": deck, "advice": advice}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
