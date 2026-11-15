"""Read the Instagram gallery published on Gul Ahmed's own storefront."""
import json
import re
from datetime import datetime, timezone
from urllib.error import URLError
from urllib.request import Request, urlopen

SITE = "https://www.gulahmedshop.com/"
SOURCE = "Gul Ahmed storefront"
PERMISSION = "Factual metadata from the retailer's public gallery. Media and captions are excluded."
CAMPAIGNS = {
    "#1111sale": "11.11 Sale",
    "#wintercharm2026": "Winter Charm 2026",
    "#whispersoftheseason2026": "Whispers of the Season 2026",
}


def _counter(value):
    return value if type(value) is int and value >= 0 else None


def _post(item, observed_at):
    if not isinstance(item, dict) or str(item.get("username", "")).lower() != "gulahmedfashion":
        return None
    link = re.fullmatch(r"https://(?:www\.)?instagram\.com/(p|reel)/([\w-]+)/?", str(item.get("permalink", "")), re.ASCII)
    if not link:
        return None
    try:
        published = datetime.fromisoformat(item["timestamp"])
        if not published.tzinfo:
            return None
    except (ValueError, TypeError, KeyError):
        return None
    media = {"VIDEO": "Video", "IMAGE": "Photo", "CAROUSEL_ALBUM": "Carousel"}.get(item.get("mediaType"), "Post")
    if link[1] == "reel":
        media = "Reel"
    caption = str(item.get("caption") or "").casefold()
    campaign = next((label for tag, label in CAMPAIGNS.items() if tag in caption), "")
    category = ("Lawn" if re.search(r"\blawn\b|#\w*lawn", caption) else
                "Unstitched" if "unstitched" in caption else "Unspecified")
    return {
        "post_id": "instagram:" + link[2], "brand": "Gul Ahmed", "platform": "Instagram",
        "campaign": campaign, "content_type": media, "product_category": category,
        "title": f"{campaign or 'Gul Ahmed'} · {media.lower()} · {published.date().isoformat()}",
        "published_at": published.astimezone(timezone.utc).isoformat(timespec="seconds"),
        "observed_at": observed_at, "source_url": f"https://www.instagram.com/{link[1]}/{link[2]}/",
        "likes": _counter(item.get("likeCount")), "comments_count": _counter(item.get("commentsCount")),
        "shares": None, "views": None, "source": SOURCE, "provenance": "observed", "permission": PERMISSION,
    }


def parse_storefront(html, observed_at):
    posts = {}
    for match in re.finditer(r"\bconst\s+mf\s*=\s*(?=\[)", html):
        try:
            items, _ = json.JSONDecoder().raw_decode(html, match.end())
        except ValueError:
            continue
        for item in items:
            post = _post(item, observed_at)
            if post:
                posts[post["post_id"]] = post
    warnings = [] if posts else ["Gul Ahmed's storefront did not expose a supported public Instagram gallery."]
    return {"posts": list(posts.values()), "comments": [], "warnings": warnings}


def fetch_storefront():
    try:
        request = Request(SITE, headers={"User-Agent": "LawnLens/1.0 (public storefront gallery)", "Accept": "text/html"})
        with urlopen(request, timeout=12) as response:
            if response.headers.get_content_type() != "text/html":
                raise ValueError("Unexpected content type")
            limit = 6 * 1024 * 1024
            body = response.read(limit + 1)
            if len(body) > limit:
                raise ValueError("Page size exceeded")
        return parse_storefront(body.decode("utf-8", errors="replace"),
                                datetime.now(timezone.utc).isoformat(timespec="seconds"))
    except (URLError, TimeoutError, OSError, ValueError):
        return {"posts": [], "comments": [], "warnings": ["Could not refresh Gul Ahmed's public storefront gallery."]}
