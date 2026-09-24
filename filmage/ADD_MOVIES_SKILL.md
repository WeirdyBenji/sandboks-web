---
name: add-movies
description: Add films, TV shows, seasons, anime, and animation titles to Benji's cinephile Google Sheets watchlist through the Apps Script endpoint. Use when asked to add, enrich, or update watchlist entries with TMDb metadata, direct Rotten Tomatoes links and scores, MyAnimeList links for anime, categories, enteredBy, watched status, or targeted sheet updates.
---

# Add Movies

## Endpoint

Apps Script endpoint:
`https://script.google.com/macros/s/AKfycbzlXCD3i-NuQMIn-BJ8Xk7DhyPBCML8o7lxtUheAX3EJ-1WVdVNKa9Wh_-fU1Zp63wl/exec`

Use only targeted mutations:
- `addMovie` to create one row.
- `updateMovie` to update only changed fields on one row.
- Never use full replacement unless the user explicitly asks for restore or maintenance work.

## Safety Workflow

1. GET the endpoint before writing.
2. Confirm `capabilities.addMovie === true` before additions and `capabilities.updateMovie === true` before edits.
3. Check existing rows before adding. Compare `tmdbId` and normalized title. Repeated `tmdbId` can be intentional for separate seasons or contexts, so do not merge unless the title/context clearly matches.
4. Preserve user-owned fields on existing rows unless explicitly asked: `personalNote`, `watchedAt`, `status`, `mar`, `benji`, `enteredBy`.
5. For existing rows, complete only useful empty metadata fields through `updateMovie`.
6. Before leaving `rtUrl`, `rtCriticsScore`, or `rtAudienceScore` empty/null, explicitly search the web for a direct Rotten Tomatoes movie/TV/season page.
7. Do not send unknown `action` values.

## Metadata Rules

For every new row, fill:
- `id`: new UUID.
- `tmdbId`: TMDb movie or TV id.
- `mediaType`: `"movie"` for films, animation, and anime movies; `"tv"` for series and seasons.
- `title`: clear display title. Include season label when adding a specific season, for example `The Last of Us S2`.
- `year`: release year or first air year.
- `poster`: TMDb `w92` poster URL when available.
- `rtUrl`: direct Rotten Tomatoes page when reliably matched; MyAnimeList/AniList only when RT has no reliable page; RT search URL only as last fallback.
- `rtCriticsScore`: Tomatometer score from the direct RT page, or `null` only after a direct RT/web search confirms no score is available.
- `rtAudienceScore`: Popcornmeter score from the direct RT page, or `null` only after a direct RT/web search confirms no score is available.
- `personalNote`: `""`.
- `addedAt`: current ISO timestamp.
- `watchedAt`: `""` unless the user says it was watched.
- `enteredBy`: exactly the requested person. If unspecified, leave it empty.
- `category`: use the user-requested category; otherwise choose `film`, `animation`, `anime`, `série`, `césar`, `oscar`, `tim burton`, or `bong joon ho`.
- `mar`: `false`.
- `benji`: `false`.
- `status`: `"toWatch"` unless the user asks for watched.

`top 50` is a one-off/import category. Do not use it unless the user explicitly asks for it.

## Source Selection

- Films: search TMDb movie results and then search the web/Rotten Tomatoes for a direct movie page; fill both RT scores when available.
- TV shows and seasons: search TMDb TV results; use `category: "série"` and `mediaType: "tv"`; search RT TV/season URLs such as `/tv/show_name/s02`.
- Anime: use `category: "anime"`; search RT first for released/current seasons, then prefer MyAnimeList/AniList only when RT has no reliable matching page.
- Animation that is not anime: use `category: "animation"` unless the user requested another category.
- Future or unreleased titles: verify release/review status with a web search before leaving scores as `null`; if RT already has a page and scores, use them.

## Payloads

Add one movie:

```json
{
  "action": "addMovie",
  "movie": {
    "id": "uuid",
    "tmdbId": 123,
    "mediaType": "movie",
    "title": "Titre",
    "year": "2024",
    "poster": "https://image.tmdb.org/t/p/w92/...",
    "rtUrl": "https://www.rottentomatoes.com/m/...",
    "rtCriticsScore": 91,
    "rtAudienceScore": 82,
    "personalNote": "",
    "addedAt": "ISO date",
    "watchedAt": "",
    "enteredBy": "Prénom",
    "category": "film",
    "mar": false,
    "benji": false,
    "status": "toWatch"
  }
}
```

Update one movie:

```json
{
  "action": "updateMovie",
  "id": "id-du-film",
  "changes": {
    "fieldName": "nouvelle valeur"
  }
}
```

## Final Response

Summarize:
- added rows;
- already-present rows;
- updated existing rows;
- RT scores found;
- scores or links still missing.

