# Phased Roadmap

## Phase A - Environment and Contracts

- Set up app workspace and baseline tooling.
- Lock JSON artifacts:
  - `song_catalog.json`
  - `song_detail.json`
  - `facets.json`
- Lock sorting rules:
  - default `published_at desc`
  - optional `most_played`, `most_liked`
- Confirm manual override assumptions:
  - `best_track_override` checkbox
  - `best_track_exclude` checkbox

## Phase B - Grid and Filtering

- Song-first card grid with artwork and summary.
- Meaning + genre filters.
- URL state for filters/sort.

## Phase C - Detail and Playback

- Song detail panel/page.
- Embedded SoundCloud playback for best track variants.
- Lyrics summary + full lyrics context.

## Phase D - Creator QA Helpers

- Missing-tag indicators for track metadata completion.
- Views optimized for manual Airtable curation workflow.

## Phase E - YouTube Ready Layer

- Keep data contracts extensible for YT media additions.
- No forced UI rewrite when YT is introduced later.

