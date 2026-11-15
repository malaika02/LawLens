import contextlib
import csv
import io
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch
import collect


class ExportTest(unittest.TestCase):
    def test_empty_tables_remain_importable_and_existing_files_preserved(self):
        data = {"posts": [], "comments": [], "warnings": ["One provider did not complete."],
                "completed_streams": [{"brand": "Khaadi", "source": "Instagram Graph API"}]}
        with tempfile.TemporaryDirectory() as temp:
            output = Path(temp)/"export"
            with patch.object(collect, "sync", return_value=data) as call, contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                status = collect.main(["--output", str(output), "--platform", "Instagram", "--brand", "Khaadi"])
                self.assertEqual(status, 0)
                call.assert_called_once_with(providers=["Instagram"], brands=["Khaadi"])
                with self.assertRaises(SystemExit):
                    collect.main(["--output", str(output)])
            for filename, schema in (("import_posts.csv", collect.POSTS), ("import_comments.csv", collect.COMMENTS)):
                with (output/filename).open() as stream:
                    reader = csv.DictReader(stream)
                    self.assertEqual(reader.fieldnames, schema)
                    self.assertEqual(list(reader), [])
            self.assertIn("did not complete", (output/"collection.txt").read_text())

    def test_joined_ids_and_missing_metrics_survive_csv(self):
        with tempfile.TemporaryDirectory() as temp:
            dest = Path(temp)/"export"
            posts = [{"post_id":"sample:p1","likes":0,"views":None,"title":'Example, with "quotes"'}]
            comments = [{"post_id":"sample:p1","comment_id":"sample:c1","comment_text":"ٹیسٹ\nsecond line"}]
            collect.publish_bundle(dest, {"posts": posts, "comments": comments,"warnings":[],"completed_streams":[]})
            with (dest / "import_posts.csv").open() as stream:
                row, = csv.DictReader(stream)
            with (dest / "import_comments.csv").open() as stream:
                c, = csv.DictReader(stream)
            self.assertEqual((row["likes"],row["views"]),("0",""))
            self.assertEqual((row["post_id"],row["title"]),("sample:p1",posts[0]["title"]))
            self.assertEqual(c["comment_text"],comments[0]["comment_text"])
            self.assertEqual(c["post_id"],row["post_id"])
