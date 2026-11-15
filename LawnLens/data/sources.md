# Observed Pakistani fashion campaign data

The November 15, 2026 starter snapshot has 212 published post or thread records and 11 short audience-comment observations from two historical threads. Records refer to Sapphire (47), Khaadi (68) and Gul Ahmed (97). Thirty-two posts explicitly feature lawn. The remaining rows cover adjacent Pakistani apparel campaigns, including winter unstitched fabric, ready-to-wear and an 11.11 sale. Use the product category filter to study lawn alone. The sample is neither random nor a complete catalogue of any account.

## Provenance and coverage

| Source in CSV | Posts | What was actually observed |
|---|---:|---|
| YouTube public feed | 45 | The 15 most recently syndicated entries in each of the three brand channel feeds. Video identifiers, publication timestamps, links, titles and the integer view counter came from the feeds. Retrieved November 15, 2026 around 16:31 UTC. |
| Gul Ahmed storefront | 25 | All 25 eligible Instagram entries shown in the retailer's own public gallery. Each linked to an Instagram permalink with publisher username gulahmedfashion. The widget supplied the post timestamp, likes and comment count. Fetched on November 15 around 16:31 UTC. The retailer does not give the synchronization time of its Instagram counters. |
| Archived YouTube public feed | 106 | Nine dated Internet Archive captures of the three official YouTube feeds supplied 135 entries. We included 106 distinct videos after excluding 29 obvious unrelated items such as fragrances, homeware, men’s collections, and store announcements. IDs, channel identity, capture date, publication time and numeric views were verified against each archived feed. |
| Archived Gul Ahmed storefront | 25 | An October 8, 2026 Internet Archive capture of the official storefront contained 25 unique Instagram reels by gulahmedfashion. Post URLs and displayed likes and comment totals come from that captured page. |
| Indexed YouTube archive | 9 | Nine previously published lawn campaign videos from the brand accounts. The public watch-page search results reported the calendar publication date, views and, in eight cases, likes. The source was consulted November 15. The exact counter observation dates were unavailable. Treat these as archived, non-contemporaneous values. |
| Reviewit.pk screenshot · April 2024 | 1 | A screenshot of Sapphire's own Instagram notice about summer sale website downtime shows 94 likes and 84 comments. Seven short excerpts were transcribed from three screenshots of that post's thread. The observation values are historical. The journalist selected which comments to show. |
| GSJ screenshot · May 2019 | 1 | One reproduced Khaadi Facebook thread contains four distinct price inquiries. The authors did not reproduce the parent post, campaign identifier, platform permalink, total comment count or absolute timestamps. The local thread ID groups these four comments and does not identify a Facebook post ID. |

The original comment excerpts preserve the displayed words and case where legible. Each row links to its screenshot or source figure. Excerpts may omit surrounding text. Private account details, author handles, images and complete captions are excluded. Editorial titles of Instagram posts describe the campaign or pictured notice. Counts reflect the source's reported precision. Unknown metrics and dates are empty CSV cells. A displayed zero is retained as zero. The feed's rating count is omitted because it is not labelled as a like count.

The original-link column points to the social post where known. The evidence URL on every archival feed and gallery row identifies the actual document captured. Aggregate charts that span several sources or ages must be interpreted as observations from different points in time.

### Original sources

- [Sapphire channel feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCvMjM0BkK7SzlYnPTi5CBUQ) and [Sapphire's Pakistani storefront](https://pk.sapphireonline.pk/).
- [Khaadi channel feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCosHRi7jeBb0JGZfFlOHYUA) and [Khaadi's official storefront](https://uk.khaadi.com/).
- [Gul Ahmed channel feed](https://www.youtube.com/feeds/videos.xml?channel_id=UCsAIxl3qvpy1DofpwDEx6Ow), [Gul Ahmed's corporate annual report](https://gulahmed.com/wp/wp-content/uploads/2024/10/Annual_report_2024.pdf) and [the retailer's public Instagram gallery on its own home page](https://www.gulahmedshop.com/).
- The archived lawn videos' individual publisher URLs are in the post CSV. Representative examples include [Gul Ahmed's Summer Lawn Essential Collection 2024](https://www.youtube.com/watch?v=disUHTdkNT0), [Khaadi's The Print Story](https://www.youtube.com/watch?v=FvtYCQHMCrw) and [Sapphire's Unstitched Summer 2025](https://www.youtube.com/watch?v=vD4o79ThLKw).
- Sidra Ijaz, Reviewit.pk, April 24, 2024. The four images after the official notice show its public comment thread. See the source URLs in the CSV for the three images used. [Article and original screenshots](https://reviewit.pk/public-calls-sapphire-online-sale-a-fraud/).
- Afrah Zahid, “Effectiveness of Content Branding Strategies on Social Media: A Study of Khaadi,” Global Scientific Journal, May 2019, printed p. 793 (PDF p. 17). The four comments were transcribed from the figure. Khaadi's replies and Facebook's suggested questions were excluded. [Original figure](https://www.globalscientificjournal.com/researchpaper/_Effectiveness_of_Content_Branding_Strategies_on_Social_Media_A_Study_of_Khaadi_.pdf#page=17).

- Dated source captures cover three Sapphire, four Khaadi and two Gul Ahmed official feeds, plus the Gul Ahmed retailer gallery. See the per-row evidence URL, for example the [Gul Ahmed feed on 21 February 2025](https://web.archive.org/web/20250221181413id_/https://www.youtube.com/feeds/videos.xml?channel_id=UCsAIxl3qvpy1DofpwDEx6Ow) and the [retailer gallery on 8 October 2026](https://web.archive.org/web/20261008174537id_/https://www.gulahmedshop.com/).

## Reading the fields

| Field | Meaning |
|---|---|
| post_id, comment_id | Join keys. Feed and storefront IDs use platform identifiers. Archive IDs are local references. |
| brand, platform, campaign | Publisher and platform plus the collection, sale or campaign where identifiable. A missing campaign indicates insufficient evidence. |
| title, content_type, product_category | Publisher's video title or editorial post label, media format and broad content category. A campaign can show additional fabrics alongside lawn. |
| published_at | Publication time or calendar date if the source supplies one. A local evidence date is not used as a substitute. |
| observed_at | Time or date we accessed the source. For archived evidence it is the consultation date, not the date on which a platform recorded its counters. |
| likes, comments_count, shares, views | Provider-reported post counters. The 212-record snapshot has views on 160 rows, likes on 59 rows and comment totals on 51 rows. Shares were unavailable throughout. |
| comment_text | Short audience expression selected in the primary screenshot or text obtained later from an authorized source. The number of comment rows is independent of a post's reported comment total. |
| source_url | Link to the post where possible. Some historical records point to an original published screenshot or a study figure. |
| evidence_url, metric_as_of, metric_notes | On post rows, evidence_url identifies the feed, displayed gallery, video or archived artifact from which values were read. metric_as_of records the source observation or archival display time when known. It is blank for search-index counts of unknown capture date and for a storefront widget with unknown upstream synchronization time. Notes clarify precision. |
| source, provenance, permission | Channel used to obtain the observation, evidence type and reuse context. Public visibility is not an open licence to reproduce the underlying photographs, videos or full feeds. |

## Research leads checked

- The project brief's [Pakistani fashion brand monitoring paper](https://thesesjournal.com/index.php/1/article/view/3247) reports 10,602 observations. Its landing page links a PDF and citation formats. We found no row-level corpus with verifiable provenance and reuse terms on that page.
- [Tagging the brand](https://arlreview.com/index.php/03/article/view/106) analyzes 30 Facebook reviews. The available PDF does not identify the parent posts or supply a reusable row-level corpus.
- [Pakistan Fashion Sentiment Analysis](https://github.com/husnaingujjar170/pakistan-fashion-sentiment-analysis) has 2,000 CSV records but only 15 distinct feedback strings, no parent-post IDs, and no source permalinks. It was excluded from observed data.
- [Pakistani Social Media Content Detective](https://github.com/laibaamin12/pakistani-social-media-content-detective) labels its examples simulated. Its records were excluded.
- The project brief's [order dataset](https://opendata.com.pk/dataset/pakistan-largest-ecommerce-dataset) and [fashion catalogue](https://huggingface.co/datasets/Osama-Ansar/pakistani-fashion-catalogue) describe transactions and products. Neither supplies social-post and comment evidence for these campaign records.

For subsequent collections, retain the provider URL, actual timestamps, stable IDs and permission information. Append only observations from permitted sources. The starter data can establish how a counter or comment was recorded; it does not establish conversions, unique audience size, causal campaign performance or current sentiment for an entire brand.
