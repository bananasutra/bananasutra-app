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

Facet keys for genre filtering in artifacts:

- `track_genre` — tokens from SC `genres` (fusion tags), **published tracks only**
- `track_secondary_genre` — values from SC `secondary_genre` (manual), **published tracks only**

SoundCloud’s broad `soundcloud_genre` tag is kept on cards as `soundcloud_genre_tags` for reference, not the primary filter axis.

