# Filters Feature

Planned controls:

- Sutra
- Topic
- Intention
- Light/Shadow
- Track genres (parsed from SC `genres` field, fusion tags)

Filtering contract:

- OR within each filter family
- AND across filter families
- Global contextual-count contract (all faceted surfaces: Songs, Tracks, Videos, Muses, and future Songbooks):
  - Facet counts are contextual (disjunctive faceting): for a rendered facet group, counts are computed with all other active filters applied while clearing only that group.
  - Show zero-count options for visibility, but disable them unless already active.
  - Surface a short helper line in the UI: "AND across groups, OR within a group."
  - Keep tokenized search behavior aligned with facet counts by applying the current text query to contextual count computation (same tokenization rules as that page's search parser).

Facet keys for genre filtering in artifacts:

- `track_genre` — tokens from SC `genres` (fusion tags), **published tracks only**
- `track_secondary_genre` — values from SC `secondary_genre` (manual), **published tracks only**

SoundCloud’s broad `soundcloud_genre` tag is kept on cards as `soundcloud_genre_tags` for reference, not the primary filter axis.

