# Local Data Fixtures

Use this folder for phase-by-phase JSON fixtures during prototyping:

- `song_catalog.json`
- `song_detail.json` (full track list per song, sorted: overrides, popularity, excludes last)
- `facets.json` (genre facet key: `track_genre` from parsed SC `genres` tokens)
- `songbook_catalog.json` (curated songbook entities + member songs + optional SC playlist metadata)

Production-ready artifacts should be generated from clean CSV snapshots. `song_catalog.json` / `song_detail.json` include **every lyrics row with `song_in_app`** (plus `has_in_app_playback` when at least one SC track is published in-app).

