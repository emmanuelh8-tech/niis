# NIIS — Data Schema

Relational schema (SQLite in this build; standard SQL, ports directly to PostgreSQL for cloud hosting).

## Core reference tables

### `counties`
15 rows: id, name, capital, population, area_km2, urban_share.

### `indicators`
| column | type | notes |
|---|---|---|
| code | TEXT PK | e.g. `internet_penetration` |
| name | TEXT | display name |
| domain | TEXT | catalogue category: `connectivity` \| `access` \| `affordability` \| `market` \| `trust` \| `sustainability` |
| dashboard | TEXT | topic-dashboard slug: `connectivity` \| `mobile-broadband` \| `affordability` \| `trust-governance` \| `sustainability` \| `education` |
| unit | TEXT | e.g. `% of population` |
| description | TEXT | definition |
| methodology | TEXT | methodology note (Indicator Catalogue drawer) |
| agency | TEXT | source agency (Indicator Catalogue drawer) |
| periodicity | TEXT | `Annual` \| `Biennial` |
| access_level | TEXT | `public` \| `registered` \| `stakeholder` — tiered visibility |
| headline | INTEGER | 1 = shown in the homepage key-numbers strip |

30 seeded indicators across the six domains. `coverage` (# counties reporting) and `lastUpdated` (latest year) are computed at query time from `data_points`, not stored.

## Fact tables

### `data_points`
One row per (indicator, county, year); `county_id IS NULL` is the national aggregate. Unique on `(indicator_code, county_id, year)` — approvals upsert.

### `data_submissions` (quality review queue)
Incoming data from surveys, operator feeds and manual templates, including what a stakeholder (an institution's data focal point) sends from the workspace's Submit data page, one value or a CSV file, on the `manual` channel with `source` starting `Focal point:`. `channel` (`survey`|`operator_feed`|`manual`), `status` (`pending`|`approved`|`rejected`), `validation_note` from automated checks, `reviewed_by`/`reviewed_at` on human decision.

### `saved_queries`
Data Query builder saves: user_id, name, indicators (CSV codes), counties (CSV names or `all`), year_from, year_to, format.

## Access control

`users` (email, role: `public`|`researcher`|`stakeholder`|`admin`, where `researcher` needs `docs/sql/researcher-role.sql`, status: `pending`|`active`|`suspended`) · `sessions` (HttpOnly cookie tokens, 12 h) · `role_permissions` (`(role, permission)` pairs — editable by administrators, not hard-coded) · `settings` (`registration_mode`, `stakeholder_provisioning`, `messaging_model`, `last_etl_sync`).

## Content

`papers` (title, authors, abstract, published_on, tag, body) · `updates` (title, category, body, published_on) · `media` (kind: `image`|`paper`|`video`; video stores only `video_provider`+`video_embed_id`, hosted externally — not stored in the primary database).

## Messaging

`conversations` (one per user, `user_id` UNIQUE) · `messages` (conversation_id, sender_id, `from_admin_team` flag, `read_by_user`/`read_by_admin`). History is visible to the sending user and the entire admin team collectively.

## Analytics

`events` (`kind`: `page_view`|`download`|`api_call`, path, role, created_at) — feeds Platform Analytics.

## The NIIS console (docs/sql/niis-console.sql, 10 Nov 2026)

The system behind the site, run from `/admin` (niis/console.js, niis/console-views.js):

- `niis_batches`: every intake (file, paste, link, open data, provider API, form, provider portal), with its original file's SHA-256 and where the file is kept (`disk:` locally, `storage:` in the private `niis-raw` bucket when hosted). Status `mapping` (columns to confirm), `received`, `processed`, `archived`. Provider sign-off (Q10) is recorded here.
- `niis_raw_rows`: the rows as received (text kept beside what was recognised), with notes and status `ok`, `flagged`, `rejected`, `used`.
- `niis_runs`: each "Process new data" run and its stage-by-stage log (niis/pipeline.js: Validate, Clean, Integrate, Transform, Analyse, Enrich; checks Q01 to Q12 of MOU Schedule 3).
- `niis_staged`: the values a run produced, with their checks and severity, through `draft` → `approved` → `released` (or `rejected`, `suppressed`, `superseded`). Release writes `data_points` through `bulk_publish`; the release rule (`settings.niis_release_rule`, default `two_person`) decides whether the approver may also release.
- `niis_revisions`: every change to a published figure (Q12). `niis_denominators`: the agreed population table (Q04). `niis_sources`: linked sources pulled on demand. `niis_reports`: generated or uploaded reports (published ones join `/reports`; PDFs in the public `niis-reports` bucket). `niis_audit`: who did what. `niis_api_keys`: provider API keys (only a SHA-256 is kept) for `POST /api/v1/intake`.
- `data_submissions.batch_id`: a portal submission once gathered into a batch.
- `niis_coverage()`: values per indicator and year (read in pages of 1,000).
