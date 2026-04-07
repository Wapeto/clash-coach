import os
import re
import json
from pathlib import Path
from google import genai
from google.genai import types
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
MODEL = "gemini-2.5-flash"

NO_HYPE_INSTRUCTION = (
    "Do NOT open with greetings, hype phrases, or filler. "
    "Forbidden openers include: 'As a pro coach', 'Alright fellow Clasher', 'Great question', "
    "'Let's dive in', 'As your coach', 'Hey there', 'Absolutely', 'Of course', 'Sure!'. "
    "Start directly with the substance. Be professional and concise."
)

_HYPE_PATTERN = re.compile(
    r"^(alright[\w ,!]*|as (a |your |an )?[\w ]+ coach[\w ,!]*|"
    r"great (question|choice|pick)[\w ,!]*|let'?s (dive|get) [\w ,!]*|"
    r"hey (there|clash[\w]*|fellow[\w ]*)[\w ,!]*|"
    r"sure[!,.][\w ,]*|absolutely[!,.][\w ,]*|of course[!,.][\w ,]*)",
    re.IGNORECASE,
)


def _strip_hype(text: str) -> str:
    """Remove hype opener from first line if it matches known patterns."""
    if not text:
        return text
    lines = text.split("\n")
    first = lines[0].strip()
    if _HYPE_PATTERN.match(first) and len(first) < 200:
        lines = lines[1:]
        # Drop blank line immediately after stripped opener
        while lines and not lines[0].strip():
            lines = lines[1:]
    return "\n".join(lines)


class SuggestedDeck(BaseModel):
    deck_name: str
    archetype: str
    cards: list[str]
    why_it_fits: str
    win_condition: str


class BestDecksResponse(BaseModel):
    ladder_decks: list[SuggestedDeck]
    clan_war_deck: SuggestedDeck


def ask_gemini(prompt: str) -> str:
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            temperature=0.7,
        )
    )
    return _strip_hype(response.text)


def ask_gemini_json(prompt: str, schema: type[BaseModel]) -> BaseModel:
    # Google Search grounding is incompatible with structured JSON output (response_schema)
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.7,
            response_mime_type="application/json",
            response_schema=schema,
        )
    )
    return schema(**json.loads(response.text))


def fmt_level(api_level: int, rarity: str) -> str:
    start_levels = {
        "common": 1,
        "rare": 3,
        "epic": 6,
        "legendary": 9,
        "champion": 11,
    }
    start = start_levels.get(rarity.lower(), 1)
    return str(start + api_level - 1)


def format_card_entry(c: dict) -> str:
    lvl = fmt_level(c["level"], c["rarity"])
    is_unlocked = c.get("evolutionLevel", 0) > 0
    has_evo = bool(c.get("iconUrls", {}).get("evolutionMedium"))
    has_hero = bool(c.get("iconUrls", {}).get("heroMedium"))
    evo = " (EVOLVED)" if is_unlocked and has_evo and not has_hero else ""
    hero = " (HERO)" if is_unlocked and has_hero else ""
    elixir = c.get("elixirCost", "?")
    return f"{c['name']}{evo}{hero} (Lvl {lvl}/16, {c['rarity']}, {elixir} elixir)"


def prompt_best_decks(player: dict, priorities: list, decks: list, constraints: "DeckConstraints | None" = None) -> BestDecksResponse:
    from .arena_rules import DeckConstraints
    if constraints is None:
        from .arena_rules import get_deck_constraints
        constraints = get_deck_constraints(player.get("arena", {}))

    card_list = [format_card_entry(c) for c in player["cards"]]

    ladder_decks = [d for d in decks if d.get("gameMode") in ["Ladder", "Ranked1v1", "Ranked", "Path of Legends"]]
    if not ladder_decks:
        ladder_decks = decks[:5]

    recent_decks = [
        f"[{d.get('gameMode', 'Unknown')}] " + ", ".join(c["name"] for c in d["cards"])
        for d in ladder_decks
    ]

    constraint_rules = (
        f"5. DECK SLOT CONSTRAINTS (HARD RULES — violating these makes the deck ILLEGAL):\n"
        f"   - Maximum {constraints.max_evos} Evolution card(s) per deck.\n"
        f"   - Maximum {constraints.max_heroes} Hero card(s) per deck.\n"
        f"   - Maximum {constraints.max_evo_or_hero} total Evo+Hero slot(s) combined per deck.\n"
        f"   - 0 Evos/Heroes is always valid.\n"
        f"   - DO NOT exceed these limits under any circumstances."
    )

    prompt = f"""You are an expert Clash Royale coach.
Recommend the 3 best LADDER decks and 1 CLAN WAR deck for this player.
{NO_HYPE_INSTRUCTION}

Player Data:
- Trophies: {player.get("trophies", "Unknown")}
- Cards owned: {chr(10).join(card_list)}
- High Priority Upgrades: {", ".join(p['name'] for p in priorities[:10])}
- Recently played ladder decks: {chr(10).join(recent_decks)}

CRITICAL RULES:
1. ONLY return strict JSON matching the schema.
2. The `cards` array MUST exactly match the card names from the player's collection above. DO NOT include (EVOLVED), (HERO), or level data — just the base card name.
3. Ignore Clan Battle and 7x Elixir decks when designing Ladder decks.
4. If the player has EVOLVED or HERO cards, prefer decks that use them (within the slot limits below).
{constraint_rules}
"""
    return ask_gemini_json(prompt, BestDecksResponse)


def prompt_upgrade_advice(priorities: list, player: dict) -> str:
    top_picks = priorities[:5]
    details = [
        f"{i+1}. {format_card_entry(p)} - Win Rate: {p['winRate']}%, Score: {p['upgradeScore']}"
        for i, p in enumerate(top_picks)
    ]

    prompt = f"""You are an expert Clash Royale coach. Give upgrade advice based on the data.
{NO_HYPE_INSTRUCTION}
Trophy range: {player.get('trophies', 'Unknown')}

Top 5 algorithmically recommended upgrades:
{chr(10).join(details)}

OUTPUT FORMAT:
- Use Markdown with bullet points and **bold** text.
- Highlight Evos and Heroes strongly.
- Give a short, punchy reason for each pick.
- Do not add a preamble — start with the first card recommendation.
"""
    return ask_gemini(prompt)


def prompt_deck_coach(deck_cards: list, trophies: int) -> str:
    card_lines = ["- " + format_card_entry(c) for c in deck_cards]
    avg_elixir = round(sum(c.get("elixirCost", 0) for c in deck_cards) / len(deck_cards), 2)

    evo_hero_notes = []
    for c in deck_cards:
        urls = c.get("iconUrls", {})
        if c.get("evolutionLevel", 0) > 0:
            if urls.get("heroMedium"):
                evo_hero_notes.append(f"{c['name']} (player owns the HERO version)")
            elif urls.get("evolutionMedium"):
                evo_hero_notes.append(f"{c['name']} (player owns the EVO version)")
    evo_hero_str = (
        "Player's special cards in this deck: " + ", ".join(evo_hero_notes)
        if evo_hero_notes else "No Evos or Heroes in this deck."
    )

    prompt = f"""You are an expert Clash Royale coach. Be specific and practical.
{NO_HYPE_INSTRUCTION}
Use Google Search to look up the current meta, recent balance changes, and how this deck performs on ladder right now.

Deck ({avg_elixir} avg elixir):
{chr(10).join(card_lines)}
{evo_hero_str}
Player trophy range: {trophies}

Structure your response EXACTLY with these Markdown headers, no preamble before the first one:

### 🃏 Why These Cards Work Together
(Explain the role of each card and its synergy with the others. Mention how Evos/Heroes change the dynamic if present.)

### ⚔️ Game Plan & Win Condition
(Core strategy to win)

### 🎯 Recommended Openers
(First plays and where to place them)

### 💧 Elixir Management
(Cycle strategy and key trades)

### 🛡️ Matchups
- vs Beatdown: ...
- vs Cycle/Bait: ...
- vs Control: ...

### ⚠️ Common Mistakes
(Top 3 mistakes players make with this deck)

### 📈 Meta Relevance
(Current standing in the meta based on live data)

Use **bold** only for card names and key terms.
"""
    return ask_gemini(prompt)
