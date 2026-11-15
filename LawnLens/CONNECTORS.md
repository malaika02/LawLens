# Connect brand accounts

The public-source dashboard works without account credentials. The optional connectors below read authorized brand data when your account has the relevant access. Use the Python collector to export observations from all four platforms. The website also supports live Instagram owner access through its server or Worker. Configure accounts you manage, then run the collector or set the server credentials and request an Instagram refresh in the website.

| Source | Post measurements | Comment sample | Environment |
| --- | --- | --- | --- |
| Instagram Graph API | Like and comment counts when returned, media type, title from caption, post time and permalink | Top-level text from authorized media | Python or Worker |
| Facebook Graph API | LIKE reaction count, reported comment count and shares when returned, post format, message and permalink | Top-level Page-post comments | Python |
| TikTok Display API | Likes, comments, shares, views and post time | Video totals only. Use an authorized export for comment text. | Python |
| YouTube Data API v3 | Public video views, likes and comment totals when returned | Most recent top-level comments | Python, with applicable YouTube authorization |

## Instagram and Facebook

1. Configure a Meta app with **Instagram API with Facebook Login** for an Instagram Business or Creator account linked to a Facebook Page. Have a person who manages the brand complete Facebook Login. For the fields this reader uses, request the applicable read permissions, including `instagram_basic`, `pages_read_engagement` and `instagram_manage_comments`. Facebook Page comment text can also require `pages_read_user_content`. Discovery of managed Pages uses `pages_show_list`. Complete Meta's access review if required for accounts beyond the app's assigned roles.
2. In Meta's API tools, request `GET /me/accounts?fields=id,access_token,instagram_business_account` with the authorizing user's access token. Select the brand's own Page. Its `id` is the Facebook Page ID, its `access_token` is the Page token and `instagram_business_account.id` is the Instagram professional account ID.
3. For Instagram, set `IG_KHAADI_USER_ID` and `IG_KHAADI_ACCESS_TOKEN` in the collector or server environment. For Facebook, set `FB_KHAADI_PAGE_ID` and `FB_KHAADI_ACCESS_TOKEN`. Repeat with `SAPPHIRE` or `GUL_AHMED` in place of `KHAADI` when authorized for those accounts. Keep tokens in the server environment or Worker secrets. The connectors check the returned ID and account username before assigning rows to a brand.
4. Set `META_GRAPH_VERSION` to a supported version enabled for your app if required. The reader defaults to `v26.0`. Use refreshed tokens when the provider-reported access expires. The server only performs reads.

[Meta's account setup, permissions and login examples](https://www.postman.com/meta/instagram/collection/6yqw8pt/instagram-api) · [Instagram media fields](https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/) · [Published Page posts](https://developers.facebook.com/docs/graph-api/reference/page/published_posts/) · [Page feed and access](https://developers.facebook.com/docs/graph-api/reference/page/feed/)

## TikTok

Use an approved TikTok application and complete Login Kit authorization for the brand with `user.info.profile` and `video.list`. Supply the resulting user access token in `TIKTOK_SAPPHIRE_ACCESS_TOKEN`, `TIKTOK_KHAADI_ACCESS_TOKEN` or `TIKTOK_GUL_AHMED_ACCESS_TOKEN`. Your app's approved use and the account owner's permission should cover the analysis you perform. Refresh OAuth credentials through your TikTok application before expiry. The reader checks `/v2/user/info/` against the expected handle and reads the authorized user's public video list in publication order. A displayed comment count alone supplies no text for clustering.

[Get started with Display API](https://developers.tiktok.com/docs/en/display-api-get-started) · [User fields and scopes](https://developers.tiktok.com/docs/en/tiktok-api-v2-get-user-info) · [Video fields](https://developers.tiktok.com/docs/en/tiktok-api-v2-video-object)

## YouTube Data API

Enable YouTube Data API v3 on your Google Cloud project and provision a server-side API key restricted to that API. Official channel IDs are pinned below. The Python connector walks each channel's uploads playlist, fetches statistics in batches of up to 50 video IDs and requests top-level comment text where available.

| Brand | Official channel |
| --- | --- |
| Sapphire | [UCvMjM0BkK7SzlYnPTi5CBUQ](https://www.youtube.com/channel/UCvMjM0BkK7SzlYnPTi5CBUQ) |
| Khaadi | [UCosHRi7jeBb0JGZfFlOHYUA](https://www.youtube.com/channel/UCosHRi7jeBb0JGZfFlOHYUA) |
| Gul Ahmed | [UCsAIxl3qvpy1DofpwDEx6Ow](https://www.youtube.com/channel/UCsAIxl3qvpy1DofpwDEx6Ow) |

YouTube restricts the creation of new or derived metrics from Data API data. Its additional analytics permissions apply only to the scope YouTube actually grants. Once the grant covers the intended analytics, storage and use of this data, supply `YOUTUBE_API_KEY` and set `YOUTUBE_ANALYTICS_APPROVED=1`. This switch records the operator's configuration. YouTube issues the permission. Use exports or redistribution only within the applicable grant and content rights.

[Developer policies, including sections III.E and III.L](https://developers.google.com/youtube/terms/developer-policies) · [Uploads playlist requests](https://developers.google.com/youtube/data/sample_requests) · [Comment sampling and disabled comments](https://developers.google.com/youtube/data/reference/rest/v3/commentThreads/list) · [API keys](https://docs.cloud.google.com/docs/authentication/api-keys-use)

## Collect the project dataset

From the folder containing `collect.py`, run the Python 3.10+ collector with credentials in the process environment. It uses Python’s standard library. The first command reads the default windows for every configured account.

```sh
python collect.py
```

For the class target, this invocation requests up to 2,500 available posts **per authorized Instagram account**, and up to 25 comments on each of its first 100 returned posts. Run it once as a historical collection, subject to your API access and rate limits. The same flags work for Facebook, TikTok and eligible YouTube accounts. TikTok's Display API can supply comment counts only. Inspect the emitted counts to establish how many posts and comments were actually available.

```sh
python collect.py --platform Instagram --posts 2500 --comment-posts 100 --comments 25 --output exports/coursework-01
```

`--brand Khaadi` restricts the run to one brand. Repeat the `--brand` or `--platform` flags to select more. By default the export uses a fresh timestamped directory. The output contains `import_posts.csv`, `import_comments.csv` and a collection log recording successful streams and provider errors. Import the two related CSVs together through the website. Published post IDs serve as the join keys. The tables use UTF-8 for Urdu, preserve multiline quoted text, and represent missing metrics with empty cells. Keep the collection log with your analysis.

A request for 2,500 records can yield fewer eligible posts, and multiple authorized accounts can contribute to a common corpus. Each post window contains at most the newest/first accessible rows returned by the provider. Repeating the same request does not produce additional newly observed posts if upstream content did not change. Comments retrieved are public top-level text returned for the underlying sampled posts. TikTok comment-text exports can be imported separately using the same post IDs.

## Coverage and timing

The default Python collection window is 24 posts per account per refresh. Up to eight posts per account are considered for up to 25 top-level comments each. Increase `SYNC_POST_LIMIT` (1–5,000 per account), `SYNC_COMMENT_POST_LIMIT` (0–100) or `SYNC_COMMENTS_PER_POST` (0–250) when your access and quota support historical collection. For a post-only update set the comment-post limit to zero. A channel's supply of eligible posts or a platform quota may limit the actual rows. YouTube and TikTok APIs offer ordered listing modes; Meta returns its own cursor order. Treat the collected comments as a sample of commenters.

The Worker reads up to 24 posts from each connected Instagram account and considers the first six returned posts for up to 25 top-level comments each. It caps Graph requests at 14 per brand in one refresh. Subscription webhooks are outside this implementation. Polling captures provider values as of each HTTP response; reporting delays vary by platform. The public source link remains on every record.

Blank metrics represent unavailable values, while an explicit zero is preserved. Campaign and product labels use words in the post title or caption, so an unlabeled post remains unspecified. A post labeled “Lawn” explicitly mentions lawn and can cover more than one garment or audience. Each completed account window has its own observation timestamps. A denied scope, expired token, rate limit, timeout or failed account check generates a diagnostic. Review the last successful timestamps before interpreting stale results.
