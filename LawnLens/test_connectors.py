"""Offline contract tests. Simulated provider responses stay in these tests."""
import json
import os
import unittest
from unittest.mock import patch

import connectors as c


class ConnectorsTest(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict(os.environ, {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_public_status_never_contains_secrets(self):
        os.environ["YOUTUBE_API_KEY"] = "not-a-real-key"
        self.assertFalse(c.status()["configured"])
        with self.assertRaises(c.ConnectorError):
            c.sync()
        os.environ["YOUTUBE_ANALYTICS_APPROVED"] = "1"
        self.assertTrue(c.status()["configured"])
        self.assertNotIn("not-a-real-key", json.dumps(c.status()))

    def test_instagram_owner_sampling_and_pagination(self):
        os.environ.update(IG_SAPPHIRE_USER_ID="123", IG_SAPPHIRE_ACCESS_TOKEN="test-secret")
        calls = []

        def reply(resource, params, token):
            calls.append((resource, params))
            if resource == "123":
                return {"id": "123", "username": "SapphirePakistan"}
            if resource == "123/media":
                return {"data": [{"id": "45", "media_product_type": "REELS", "media_type": "VIDEO",
                                  "timestamp": "2020-01-01T03:00:00+0000", "caption": "Eid lawn collection",
                                  "permalink": "https://www.instagram.com/reel/abc/", "like_count": 0,
                                  "comments_count": 4}]}
            self.assertEqual(resource, "45/comments")
            if "after" not in params:
                return {"data": [{"id": "339", "text": "test text", "timestamp": "2020-01-01T03:01:00+0000"}],
                        "paging": {"next": "https://malicious.invalid/?token=example", "cursors": {"after": "opaque"}}}
            self.assertEqual(params["after"], "opaque")
            return {"data": [{"id": "340", "text": "another test", "timestamp": "2020-01-01T03:02:00+0000"}]}

        with patch.object(c, "_graph", reply):
            result = c.sync()
        post, = result["posts"]
        self.assertEqual(post["post_id"], "instagram:abc")
        self.assertEqual(post["product_category"], "Lawn")
        self.assertEqual(post["campaign"], "Eid")
        self.assertEqual(post["content_type"], "Reel")
        self.assertEqual(post["likes"], 0)
        self.assertIsNone(post["views"])
        self.assertNotEqual(post["published_at"], post["observed_at"])
        self.assertEqual(len(result["comments"]), 2)
        self.assertEqual(result["completed_streams"], [{"brand": "Sapphire", "source": c.IG}])
        self.assertNotIn("malicious", json.dumps(calls))

    def test_rejects_wrong_account(self):
        os.environ.update(IG_SAPPHIRE_USER_ID="123", IG_SAPPHIRE_ACCESS_TOKEN="test-secret")
        with patch.object(c, "_graph", return_value={"id":"123","username":"another_handle"}), self.assertRaisesRegex(c.ConnectorError, "does not match"):
            c.sync()

    def test_youtube_missing_counts_and_disabled_comments(self):
        os.environ.update(YOUTUBE_API_KEY="test-key", YOUTUBE_ANALYTICS_APPROVED="1")
        ident = "d1TESTvideo"
        channel_id = c.ACCOUNTS["Khaadi"][2]
        def fake(resource, params):
            if resource == "channels":
                return {"items": [{"id": channel_id, "contentDetails": {"relatedPlaylists": {"uploads": "UU_test"}}}]}
            if resource == "playlistItems":
                return {"items": [{"contentDetails": {"videoId": ident}}]}
            if resource == "videos":
                return {"items": [{"id": ident, "snippet": {"channelId": channel_id, "title": "Lawn",
                                  "publishedAt": "2020-01-01T01:01:00Z"}, "statistics": {"viewCount": "0"}}]}
            if resource == "commentThreads":
                raise c.ProviderError(403, "commentsDisabled")
            self.fail(resource)
        with patch.object(c, "_yt", fake):
            result = c.sync()
        self.assertEqual(len(result["posts"]), 1)
        self.assertEqual(result["posts"][0]["views"], 0)
        self.assertIsNone(result["posts"][0]["likes"])
        self.assertEqual(result["completed_streams"], [{"source": c.YT, "brand": "Khaadi"}])
        self.assertTrue(any("disabled" in item for item in result["warnings"]))

    def test_quota_aborts_remaining_youtube_calls(self):
        os.environ.update(YOUTUBE_API_KEY="test-key", YOUTUBE_ANALYTICS_APPROVED="1")
        with patch.object(c, "_yt", side_effect=c.ProviderError(403, "quotaExceeded")) as api:
            with self.assertRaisesRegex(c.ConnectorError, "quota"):
                c.sync()
            self.assertEqual(api.call_count, 1)

    def test_facebook_exposes_like_only_summary(self):
        os.environ.update(FB_KHAADI_PAGE_ID="123", FB_KHAADI_ACCESS_TOKEN="test-token")
        def fake(resource, params, token):
            if resource == "me":
                return {"id": "123", "username": "Khaadi"}
            self.assertIn(".type(LIKE)", params["fields"])
            return {"data": [{"id":"123_99", "message":"Post", "permalink_url":"https://www.facebook.com/khaadi/posts/99",
                              "likes_only":{"summary":{"total_count":1}}, "comments":{"summary":{"total_count":0}}}]}
        with patch.object(c, "_graph", fake):
            posts = c.sync()["posts"]
        self.assertEqual(posts[0]["likes"], 1)
        self.assertIsNone(posts[0]["shares"])

    def test_tiktok_reads_authorized_video_metrics(self):
        os.environ["TIKTOK_SAPPHIRE_ACCESS_TOKEN"] = "secret-for-test"
        def fake(url, params, headers, body):
            self.assertNotIn("secret-for-test", url)
            if url.endswith("user/info/"):
                return {"data":{"user":{"username":"sapphirepakistan"}},"error":{"code":"ok"}}
            self.assertLessEqual(json.loads(body)["max_count"], 20)
            return {"data":{"videos":[{"id":"1234","title":"Lawn","create_time":1700000000,
                    "like_count":0,"comment_count":3,"share_count":2,"view_count":50}],"has_more":False},
                    "error":{"code":"ok"}}
        with patch.object(c, "_request_json", fake):
            result = c.sync()
        self.assertEqual(result["comments"], [])
        self.assertEqual(result["posts"][0]["shares"], 2)
        self.assertEqual(result["posts"][0]["published_at"], "2023-11-14T22:13:20Z")


if __name__ == "__main__":
    unittest.main()
