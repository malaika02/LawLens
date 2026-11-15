"""Export official provider observations to the import schema used by the website."""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import sys
import tempfile

from connectors import ACCOUNTS, ConnectorError, sync


POSTS = "post_id brand platform campaign content_type product_category title published_at observed_at source_url likes comments_count shares views source provenance permission evidence_url metric_as_of metric_notes".split()
COMMENTS = "comment_id post_id comment_text published_at observed_at source_url source provenance permission".split()
PLATFORMS = ("Instagram", "Facebook", "TikTok", "YouTube Data API")


def integer_range(low, high):
    def parse(raw):
        try:
            number = int(raw)
        except ValueError:
            raise argparse.ArgumentTypeError("Enter a whole number.") from None
        if not low <= number <= high:
            raise argparse.ArgumentTypeError(f"Enter a number from {low} to {high}.")
        return number
    return parse


def write_csv(path, fields, rows):
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def publish_bundle(destination, data):
    """Publish both related tables together. Never merge with an older export."""
    destination = destination.absolute()
    destination.parent.mkdir(parents=True, exist_ok=True)
    # mkdir is exclusive even when two collectors finish in the same second.
    destination.mkdir()
    try:
        with tempfile.TemporaryDirectory(prefix=".collect-", dir=destination.parent) as temporary:
            directory = Path(temporary)
            write_csv(directory / "import_posts.csv", POSTS, data["posts"])
            write_csv(directory / "import_comments.csv", COMMENTS, data["comments"])
            warnings = data["warnings"]
            with (directory / "collection.txt").open("w", encoding="utf-8") as log:
                log.write(f"Exported at {datetime.now(timezone.utc).isoformat()}\n")
                for stream in data["completed_streams"]:
                    log.write(f"Completed: {stream['brand']} | {stream['source']}\n")
                log.write(f"{len(data['posts'])} posts, {len(data['comments'])} sampled top-level comments.\n")
                for warning in warnings:
                    log.write(f"Collection note: {warning}\n")
            for name in ("import_posts.csv", "import_comments.csv", "collection.txt"):
                os.replace(directory / name, destination / name)
    except BaseException:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, help="New export directory. Default: a dated directory in exports/.")
    parser.add_argument("--platform", choices=PLATFORMS, action="append", help="Repeat to select several configured providers.")
    parser.add_argument("--brand", choices=list(ACCOUNTS), action="append", help="Repeat for multiple authorized brands.")
    parser.add_argument("--posts", type=integer_range(1, 5000), help="Maximum posts per account.")
    parser.add_argument("--comment-posts", type=integer_range(0, 100), help="First returned posts per account considered for comment collection.")
    parser.add_argument("--comments", type=integer_range(0, 250), help="Maximum top-level comments per selected post.")
    args = parser.parse_args(argv)
    default_name = datetime.now(timezone.utc).strftime("observations-%Y%m%dT%H%M%S%fZ")
    destination = args.output or Path("exports") / default_name
    if destination.exists() or destination.is_symlink():
        parser.exit(2, "Choose a new output directory. The existing export was preserved.\n")
    for value, name in ((args.posts, "SYNC_POST_LIMIT"), (args.comment_posts, "SYNC_COMMENT_POST_LIMIT"),
                        (args.comments, "SYNC_COMMENTS_PER_POST")):
        if value is not None:
            os.environ[name] = str(value)
    try:
        result = sync(providers=args.platform, brands=args.brand)
        publish_bundle(destination, result)
    except (ConnectorError, OSError) as exc:
        print(f"Collection did not finish: {exc}", file=sys.stderr)
        return 1
    print(f"{len(result['posts'])} posts and {len(result['comments'])} sampled comments saved to {destination}.")
    for warning in result["warnings"]:
        print(f"Collection note: {warning}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
