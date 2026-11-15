"""Read-only account connectors. The server owns storage and refresh scheduling."""
from __future__ import annotations

from datetime import datetime, timezone
from json import JSONDecodeError
from urllib import error, parse, request
import json
import os
import re
import time


# Channel identities come from the brand sites and Gul Ahmed's annual report.
ACCOUNTS = {
    "Sapphire": ("SAPPHIRE", "sapphirepakistan", "UCvMjM0BkK7SzlYnPTi5CBUQ"),
    "Khaadi": ("KHAADI", "khaadi", "UCosHRi7jeBb0JGZfFlOHYUA"),
    "Gul Ahmed": ("GUL_AHMED", "gulahmedfashion", "UCsAIxl3qvpy1DofpwDEx6Ow"),
}
YT = "YouTube Data API v3"
IG = "Instagram Graph API"
FB = "Facebook Graph API"
TT = "TikTok Display API"
FB_HANDLES = {"Sapphire": "sapphireofficial", "Khaadi": "khaadi", "Gul Ahmed": "gulahmedfashion"}
TT_HANDLES = {"Sapphire": "sapphirepakistan", "Khaadi": "khaadi", "Gul Ahmed": "ideasbygulahmed"}


class ConnectorError(Exception):
    """A diagnostic safe to display, without secrets or arbitrary provider text."""


class ProviderError(ConnectorError):
    def __init__(self, status, reason):
        self.status = status
        self.reason = reason
        if reason in {"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "4", "17", "32", "613"} or status == 429:
            detail = "Provider quota or rate limit reached. Retry after the provider limit resets."
        elif status in {401, 403} or reason in {"190", "10", "200", "keyInvalid", "accessNotConfigured"}:
            detail = "The provider declined access. Check the credential, API activation and account permissions."
        else:
            detail = "Provider request failed."
        super().__init__(f"{detail} HTTP {status} ({reason}).")


class _NoRedirect(request.HTTPRedirectHandler):
    # Credentials must stay on the original HTTPS host.
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _bounded_option(name, default, low, high):
    try:
        value = int(os.environ.get(name, str(default)))
    except ValueError:
        value = default
    return max(low, min(high, value))


def _ig_credentials(prefix):
    return (os.environ.get(f"IG_{prefix}_USER_ID", "").strip(),
            os.environ.get(f"IG_{prefix}_ACCESS_TOKEN", "").strip())


def status():
    ig_accounts = [brand for brand, (prefix, _, _) in ACCOUNTS.items() if all(_ig_credentials(prefix))]
    fb_accounts = [brand for brand, (prefix, _, _) in ACCOUNTS.items()
                   if os.environ.get(f"FB_{prefix}_PAGE_ID") and os.environ.get(f"FB_{prefix}_ACCESS_TOKEN")]
    tt_accounts = [brand for brand, (prefix, _, _) in ACCOUNTS.items() if os.environ.get(f"TIKTOK_{prefix}_ACCESS_TOKEN")]
    yt_key = bool(os.environ.get("YOUTUBE_API_KEY", "").strip())
    approved = os.environ.get("YOUTUBE_ANALYTICS_APPROVED", "").strip() == "1"
    active = bool(yt_key and approved)
    return {
        "configured": bool(ig_accounts or fb_accounts or tt_accounts or active),
        "providers": [
            {"name": "Instagram", "configured": bool(ig_accounts), "brands": ig_accounts,
             "detail": "Owner-authorized professional accounts via Facebook Login."},
            {"name": "Facebook", "configured": bool(fb_accounts), "brands": fb_accounts,
             "detail": "Owner-authorized Facebook Pages and top-level comments."},
            {"name": "TikTok", "configured": bool(tt_accounts), "brands": tt_accounts,
             "detail": "Authorized account video counters. Comment text can be loaded via a permitted export."},
            {"name": "YouTube Data API", "configured": active, "brands": list(ACCOUNTS) if active else [],
             "detail": "Requires server API key and platform authorization covering the intended analytics."},
        ],
        "post_limit": _bounded_option("SYNC_POST_LIMIT", 24, 1, 5000),
        "comment_limit": _bounded_option("SYNC_COMMENTS_PER_POST", 25, 0, 250),
        "comment_post_limit": _bounded_option("SYNC_COMMENT_POST_LIMIT", 8, 0, 100),
    }


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _count(raw):
    if isinstance(raw, bool):
        return None
    if isinstance(raw, int) and raw >= 0:
        return raw
    if isinstance(raw, str) and raw.isascii() and raw.isdecimal():
        return int(raw)
    return None


def _request_json(url, params, headers, body=None):
    req = request.Request(url + "?" + parse.urlencode(params), data=body, headers={
        "User-Agent": "LawnLens/2.0", "Accept": "application/json", **headers})
    opener = request.build_opener(_NoRedirect())
    for attempt in range(2):
        try:
            with opener.open(req, timeout=15) as response:
                body = response.read(6_000_001)
            if len(body) > 6_000_000:
                raise ConnectorError("The provider response exceeded the size limit.")
            data = json.loads(body)
            if not isinstance(data, dict):
                raise ConnectorError("The provider returned an unexpected response.")
            return data
        except error.HTTPError as exc:
            http_code = exc.code
            try:
                payload = json.loads(exc.read(8192)).get("error", {})
                reasons = payload.get("errors") or [{}]
                reason = str(reasons[0].get("reason") or payload.get("code") or "unknown")
                # Only return a known reason. Never propagate text, URLs, or credentials.
                if reason not in {"commentsDisabled", "videoNotFound", "quotaExceeded",
                                  "dailyLimitExceeded", "rateLimitExceeded", "keyInvalid",
                                  "accessNotConfigured", "forbidden"} and not re.fullmatch(r"\d{1,7}", reason):
                    reason = "unknown"
            except (ValueError, TypeError, KeyError, AttributeError, IndexError):
                reason = "unknown"
            finally:
                exc.close()
            if http_code in (500, 502, 503, 504) and attempt == 0:
                time.sleep(.5)
                continue
            raise ProviderError(http_code, reason) from None
        except (TimeoutError, OSError):
            if attempt == 0:
                time.sleep(.5)
                continue
            raise ConnectorError("Provider connection timed out or is unavailable.") from None
        except (JSONDecodeError, UnicodeError):
            raise ConnectorError("The provider returned unreadable JSON.") from None


def _yt(resource, params):
    return _request_json("https://www.googleapis.com/youtube/v3/" + resource, params,
                         {"X-Goog-Api-Key": os.environ["YOUTUBE_API_KEY"].strip()})


def _graph(resource, params, token):
    version = os.environ.get("META_GRAPH_VERSION", "v26.0")
    if not re.fullmatch(r"v[0-9]{1,2}\.[0-9]", version):
        raise ConnectorError("META_GRAPH_VERSION must be a supported version such as v26.0.")
    return _request_json(f"https://graph.facebook.com/{version}/{resource}", params,
                         {"Authorization": "Bearer " + token})


def _pages(fetch, limit, page_size, graph=False):
    """Follow only opaque cursor values. Ignore next URLs containing auth material."""
    seen_cursors = set()
    remaining = limit
    cursor = ""
    while remaining > 0:
        params = {"limit" if graph else "maxResults": min(page_size, remaining)}
        if cursor:
            params["after" if graph else "pageToken"] = cursor
        page = fetch(params)
        rows = page.get("data" if graph else "items")
        if not isinstance(rows, list):
            raise ConnectorError("The provider response did not contain the expected list.")
        timestamp = _now()
        for row in rows[:remaining]:
            yield row, timestamp
        remaining -= len(rows)
        if graph:
            paging = page.get("paging", {})
            cursor = paging.get("cursors", {}).get("after") if paging.get("next") else ""
        else:
            cursor = page.get("nextPageToken")
        if not cursor or not rows:
            break
        if cursor in seen_cursors:
            raise ConnectorError("The provider repeated a page cursor. Previous data retained.")
        seen_cursors.add(cursor)


def _category(title):
    # This is an explicit fabric mention, not an inference from the brand alone.
    return "Lawn" if re.search(r"\blawn\b", title, re.I) else "Unspecified"


def _campaign(title):
    for expression, label in ((r"(?<!\d)11[.]11(?!\d)", "11.11"), (r"(?<!\d)12[.]12(?!\d)", "12.12"),
                              (r"\beid\b", "Eid"), (r"\bram[az]+d?an\b", "Ramadan"),
                              (r"\bsale\b", "Sale")):
        if re.search(expression, title, re.I):
            return label
    return "Unspecified"


def _post(ident, brand, platform, title, published, observed, url, kind, metrics, source):
    api = source == YT
    return {
        "post_id": ident, "brand": brand, "platform": platform, "title": title,
        "campaign": _campaign(title), "product_category": _category(title), "content_type": kind,
        "published_at": published, "observed_at": observed, "source_url": url,
        "likes": _count(metrics.get("likeCount" if api else "like_count")),
        "comments_count": _count(metrics.get("commentCount" if api else "comments_count")),
        "shares": None, "views": _count(metrics.get("viewCount")) if api else None,
        "source": source, "provenance": "observed", "evidence_url": url, "metric_as_of": observed,
        "metric_notes": "Counters as returned by the provider in this observation.",
        "permission": ("YouTube API terms and operator's approved analytics scope."
                       if api else "Owner-authorized account access. Reuse is governed by the owner's permissions and platform terms."),
    }


def _comment(ident, text, published, observed, url, p):
    return {"comment_id": ident, "post_id": p["post_id"], "comment_text": text,
            "published_at": published, "observed_at": observed, "source_url": url, "source": p["source"],
            "provenance": "observed", "permission": p["permission"]}


def _collect_youtube(brand, limits):
    channel_id = ACCOUNTS[brand][2]
    channel = _yt("channels", {"part": "contentDetails", "id": channel_id})
    channels = [c for c in channel.get("items", []) if c.get("id") == channel_id]
    if not channels:
        raise ConnectorError("The configured official channel could not be found.")
    uploads = channels[0].get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    if not uploads:
        raise ConnectorError("The official channel has no accessible uploads playlist.")
    ids = []
    for item, _ in _pages(lambda p: _yt("playlistItems", {"part": "contentDetails", "playlistId": uploads, **p}),
                          limits["post_limit"], 50):
        ident = item.get("contentDetails", {}).get("videoId", "")
        if re.fullmatch(r"[0-9A-Za-z_-]{11}", ident):
            ids.append(ident)
    ids = list(dict.fromkeys(ids))
    posts, comments, warnings = [], [], []
    for offset in range(0, len(ids), 50):
        batch = ids[offset:offset + 50]
        page = _yt("videos", {"part": "snippet,statistics", "id": ",".join(batch)})
        stamp = _now()
        items = {item.get("id"): item for item in page.get("items", [])}
        for ident in batch:
            item = items.get(ident, {})
            snippet = item.get("snippet", {})
            if snippet.get("channelId") != channel_id:
                continue  # A private or removed video can disappear between these two requests.
            posts.append(_post("youtube:" + ident, brand, "YouTube", snippet.get("title", ""),
                               snippet.get("publishedAt", ""), stamp, "https://www.youtube.com/watch?v=" + ident,
                               "Video", item.get("statistics", {}), YT))
    disabled = 0
    for p in posts[:limits["comment_post_limit"]]:
        if p["comments_count"] == 0:
            continue
        ident = p["post_id"].split(":", 1)[1]
        try:
            rows = _pages(lambda params: _yt("commentThreads", {"part": "snippet", "videoId": ident,
                          "order": "time", "textFormat": "plainText", **params}), limits["comment_limit"], 100)
            for item, stamp in rows:
                top = item.get("snippet", {}).get("topLevelComment", {})
                detail = top.get("snippet", {})
                cid, body = top.get("id"), detail.get("textDisplay")
                if cid and body:
                    comments.append(_comment("youtube:" + cid, body, detail.get("publishedAt", ""), stamp,
                                             p["source_url"] + "&lc=" + parse.quote(cid, safe=""), p))
        except ProviderError as exc:
            if exc.reason not in {"commentsDisabled", "videoNotFound"}:
                raise
            disabled += 1
    if disabled:
        warnings.append(f"{brand}: comment threads are disabled or unavailable for {disabled} YouTube video(s).")
    return posts, comments, warnings


def _collect_instagram(brand, limits):
    prefix, expected_username, _ = ACCOUNTS[brand]
    uid, token = _ig_credentials(prefix)
    if not re.fullmatch(r"[0-9]{1,32}", uid):
        raise ConnectorError("Instagram professional account ID must be numeric.")
    account = _graph(uid, {"fields": "id,username"}, token)
    if str(account.get("id")) != uid or str(account.get("username", "")).casefold() != expected_username:
        raise ConnectorError("The authorized Instagram account does not match the configured brand.")
    fields = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count"
    posts, comments = [], []
    media = _pages(lambda params: _graph(uid + "/media", {"fields": fields, **params}, token),
                   limits["post_limit"], 50, graph=True)
    media_ids = []
    for row, stamp in media:
        url = row.get("permalink", "")
        parsed = parse.urlsplit(url)
        shortcode = re.fullmatch(r"/(?:p|reel|tv)/([a-zA-Z0-9_-]+)/?", parsed.path)
        if parsed.scheme != "https" or parsed.hostname not in {"instagram.com", "www.instagram.com"} or not shortcode:
            continue
        media_id = str(row.get("id", ""))
        if not re.fullmatch(r"[0-9]{1,32}", media_id):
            continue
        kind = {"IMAGE": "Photo", "VIDEO": "Video", "CAROUSEL_ALBUM": "Carousel"}.get(row.get("media_type"), "Unspecified")
        if row.get("media_product_type") == "REELS":
            kind = "Reel"
        caption = " ".join(str(row.get("caption") or "").split())
        posts.append(_post("instagram:" + shortcode[1], brand, "Instagram", caption, row.get("timestamp", ""),
                           stamp, "https://www.instagram.com" + parsed.path, kind, row, IG))
        media_ids.append(media_id)
    for p, mid in list(zip(posts, media_ids))[:limits["comment_post_limit"]]:
        if p["comments_count"] == 0:
            continue
        rows = _pages(lambda params: _graph(mid + "/comments", {"fields": "id,text,timestamp", **params}, token),
                      limits["comment_limit"], 50, graph=True)
        for row, stamp in rows:
            if row.get("id") and row.get("text"):
                comments.append(_comment("instagram:" + str(row["id"]), row["text"], row.get("timestamp", ""),
                                         stamp, p["source_url"], p))
    return posts, comments, []


def _collect_facebook(brand, limits):
    prefix = ACCOUNTS[brand][0]
    page_id = os.environ[f"FB_{prefix}_PAGE_ID"].strip()
    token = os.environ[f"FB_{prefix}_ACCESS_TOKEN"].strip()
    if not re.fullmatch(r"[0-9]{1,32}", page_id):
        raise ConnectorError("Facebook Page ID must be numeric.")
    account = _graph("me", {"fields": "id,username"}, token)
    if str(account.get("id")) != page_id or str(account.get("username", "")).casefold() != FB_HANDLES[brand]:
        raise ConnectorError("The authorized Facebook Page does not match the configured brand.")
    fields = ("id,message,permalink_url,created_time,shares,attachments{media_type},"
              "reactions.type(LIKE).limit(0).summary(total_count).as(likes_only),comments.limit(0).summary(total_count)")
    rows = _pages(lambda params: _graph(page_id + "/published_posts", {"fields": fields, **params}, token),
                  limits["post_limit"], 50, graph=True)
    posts, comments = [], []
    for row, stamp in rows:
        ident = str(row.get("id", ""))
        url = row.get("permalink_url", "")
        parsed = parse.urlsplit(url)
        if (not re.fullmatch(page_id + r"_[0-9]{1,32}", ident) or parsed.scheme != "https"
                or parsed.hostname not in {"facebook.com", "www.facebook.com", "m.facebook.com"}):
            continue
        attachments = (row.get("attachments") or {}).get("data") or [{}]
        media = {"video": "Video", "photo": "Photo", "album": "Carousel"}.get(attachments[0].get("media_type"), "Post")
        metrics = {"like_count": (row.get("likes_only") or {}).get("summary", {}).get("total_count"),
                   "comments_count": (row.get("comments") or {}).get("summary", {}).get("total_count")}
        p = _post("facebook:" + ident, brand, "Facebook", row.get("message") or "", row.get("created_time", ""),
                  stamp, url, media, metrics, FB)
        p["shares"] = _count((row.get("shares") or {}).get("count"))
        posts.append(p)
    for p in posts[:limits["comment_post_limit"]]:
        if p["comments_count"] == 0:
            continue
        ident = p["post_id"].split(":", 1)[1]
        rows = _pages(lambda params: _graph(ident + "/comments", {"fields": "id,message,created_time",
                      "filter": "toplevel", **params}, token), limits["comment_limit"], 50, graph=True)
        for row, stamp in rows:
            if row.get("id") and row.get("message"):
                comments.append(_comment("facebook:" + str(row["id"]), row["message"], row.get("created_time", ""),
                                         stamp, p["source_url"], p))
    return posts, comments, []


def _collect_tiktok(brand, limits):
    token = os.environ[f"TIKTOK_{ACCOUNTS[brand][0]}_ACCESS_TOKEN"].strip()
    headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
    def endpoint(path, fields, payload=None):
        data = _request_json("https://open.tiktokapis.com/v2/" + path, {"fields": fields}, headers,
                             json.dumps(payload).encode() if payload is not None else None)
        if data.get("error", {}).get("code") != "ok" or not isinstance(data.get("data"), dict):
            raise ConnectorError("TikTok did not complete the request. Check video.list, user.info.profile, token expiry and quota.")
        return data["data"]

    handle = endpoint("user/info/", "username").get("user", {}).get("username", "")
    if str(handle).casefold() != TT_HANDLES[brand]:
        raise ConnectorError("The authorized TikTok account does not match the configured brand.")
    fields = "id,title,video_description,create_time,like_count,comment_count,share_count,view_count"
    posts, cursor, seen_cursors = [], None, set()
    for _ in range(1 + (limits["post_limit"] + 19) // 20 + 10):
        remaining = limits["post_limit"] - len(posts)
        if remaining <= 0:
            break
        body = {"max_count": min(20, remaining)}
        if cursor is not None:
            body["cursor"] = cursor
        page = endpoint("video/list/", fields, body)
        stamp = _now()
        if not isinstance(page.get("videos"), list):
            raise ConnectorError("TikTok returned an incomplete video list.")
        for video in page["videos"][:remaining]:
            ident = str(video.get("id") or "")
            if not re.fullmatch(r"[0-9]{1,32}", ident):
                continue
            published = ""
            epoch = _count(video.get("create_time"))
            if epoch is not None:
                published = datetime.fromtimestamp(epoch, timezone.utc).isoformat().replace("+00:00", "Z")
            title = video.get("title") or video.get("video_description") or ""
            metrics = {"like_count": video.get("like_count"), "comments_count": video.get("comment_count")}
            post = _post("tiktok:" + ident, brand, "TikTok", title, published, stamp,
                         f"https://www.tiktok.com/@{handle}/video/{ident}", "Video", metrics, TT)
            post.update(views=_count(video.get("view_count")), shares=_count(video.get("share_count")))
            posts.append(post)
        if not page.get("has_more"):
            break
        cursor = page.get("cursor")
        if not isinstance(cursor, int) or cursor in seen_cursors:
            raise ConnectorError("TikTok returned an invalid page cursor.")
        seen_cursors.add(cursor)
    else:
        raise ConnectorError("TikTok pagination did not complete within the request budget.")
    return posts, [], []


def sync(*, providers=None, brands=None):
    """Read configured streams. Each successful result is a complete bounded observation window."""
    settings = status()
    if not settings["configured"]:
        raise ConnectorError("No authorized API account is configured.")
    result = {"posts": [], "comments": [], "warnings": [], "completed_providers": [], "completed_streams": []}
    for provider in settings["providers"]:
        if not provider["configured"] or (providers and provider["name"] not in providers):
            continue
        source, collect = {"Instagram": (IG, _collect_instagram), "YouTube Data API": (YT, _collect_youtube),
                           "Facebook": (FB, _collect_facebook), "TikTok": (TT, _collect_tiktok)}[provider["name"]]
        for brand in provider["brands"]:
            if brands and brand not in brands:
                continue
            try:
                posts, comments, warnings = collect(brand, settings)
                result["posts"].extend(posts)
                result["comments"].extend(comments)
                result["warnings"].extend(warnings)
                result["completed_streams"].append({"source": source, "brand": brand})
                if source not in result["completed_providers"]:
                    result["completed_providers"].append(source)
            except ConnectorError as exc:
                result["warnings"].append(f"{brand} · {source}: {exc}")
                if source == YT and isinstance(exc, ProviderError) and exc.reason in {"quotaExceeded", "dailyLimitExceeded"}:
                    break
    if not result["completed_streams"]:
        raise ConnectorError(" ".join(result["warnings"]) or "No configured API account matched the selected platform and brand.")
    # A provider page can move as new comments arrive during pagination.
    result["comments"] = list({c["comment_id"]: c for c in result["comments"]}.values())
    result["posts"] = list({p["post_id"]: p for p in result["posts"]}.values())
    return result
