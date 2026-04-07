"""
AI chain pipeline for deep analysis mode.
Each chain runs in a background thread and updates a job in the in-memory store.
"""
import uuid
import logging
import traceback
from datetime import datetime, timedelta
from typing import Any, Literal
from pydantic import BaseModel

from .gemini import (
    ask_gemini, ask_gemini_json,
    format_card_entry, NO_HYPE_INSTRUCTION,
    BestDecksResponse, MODEL,
)
from .arena_rules import DeckConstraints
from .cache import cache_get, cache_set

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Job store
# ---------------------------------------------------------------------------

class ChainJob(BaseModel):
    job_id: str
    status: Literal["running", "complete", "error"]
    current_step: str
    result: Any = None
    error: str | None = None
    created_at: str = ""


_jobs: dict[str, ChainJob] = {}
_JOB_TTL = timedelta(minutes=15)


def create_job() -> str:
    job_id = str(uuid.uuid4())
    _jobs[job_id] = ChainJob(
        job_id=job_id,
        status="running",
        current_step="starting",
        created_at=datetime.utcnow().isoformat(),
    )
    _purge_old_jobs()
    return job_id


def get_job(job_id: str) -> ChainJob | None:
    return _jobs.get(job_id)


def _update_job(job_id: str, **kwargs: Any) -> None:
    job = _jobs.get(job_id)
    if job:
        _jobs[job_id] = job.model_copy(update=kwargs)


def _purge_old_jobs() -> None:
    cutoff = datetime.utcnow() - _JOB_TTL
    stale = [
        jid for jid, j in _jobs.items()
        if j.created_at and datetime.fromisoformat(j.created_at) < cutoff
    ]
    for jid in stale:
        del _jobs[jid]


# ---------------------------------------------------------------------------
# Shared data models
# ---------------------------------------------------------------------------

class AnalystReport(BaseModel):
    player_strengths: list[str]
    player_weaknesses: list[str]
    card_level_summary: str
    battle_pattern_analysis: str
    highest_level_cards: list[str]
    evo_hero_available: list[str]
    trophy_range_assessment: str


# ---------------------------------------------------------------------------
# Shared step: Analyst
# ---------------------------------------------------------------------------

def _step_analyst(player: dict, battles: list, priorities: list) -> AnalystReport:
    top_cards = [format_card_entry(c) for c in player.get("cards", [])[:20]]
    top_priorities = [f"{p['name']} (score {p['upgradeScore']}, win {p['winRate']}%)" for p in priorities[:10]]

    game_modes = {}
    for b in battles[:25]:
        mode = b.get("gameMode", {}).get("name", "Unknown")
        game_modes[mode] = game_modes.get(mode, 0) + 1

    prompt = f"""Analyze this Clash Royale player's data and produce a structured report.

Player: {player.get('name', 'Unknown')} — Trophies: {player.get('trophies', '?')} — King Level: {player.get('expLevel', '?')}
Wins: {player.get('wins', 0)} / Losses: {player.get('losses', 0)}
Recent game modes played: {game_modes}

Top cards (by collection): {chr(10).join(top_cards[:15])}
Top upgrade priorities (by algorithm): {chr(10).join(top_priorities)}

Produce a precise, data-driven analyst report. Be concise and factual.
"""
    return ask_gemini_json(prompt, AnalystReport)


# ---------------------------------------------------------------------------
# Upgrade chain
# ---------------------------------------------------------------------------

def _step_upgrade_strategist(report: AnalystReport, player: dict, priorities: list) -> str:
    top_picks = priorities[:5]
    details = "\n".join(
        f"{i+1}. {format_card_entry(p)} — Win {p['winRate']}%, Score {p['upgradeScore']}"
        for i, p in enumerate(top_picks)
    )

    prompt = f"""You are a Clash Royale upgrade strategist with access to live meta data.
{NO_HYPE_INSTRUCTION}
Use Google Search to check current meta relevance of these cards.

Player context from analyst:
- Strengths: {', '.join(report.player_strengths)}
- Weaknesses: {', '.join(report.player_weaknesses)}
- Trophy range: {report.trophy_range_assessment}
- Top cards: {', '.join(report.highest_level_cards[:5])}

Top 5 algorithmically recommended upgrades:
{details}

Produce a draft upgrade recommendation using Markdown. Be direct, no preamble.
"""
    return ask_gemini(prompt)


def _step_upgrade_formatter(strategist_output: str, priorities: list) -> str:
    prompt = f"""You are a Clash Royale coaching editor.
{NO_HYPE_INSTRUCTION}
Review and finalize this upgrade advice. Remove any hype intros, fix formatting, ensure clarity.

Input:
{strategist_output}

Rules:
- Start directly with the first card recommendation (e.g., "1. **Card Name**...")
- Use Markdown: bullet points and **bold** for card names and key terms
- Keep it concise — one punchy reason per card
- Do not add greetings, praise, or filler
"""
    return ask_gemini(prompt)


def run_upgrade_chain(job_id: str, player: dict, battles: list, priorities: list) -> None:
    try:
        _update_job(job_id, current_step="analyst")
        report = _step_analyst(player, battles, priorities)

        _update_job(job_id, current_step="strategist")
        draft = _step_upgrade_strategist(report, player, priorities)

        _update_job(job_id, current_step="formatter")
        final_advice = _step_upgrade_formatter(draft, priorities)

        _update_job(
            job_id,
            status="complete",
            current_step="done",
            result={"advice": final_advice},
        )
    except Exception:
        logger.error(traceback.format_exc())
        _update_job(job_id, status="error", error=traceback.format_exc().splitlines()[-1])


# ---------------------------------------------------------------------------
# Deck chain
# ---------------------------------------------------------------------------

_META_CACHE_KEY = "deck_meta_search"
_META_CACHE_TTL = 86400  # 24 hours


def _step_deck_meta_search(card_names: list[str]) -> str:
    cached = cache_get(_META_CACHE_KEY, ttl_seconds=_META_CACHE_TTL)
    if cached:
        logger.info("Meta search: using cached result (< 24h old)")
        return cached

    prompt = """Search for the current top Clash Royale ladder meta decks (Path of Legends / top ladder).
Find the 5 strongest ladder archetypes right now from RoyaleAPI, StatsRoyale, or similar sources.
List each archetype, its core 8 cards, and its win condition. Be concise and factual.
"""
    result = ask_gemini(prompt)
    cache_set(_META_CACHE_KEY, result)
    return result


def _step_deck_strategist(
    report: AnalystReport,
    meta_data: str,
    player: dict,
    priorities: list,
    decks: list,
    constraints: DeckConstraints,
) -> str:
    card_names = [c["name"] for c in player.get("cards", [])]
    recent = [", ".join(c["name"] for c in d["cards"]) for d in decks[:5]]

    prompt = f"""You are a Clash Royale deck strategist.
{NO_HYPE_INSTRUCTION}

Player context:
- Trophies: {player.get('trophies', '?')}
- Strengths: {', '.join(report.player_strengths)}
- Available evos/heroes: {', '.join(report.evo_hero_available)}
- Upgrade priorities: {', '.join(report.highest_level_cards[:5])}
- Recent decks played: {chr(10).join(recent)}

Current meta (from live search):
{meta_data}

DECK CONSTRAINTS (HARD — do not violate):
- Max {constraints.max_evos} Evolution card(s) per deck
- Max {constraints.max_heroes} Hero card(s) per deck
- Max {constraints.max_evo_or_hero} total Evo+Hero combined per deck

Draft 3 ladder deck suggestions and 1 clan war deck for this player.
Only use cards from their collection: {', '.join(card_names[:30])}
For each deck: name, archetype, 8 card names, why it fits, win condition.
"""
    return ask_gemini(prompt)


def _step_deck_fact_checker(
    strategist_output: str,
    player: dict,
    constraints: DeckConstraints,
) -> BestDecksResponse:
    card_list = [format_card_entry(c) for c in player.get("cards", [])]
    prompt = f"""You are a Clash Royale deck validator and formatter.
{NO_HYPE_INSTRUCTION}

Read the deck strategy draft below and produce a final validated JSON response.

Player's card collection (ONLY use cards from this list):
{chr(10).join(card_list)}

HARD CONSTRAINTS per deck:
- Max {constraints.max_evos} Evolution card(s)
- Max {constraints.max_heroes} Hero card(s)
- Max {constraints.max_evo_or_hero} total Evo+Hero combined
- Exactly 8 cards per deck
- Card names must exactly match the collection above (no (EVOLVED)/(HERO) suffixes)

Strategy draft to finalize:
{strategist_output}

Return valid JSON only. Ensure all constraints are satisfied.
"""
    return ask_gemini_json(prompt, BestDecksResponse)


def run_deck_chain(
    job_id: str,
    player: dict,
    battles: list,
    priorities: list,
    used_decks: list,
    constraints: DeckConstraints,
    last_battles: list | None = None,
) -> None:
    from .analyzer import compute_deck_score, normalize_card_name
    try:
        _update_job(job_id, current_step="analyst")
        report = _step_analyst(player, battles, priorities)

        _update_job(job_id, current_step="meta_search")
        card_names = [c["name"] for c in player.get("cards", [])]
        meta_data = _step_deck_meta_search(card_names)

        _update_job(job_id, current_step="strategist")
        draft = _step_deck_strategist(report, meta_data, player, priorities, used_decks, constraints)

        _update_job(job_id, current_step="fact_checker")
        final = _step_deck_fact_checker(draft, player, constraints)

        advice = final.model_dump()
        card_lookup = {c["name"].lower(): c for c in player.get("cards", [])}
        try:
            for suggested in advice.get("ladder_decks", []):
                cards = [card_lookup.get(normalize_card_name(n).lower(), {"level": 1, "rarity": "common", "name": n}) for n in suggested["cards"]]
                suggested["deck_score"] = compute_deck_score(cards, constraints)
            cw = advice.get("clan_war_deck")
            if cw:
                cards = [card_lookup.get(normalize_card_name(n).lower(), {"level": 1, "rarity": "common", "name": n}) for n in cw["cards"]]
                cw["deck_score"] = compute_deck_score(cards, constraints)
        except Exception:
            logger.error(traceback.format_exc())

        _update_job(
            job_id,
            status="complete",
            current_step="done",
            result=advice,
        )
    except Exception:
        logger.error(traceback.format_exc())
        _update_job(job_id, status="error", error=traceback.format_exc().splitlines()[-1])


# ---------------------------------------------------------------------------
# Coach chain
# ---------------------------------------------------------------------------

def _step_coach_analyst(deck_cards: list, trophies: int) -> str:
    lines = [format_card_entry(c) for c in deck_cards]
    from .gemini import ask_gemini as _ask
    prompt = f"""Analyze this Clash Royale deck for a player at {trophies} trophies.
Identify: archetype, win condition, key synergies, obvious weaknesses.
Be concise and factual — this is an internal analysis for a downstream coach.

Deck:
{chr(10).join(lines)}
"""
    return ask_gemini(prompt)


def _step_coach_strategist(deck_analysis: str, deck_cards: list, trophies: int) -> str:
    from .gemini import format_card_entry as _fmt
    avg_elixir = round(sum(c.get("elixirCost", 0) for c in deck_cards) / len(deck_cards), 2)
    prompt = f"""You are an expert Clash Royale coach. Use Google Search to check the current meta.
{NO_HYPE_INSTRUCTION}

Deck analysis:
{deck_analysis}

Average elixir: {avg_elixir}
Player trophy range: {trophies}

Write a detailed coaching report with these sections:
### ⚔️ Game Plan & Win Condition
### 🎯 Recommended Openers
### 💧 Elixir Management
### 🛡️ Matchups
### ⚠️ Common Mistakes
### 📈 Meta Relevance

Use **bold** only for card names and key terms. No preamble before the first header.
"""
    return ask_gemini(prompt)


def _step_coach_formatter(draft: str) -> str:
    prompt = f"""You are a coaching report editor.
{NO_HYPE_INSTRUCTION}
Review and clean this coaching report. Remove any hype intros, ensure the first line is a Markdown header.

Input:
{draft}

Return the cleaned report only.
"""
    return ask_gemini(prompt)


def run_coach_chain(job_id: str, deck_cards: list, trophies: int) -> None:
    try:
        _update_job(job_id, current_step="analyst")
        deck_analysis = _step_coach_analyst(deck_cards, trophies)

        _update_job(job_id, current_step="strategist")
        draft = _step_coach_strategist(deck_analysis, deck_cards, trophies)

        _update_job(job_id, current_step="formatter")
        final_advice = _step_coach_formatter(draft)

        _update_job(
            job_id,
            status="complete",
            current_step="done",
            result={"advice": final_advice},
        )
    except Exception:
        logger.error(traceback.format_exc())
        _update_job(job_id, status="error", error=traceback.format_exc().splitlines()[-1])
