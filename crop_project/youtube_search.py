"""
YouTube Video Recommender for Crop Disease Treatment
Recommends the best YouTube video based on detected disease.
Uses youtubesearchpython (no API key needed).
Uses Groq LLM to translate search queries into user's language.
"""

import re
import os
from typing import List, Dict, Optional

# ── Lazy imports ─────────────────────────────────────────────────────────────
_VideosSearch = None
_groq_client = None


def _get_videos_search():
    global _VideosSearch
    if _VideosSearch is None:
        from youtubesearchpython import VideosSearch
        _VideosSearch = VideosSearch
    return _VideosSearch


def _get_groq_client(api_key: Optional[str] = None):
    """Groq translation disabled as per user request."""
    return None


# ── LLM-powered query translation ───────────────────────────────────────────
_query_cache: Dict[str, str] = {}


def _translate_query_with_llm(
    crop_name: str,
    disease_name: str,
    language: str,
    api_key: Optional[str] = None,
) -> Optional[str]:
    """
    LLM Translation disabled. Falling back to keyword-based search.
    """
    return None


# ── Quality channels that produce reliable agricultural content ──────────────
QUALITY_CHANNELS = [
    "krishi jagran", "agrowon", "krishi darshan", "farming first",
    "green tv india", "smart agriculture", "agri junction",
    "kisan suvidha", "farming tips", "agriculture world",
    "krushi sahayak", "dr. agriculture", "innovative farmers",
    "modern kheti", "kheti kisani", "organic farming",
    "crop care", "plant doctor", "gardening tips",
]

# ── Disease-specific search queries for better results ──────────────────────
DISEASE_SEARCH_TEMPLATES = {
    # Banana
    "bract mosaic virus":   "{crop} bract mosaic virus treatment cure remedy",
    "cordana leaf spot":    "{crop} cordana leaf spot disease treatment spray",
    "insect pest damage":   "{crop} insect pest control organic treatment",
    "moko disease":         "{crop} moko disease bacterial wilt treatment prevention",
    "panama wilt":          "{crop} panama wilt fusarium treatment prevention",
    "pestalotiopsis":       "{crop} pestalotiopsis leaf spot fungal treatment",
    "sigatoka":             "{crop} sigatoka leaf spot disease treatment fungicide",
    "yellow sigatoka":      "{crop} yellow sigatoka disease management treatment",
    # Cauliflower
    "black rot":            "{crop} black rot xanthomonas disease treatment prevention",
    "bacterial spot rot":   "{crop} bacterial spot rot treatment spray",
    "downy mildew":         "{crop} downy mildew disease treatment fungicide remedy",
    # Chilli
    "anthracnose":          "{crop} anthracnose disease treatment fungicide organic",
    "leaf curl":            "{crop} leaf curl virus disease treatment control",
    "leaf spot":            "{crop} leaf spot disease treatment spray organic",
    "whitefly infestation": "{crop} whitefly pest control organic neem treatment",
    "yellowing":            "{crop} yellowing disease nutrient deficiency treatment",
    # Groundnut
    "early leaf spot":      "{crop} early leaf spot cercospora treatment fungicide",
    "early rust":           "{crop} early rust disease treatment prevention",
    "late leaf spot":       "{crop} late leaf spot disease treatment management",
    "nutrition deficiency": "{crop} nutrition deficiency symptoms treatment fertilizer",
    "rust":                 "{crop} rust disease puccinia treatment fungicide",
    # Radish
    "black leaf spot":      "{crop} black leaf spot alternaria disease treatment",
    "flea beetle damage":   "{crop} flea beetle pest control organic treatment",
    "mosaic virus":         "{crop} mosaic virus disease treatment prevention control",
}

CROP_TRANSLATIONS = {
    "hindi": {
        "banana": "केला kela",
        "chilli": "mirchi मिर्च",
        "radish": "mooli मूली",
        "groundnut": "moongphali मूंगफली",
        "cauliflower": "phool gobhi फूलगोभी",
        "tomato": "tamatar टमाटर",
        "potato": "aloo आलू",
        "corn": "makka मक्का भुट्टा",
        "wheat": "gehu गेहूं",
        "grape": "angoor अंगूर",
        "apple": "seb सेब",
        "pomegranate": "anaar अनार",
        "onion": "pyaz प्याज",
        "garlic": "lahsun लहसुन",
    },
    "marathi": {
        "banana": "केळी",
        "chilli": "mirchi मिरची",
        "radish": "mula मुळा",
        "groundnut": "bhuimug भुईमूग",
        "cauliflower": "flower कोबी",
        "tomato": "tomato टोमॅटो",
        "potato": "batata बटाटा",
        "corn": "maka मका",
        "wheat": "gahu गहू",
        "grape": "drakshe द्राक्ष",
        "apple": "safarchand सफरचंद",
        "pomegranate": "dalimb डाळिंब",
        "onion": "kanda कांदा",
    }
}


def _parse_duration(duration_str: str) -> float:
    """Parse '10:30' or '1:05:30' to minutes."""
    if not duration_str:
        return 0.0
    parts = duration_str.split(":")
    try:
        if len(parts) == 2:
            return int(parts[0]) + int(parts[1]) / 60
        elif len(parts) == 3:
            return int(parts[0]) * 60 + int(parts[1]) + int(parts[2]) / 60
    except ValueError:
        return 0.0
    return 0.0


def _parse_views(view_text: str) -> int:
    """Parse '1,234,567 views' → 1234567."""
    if not view_text:
        return 0
    m = re.search(r"([\d,.]+)", view_text)
    if not m:
        return 0
    num_str = m.group(1).replace(",", "")
    try:
        val = int(float(num_str))
    except ValueError:
        return 0
    text_upper = view_text.upper()
    if "K" in text_upper:
        val *= 1_000
    elif "M" in text_upper:
        val *= 1_000_000
    elif "B" in text_upper:
        val *= 1_000_000_000
    return val


def _score_video(
    video: Dict,
    crop: str,
    disease: str,
    language: str = "english",
) -> float:
    """
    Score a video on relevance to the crop disease.
    Higher = better.
    """
    title_lower = video.get("title", "").lower()
    desc_lower = video.get("description", "").lower()
    channel_lower = video.get("channel", "").lower()
    text = f"{title_lower} {desc_lower}"
    crop_lower = crop.lower()
    disease_lower = disease.lower()

    score = 0.0

    # ── Disease name in title (strongest signal) ─────────────────────────
    disease_words = disease_lower.split()
    title_disease_match = sum(1 for w in disease_words if w in title_lower)
    score += (title_disease_match / max(len(disease_words), 1)) * 35

    # ── Crop name in title ───────────────────────────────────────────────
    if crop_lower in title_lower:
        score += 15

    # ── Treatment / remedy / cure keywords ───────────────────────────────
    treatment_keywords = [
        "treatment", "cure", "remedy", "solution", "management",
        "control", "spray", "fungicide", "pesticide", "organic",
        "prevention", "fertilizer", "upchar", "ilaj", "upay",
        "dawai", "niyantran",
    ]
    treatment_hits = sum(1 for kw in treatment_keywords if kw in text)
    score += min(treatment_hits * 3, 15)

    # ── Disease + crop in description ────────────────────────────────────
    if disease_lower in desc_lower:
        score += 8
    if crop_lower in desc_lower:
        score += 5

    # ── View count (popularity signals quality) ──────────────────────────
    views = video.get("views", 0)
    if views >= 1_000_000:
        score += 8
    elif views >= 100_000:
        score += 6
    elif views >= 10_000:
        score += 4
    elif views >= 1_000:
        score += 2

    # ── Duration preference (3–12 min ideal) ─────────────────────────────
    duration = video.get("duration_minutes", 0)
    if 3 <= duration <= 12:
        score += 5
    elif 2 <= duration <= 15:
        score += 3
    elif duration > 20:
        score -= 3

    # ── Quality channel bonus ────────────────────────────────────────────
    if any(ch in channel_lower for ch in QUALITY_CHANNELS):
        score += 5

    # ── Language match ───────────────────────────────────────────────────
    if language.lower() == "hindi":
        hindi_indicators = ["hindi", "हिंदी", "हिन्दी", "kaise", "upay"]
        if any(h in text for h in hindi_indicators):
            score += 4
    elif language.lower() == "marathi":
        marathi_indicators = ["marathi", "मराठी", "कसे", "उपाय", "पीक", "रोग"]
        if any(m in text for m in marathi_indicators):
            score += 4
    elif language.lower() == "english":
        if "english" in text or not any(h in text for h in ["hindi", "हिंदी"]):
            score += 2

    # ── Negative signals (avoid shorts, memes, unrelated) ────────────────
    negative_keywords = ["#shorts", "meme",
                         "funny", "prank", "unboxing", "review"]
    if any(neg in text for neg in negative_keywords):
        score -= 15

    return round(score, 2)


def search_disease_videos(
    crop_name: str,
    disease_name: str,
    language: str = "english",
    max_results: int = 5,
    api_key: Optional[str] = None,
) -> List[Dict]:
    """
    Search YouTube for videos about treating a specific crop disease.
    Uses Groq LLM to translate queries into user's language for better results.

    Args:
        crop_name:    e.g. 'Banana', 'Chilli'
        disease_name: e.g. 'Sigatoka', 'Leaf Curl', 'Panama Wilt'
        language:     'english', 'hindi', or 'marathi'
        max_results:  Number of results to return (default 5)
        api_key:      Groq API key for LLM translation (optional, falls back to env)

    Returns:
        List of video dicts sorted by relevance score (best first).
    """
    VideosSearch = _get_videos_search()

    # Build English search query
    disease_key = disease_name.lower().strip()
    template = DISEASE_SEARCH_TEMPLATES.get(disease_key)
    if template:
        base_query = template.format(crop=crop_name)
    else:
        base_query = f"{crop_name} {disease_name} disease treatment cure remedy"

    lang_lower = language.lower().strip()
    if lang_lower in ("hindi", "hi"):
        language = "hindi"
        trans = CROP_TRANSLATIONS["hindi"].get(crop_name.lower())
        if trans:
            base_query = f"{trans} {disease_name} upchar kheti {base_query}"
        else:
            base_query += " hindi kheti upchar"
    elif lang_lower in ("marathi", "mr"):
        language = "marathi"
        trans = CROP_TRANSLATIONS["marathi"].get(crop_name.lower())
        if trans:
            base_query = f"{trans} {disease_name} rog upchar sheti {base_query}"
        else:
            base_query += " marathi sheti upchar"

    # ── Try LLM-translated native-language query ─────────────────────────
    native_query = None
    if language.lower() in ("hindi", "marathi"):
        native_query = _translate_query_with_llm(
            crop_name, disease_name, language, api_key
        )

    # ── Run searches (native + English fallback) ─────────────────────────
    all_items = []

    # Search with native-language query first (better regional results)
    if native_query:
        print(f"🔍 YouTube search (native): '{native_query}'")
        try:
            vs = VideosSearch(native_query, limit=15)
            raw = vs.result()
            items = raw.get("result", [])
            all_items.extend(items)
            print(f"   Found {len(items)} results with native query")
        except Exception as e:
            print(f"⚠ Native query search failed: {e}")

    # Also search with English+language query
    print(f"🔍 YouTube search (english): '{base_query}'")
    try:
        vs = VideosSearch(base_query, limit=15)
        raw = vs.result()
        items = raw.get("result", [])
        all_items.extend(items)
        print(f"   Found {len(items)} results with english query")
    except Exception as e:
        print(f"❌ YouTube search failed: {e}")

    if not all_items:
        print("⚠ No YouTube results found")
        return []

    # ── De-duplicate by video ID ─────────────────────────────────────────
    seen_ids = set()
    unique_items = []
    for item in all_items:
        vid_id = item.get("id", "")
        if vid_id and vid_id not in seen_ids:
            seen_ids.add(vid_id)
            unique_items.append(item)

    # Parse & score
    videos = []
    for item in unique_items:
        duration_str = item.get("duration", "0:00")
        duration_min = _parse_duration(duration_str)

        view_text = ""
        vc = item.get("viewCount")
        if isinstance(vc, dict):
            view_text = vc.get("text", vc.get("short", "0"))
        elif isinstance(vc, str):
            view_text = vc

        views = _parse_views(view_text)

        thumbnails = item.get("thumbnails", [])
        thumb_url = ""
        if thumbnails:
            # Pick highest quality thumbnail
            thumb_url = thumbnails[-1].get("url", thumbnails[0].get("url", ""))

        channel_info = item.get("channel", {})
        channel_name = channel_info.get("name", "") if isinstance(
            channel_info, dict) else str(channel_info)

        desc_snippets = item.get("descriptionSnippet")
        description = ""
        if desc_snippets and isinstance(desc_snippets, list):
            description = " ".join(s.get("text", "") for s in desc_snippets)

        video = {
            "id": item.get("id", ""),
            "url": item.get("link", f"https://www.youtube.com/watch?v={item.get('id', '')}"),
            "title": item.get("title", ""),
            "description": description,
            "thumbnail": thumb_url,
            "channel": channel_name,
            "publishedTime": item.get("publishedTime", ""),
            "duration": duration_str,
            "duration_minutes": round(duration_min, 1),
            "views": views,
            "viewText": view_text,
        }

        video["score"] = _score_video(video, crop_name, disease_name, language)
        videos.append(video)

    # Sort by score descending
    videos.sort(key=lambda v: v["score"], reverse=True)

    # ── Strict Language Filtering ────────────────────────────────────────
    # If the user requested Hindi/Marathi, we try to filter for those ONLY.
    if language.lower() in ("hindi", "marathi"):
        lang_indicators = {
            "hindi": ["hindi", "हिंदी", "हिन्दी", "kaise", "upay", "ilaj", "dawai", "kheti", "किसान"],
            "marathi": ["marathi", "मराठी", "कसे", "उपाय", "पीक", "रोग", "sheti", "शेतकरी", "माहिती"]
        }
        indicators = lang_indicators.get(language.lower(), [])
        
        filtered = []
        for v in videos:
            text = f"{v['title']} {v['description']}".lower()
            # Check for any indicator word OR any Devanagari character for Indic languages
            has_indic_script = any('\u0900' <= char <= '\u097F' for char in text)
            if any(ind in text for ind in indicators) or has_indic_script:
                filtered.append(v)
        
        # If we found at least 2 filtered videos, use them exclusively
        if len(filtered) >= 1:
            videos = filtered

    # Return top N
    top = videos[:max_results]

    if top:
        best = top[0]
        print(f"✅ Best match: '{best['title'][:70]}' (score={best['score']})")

    return top
