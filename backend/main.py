from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .services.cr_api import get_player, get_battle_log
from .services.analyzer import compute_upgrade_priorities, get_used_decks
from .services.gemini import prompt_best_decks, prompt_upgrade_advice, prompt_deck_coach


app = FastAPI(title="Clash Coach API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/player")
def player():
    try:
        return get_player()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/upgrades")
def upgrades():
    try:
        p = get_player()
        battles = get_battle_log()
        priorities = compute_upgrade_priorities(p, battles)
        advice = prompt_upgrade_advice(priorities, p)
        return {"priorities": priorities, "advice": advice}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/decks")
def decks():
    try:
        p = get_player()
        battles = get_battle_log()
        priorities = compute_upgrade_priorities(p, battles)
        used_decks = get_used_decks(battles)
        advice = prompt_best_decks(p, priorities, used_decks)
        return {"decks": used_decks, "advice": advice.model_dump(), "collection": p.get("cards", [])}
    except Exception as e:
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
        advice = prompt_deck_coach(deck["cards"], p["trophies"])
        return {"deck": deck, "advice": advice}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
