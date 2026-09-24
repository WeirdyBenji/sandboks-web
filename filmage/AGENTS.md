# AGENTS.md

When adding or editing watchlist items, protect the Google Sheet first.

- Read the Apps Script endpoint before mutating data and confirm `capabilities.addMovie === true` for additions and `capabilities.updateMovie === true` for edits.
- Save a local JSON backup of the endpoint response before any DB mutation.
- Use targeted `addMovie` / `updateMovie` calls. Do not use a full replace unless the user explicitly asks for maintenance restore work.
- Never send an unknown `action` value to the Apps Script endpoint.
- Avoid duplicates by checking both `tmdbId` and normalized title.
- Repeated `tmdbId` values can be intentional when the user wants separate rows, especially for different seasons or watchlist contexts; do not flag this as a finding unless there is clear accidental duplication.
- For movies, search for a direct Rotten Tomatoes page in addition to TMDb and fill both critics and audience scores from that page when available. Do not leave RT scores null just because TMDb/OMDb did not provide them.
- For TV shows and seasons, search TMDb TV results, use category `série`, and search for direct Rotten Tomatoes TV/season URLs such as `/tv/show_name/s02`.
- For anime, use category `anime`; still search for a direct Rotten Tomatoes season page first when the anime is released or currently airing. Prefer MyAnimeList/AniList only when RT has no reliable matching page.
- `top 50` is a one-off/import category. Do not suggest it for future additions unless the user explicitly asks for it.
- Do not replace user fields such as `personalNote`, `watchedAt`, `status`, `mar`, or `benji` unless explicitly asked.
- Set `enteredBy` to the requested person exactly. If unspecified, ask or leave it empty.
