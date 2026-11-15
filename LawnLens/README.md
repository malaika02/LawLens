# LawnLens
A campaign research workspace for Pakistani fashion brands. It opens with genuine records from Sapphire, Khaadi and Gul Ahmed. Select **Category → Lawn** for the 32 explicitly lawn-related posts in the starter dataset.

## Open the website locally

Install Node.js 22 or newer. Extract the project ZIP, open a terminal in the directory containing this file, and run:

~~~sh
node server.mjs
~~~

Open **http://127.0.0.1:8080**. The first start builds the website automatically. The same JavaScript serves the local and hosted applications. No npm install, API key or database setup is needed for the public dashboard. After editing source files run `node build.mjs` and restart the server. Use `node server.mjs --port 8081` for a different local port.

## Using the research workspace

| Question from the project | Where to look | What the site shows |
|---|---|---|
| Which content attracts attention? | Content explorer | Within-platform format medians for available views, likes, shares and reported comments, including the number of measured posts. |
| What does the audience want? | Audience segments | Topic cues for pricing, fabric, sizing, delivery, discounts, availability and purchase interest, alongside the actual text. |
| Which patterns are unusual? | Unusual patterns | Outliers, metric, measured value, peer median, peer count, and link to the original record. |
| Which needs form groups? | Audience segments | Deterministic TF-IDF spherical k-means for supported corpora. Sparse samples can show separately identified repeated-wording groups. |
| What could the team do next? | Recommendations | Specific customer-service replies and campaign tests linked to the comments or comparable posts behind them. |

The navigation works on desktop and mobile. Brand, platform, campaign and category filters apply together. Check **Data & sources** for live coverage and connection instructions. **Export data** downloads the current filtered posts, comments, annotations or analysis.

## Data available on 15 November 2026

- **Brand observations** includes 212 unique post/thread records (97 Gul Ahmed, 68 Khaadi, 47 Sapphire), with 160 YouTube, 51 Instagram and 1 Facebook record. It includes 32 lawn posts. The other records cover adjacent fashion and retail campaigns.
- **Comment evidence** comprises 11 historical excerpts from two documented threads. Four Khaadi price inquiries form a repeated-wording group. The dataset has insufficient current text to infer customer demand across these brands.
- **Classroom simulation** preserves the attached example's 3,000 fictional posts and 35,919 generated comments. It meets the classroom scale target. It is analysed independently, with no fictional records added to observed brands. Comment IDs were assigned during extraction. Simulated publication dates were reconstructed from the original reference date (20 December 2025) and days-since-post values.
- **My imported data** holds authorised CSV records in this browser, in IndexedDB. Select one or both files in **Data & sources**. Imports validate dates, duplicate IDs, numeric fields, provenance and parent links before writing both tables. An observed import requires a source link and permission description. Make an export to transfer a browser workspace to another computer.
- **Observation coverage** is below the target of 2,000–5,000 real posts. Use authorised account histories and accompanying comment exports to expand it. Missing metrics remain blank. Content labels and model assignments require human review. A share count, reach or conversion rate is never inferred from publicly visible views.
- The **dataset ZIP** contains separate observed and simulated CSVs. The observed folder has the source card. Both post and comment tables join on `post_id`. In the website source, demo CSVs are gzip-compressed.

## Refresh and connected sources

The public monitor requests three official YouTube feeds and the Instagram gallery published on Gul Ahmed's storefront. It runs on opening a stale workspace, on manual refresh and every fifteen minutes while the tab is visible. The service reuses recent checks within its 15-minute window. Some platforms cache counters, and the storefront does not supply its upstream sync time. An unreachable publisher is labelled. The browser keeps its last successful results. Source consultation, publication and metric capture dates are separate values, with unknown values left blank. The bundled archive remains available regardless of the live connections.

For owner-authorised Instagram, set the account-specific environment variables in **CONNECTORS.md** and restart. Facebook, TikTok and approved YouTube Data API exports use the supplied Python collector and then the website's CSV import. TikTok Display API supports post counters, including comment totals. An authorised comment-text export is needed for TikTok text analysis. Credentials stay on the server or on the machine running the collector. Owner APIs were tested with simulated provider responses. No brand account credentials were provided for an end-to-end owner account test.

## Verification and source layout

~~~sh
npm test
python -m unittest test_collect test_connectors
~~~

The optional collectors and CSV asset compiler use Python 3.11+ and the standard library. To rebuild dataset assets after replacing the source CSVs run `python prepare_data.py`, then `node build.mjs`. The Node public-source, owner-connector, analytics and CSV tests use no paid accounts.

| Path | Contents |
|---|---|
| web/ | Interface, charts, worker-based clustering, CSV parser and built-in data assets |
| public.mjs, owner.mjs | Public publisher feeds and authorised Instagram |
| service.mjs, server.mjs, build.mjs | Hosted Worker routes, local HTTP server and deterministic asset build |
| data/ | Exact packaged source records and research provenance |
| docs/METHODS.md | Model details, thresholds, denominators and limitations |
| CONNECTORS.md, collect.py, connectors.py | Account access, available metrics, larger exports and import workflow |

The textile detail is a public-domain image from Cooper Hewitt, Smithsonian Design Museum, object 1973-51-37. Its source is linked in the website. It illustrates the interface and is independent of the measured campaigns.
