# Snapshots Archive Staging

Use this folder to keep `AIRTABLE/snapshots/` readable while retaining older snapshot dates short-term.

Rules:

- Keep only the latest 3 snapshot dates in `AIRTABLE/snapshots/` root.
- Move older dated snapshot folders into `AIRTABLE/snapshots/archived/`.
- Periodically move very old archives to external cold storage.
- Do not move special utility folders (`-slugs`, `summaries`, `backups`) unless intentional.
