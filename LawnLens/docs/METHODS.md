# How LawnLens calculates campaign signals

Every view uses the posts selected by the current filters. Comments join through their parent post ID. The attached classroom simulation and the observed brand records belong in separate workspaces. A source link and collection timestamp accompany each observed record.

## Reading the numbers

| Display | Calculation | Interpretation |
| --- | --- | --- |
| Views, likes, reported comments and shares | Sum of available nonnegative integer counts, with the number of measured posts | A true zero counts as a measurement. An unavailable field stays blank. Views are cumulative and can include repeated plays. |
| Collected comments | Number of available comment records attached to selected posts | A platform may report many more comments than the collector can read. No missing comment is created from an aggregate count. |
| Content comparison | Within each platform and format, median measured count for each metric | Check the measurement count for each format. Raw format medians can include posts of different ages and brands. |
| Topic share | Comments matching a topic divided by all collected comments in the selection | A comment can match several topics. Unknown or unmatched text remains visible. Percentages can sum to more than 100%. |
| Cluster share | Assigned comments divided by all collected comments in the selection | Each comment can enter one group. Unassigned comments remain in the denominator. |

## Audience segments

The engine normalizes punctuation, strips URLs and mentions, removes common filler words and maps selected Urdu and Roman Urdu variants to equivalent terms. Terms shared by at least two distinct normalized texts enter a TF-IDF matrix. For a term occurring *f* times in one text and in *d* of *N* distinct texts, its weight is **(1 + ln f) × (1 + ln((N + 1)/(d + 1)))**. Each vector is scaled to unit length.

Spherical k-means fits at most 1,500 distinct texts selected by a stable hash. Farthest-first seeding and deterministic ties make the groups reproducible for the same selection. For *n* training texts, the requested number of centers is round(√(n / 3)), bounded to 2–8. The algorithm performs up to 20 assignment and centroid updates. The training limit applies to fitting. Every eligible comment is still scored against the resulting centroids.

An assignment requires cosine similarity of at least 0.12. A retained model group needs two distinct texts and at least two supported groups must exist. Repeated comments contribute their full record count when groups are displayed. If the data are too sparse for this model, identical normalized wording occurring in three or more records can appear as a **repeated wording** group. The interface can show its basis and source examples. A group's cohesion is its mean assigned cosine similarity, which measures text similarity and does not establish label accuracy. Group IDs are local to a filter selection.

English, Roman Urdu and Urdu-script expressions supply separate topic, language, sentiment and purchase-intent cues. These rules can miss spelling variants, sarcasm and negation. A majority topic cue can name a cluster. Otherwise the engine uses its leading terms. A purchase cue describes text only. The data contain no checkout events or verified buyer identities.

## Unusual posts and campaign tests

An outlier comparison requires the same brand, platform, format, observation source, provenance and age band. Age counts UTC calendar days from publication to the observed display. Current sources use the collection date. Archived official YouTube feeds and archived Gul Ahmed galleries use the exact date and time of the archived display in `metric_as_of`. Each archived source has its own comparisons. The gallery timestamp establishes when its counters appeared on the retailer’s page. Its synchronization time with Instagram remains unknown. Lookup dates, indexed counts without capture times and historical screenshots do not establish an eligible archive age. Age bands are 0–7, 8–30, 31–90, 91–365 and 366+ days. The simulation can use its supplied post ages.

Each candidate is removed from its own comparison and must have five other measured peers. Let Q1 and Q3 be the peer quartiles and M the peer median. For counts, transform Q1, Q3 and the candidate using ln(1 + value). The candidate must fall outside the transformed quartiles by more than the greater of three interquartile ranges or ln(2). Its absolute difference from M must also reach 50 views, 5 likes, 3 reported comments or 3 shares. For topic shares, each participating post needs eight collected comments. The corresponding gap beyond the peer quartiles must exceed the greater of three interquartile ranges or 25 percentage points.

A content-test suggestion requires two formats with at least three measurements each in the same brand, platform, source and age cohort. It reports the two sample medians, sample sizes and representative post IDs. Topic recommendations cite matching comment IDs. A segment recommendation links the group's examples. These findings propose tests or investigations. They do not estimate campaign lift or identify causes.

## Interpreting the starter data

The included 11 observed comment excerpts come from two historical examples. Four price questions attached to one Khaadi thread can support a repeated-wording finding. They cannot establish the fraction of current Khaadi shoppers concerned about price. The separate classroom simulation demonstrates clustering at the brief's requested scale. An approved current comment export can be analyzed using the same pipeline. Source counts, access conditions and observation dates are recorded in the dataset documentation.
