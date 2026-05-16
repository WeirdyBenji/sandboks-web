const SPREADSHEET_ID = '19eoWtdqAyMeFuHmvjEMQfXJag1VHvRiDHdr5LyCX27k';
const SHEET_NAME = 'Movies';

const HEADERS = [
  'id',
  'tmdbId',
  'title',
  'year',
  'poster',
  'rtCriticsScore',
  'rtAudienceScore',
  'personalNote',
  'addedAt',
  'watchedAt',
  'enteredBy',
  'status',
  'rtUrl',
  'category',
  'mar',
  'benji',
  'mediaType',
];

const COLUMN_BY_FIELD = HEADERS.reduce((columns, header, index) => {
  columns[header] = index + 1;
  return columns;
}, {});

const EDITABLE_FIELDS = HEADERS.filter((header) => header !== 'id').reduce((fields, header) => {
  fields[header] = true;
  return fields;
}, {});

const CAPABILITIES = {
  updateMovie: true,
  addMovie: true,
  deleteMovie: true,
  replaceMovies: true,
};

function doGet(e) {
  const sheet = getMoviesSheet();
  const rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    return jsonResponse({ movies: [], capabilities: CAPABILITIES }, e);
  }

  const movies = rows.slice(1).map((row) => ({
    id: String(row[0] || ''),
    tmdbId: Number(row[1] || 0),
    title: String(row[2] || ''),
    year: String(row[3] || ''),
    poster: String(row[4] || ''),
    rtCriticsScore: toNullableNumber(row[5]),
    rtAudienceScore: toNullableNumber(row[6]),
    personalNote: String(row[7] || ''),
    addedAt: String(row[8] || ''),
    watchedAt: String(row[9] || ''),
    enteredBy: String(row[10] || ''),
    status: row[11] === 'watched' ? 'watched' : 'toWatch',
    rtUrl: String(row[12] || ''),
    category: String(row[13] || ''),
    mar: toBoolean(row[14]),
    benji: toBoolean(row[15]),
    mediaType: String(row[16] || ''),
  }));

  return jsonResponse({ movies, capabilities: CAPABILITIES }, e);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const body = JSON.parse(e.postData.contents || '{}');

    if (body.action === 'updateMovie') {
      updateMovieFields(body.id, body.changes || {});
      return jsonResponse({ ok: true });
    }

    if (body.action === 'addMovie') {
      addMovie(body.movie || {});
      return jsonResponse({ ok: true });
    }

    if (body.action === 'deleteMovie') {
      deleteMovie(body.id);
      return jsonResponse({ ok: true });
    }

    if (body.action === 'replaceMovies') {
      replaceMovies(body.movies);
      return jsonResponse({ ok: true });
    }

    throw new Error(`Unsupported action: ${body.action || 'missing action'}`);
  } finally {
    lock.releaseLock();
  }
}

function replaceMovies(movies) {
  if (!Array.isArray(movies)) {
    throw new Error('Missing movies array');
  }

  const sheet = getMoviesSheet();
  const existingMovies = getExistingMoviesById(sheet);
  const now = new Date().toISOString();

  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (movies.length > 0) {
    const values = movies.map((movie) => {
      const existingMovie = existingMovies[String(movie.id || '')] || {};
      return movieToRow(movie, existingMovie, now);
    });

    sheet.getRange(2, 1, values.length, HEADERS.length).setValues(values);
  }
}

function addMovie(movie) {
  if (!movie.id) {
    throw new Error('Missing movie id');
  }

  const sheet = getMoviesSheet();
  const rows = sheet.getDataRange().getValues();
  const existingRowIndex = rows.findIndex((row, index) => index > 0 && String(row[0] || '') === String(movie.id));

  if (existingRowIndex !== -1) {
    return;
  }

  sheet.appendRow(movieToRow(movie, {}, new Date().toISOString()));
}

function deleteMovie(id) {
  if (!id) {
    throw new Error('Missing movie id');
  }

  const sheet = getMoviesSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[0] || '') === String(id));

  if (rowIndex === -1) {
    return;
  }

  sheet.deleteRow(rowIndex + 1);
}

function updateMovieFields(id, changes) {
  if (!id) {
    throw new Error('Missing movie id');
  }

  const sheet = getMoviesSheet();
  const rows = sheet.getDataRange().getValues();
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[0] || '') === String(id));

  if (rowIndex === -1) {
    throw new Error(`Movie not found: ${id}`);
  }

  Object.keys(changes).forEach((field) => {
    const column = COLUMN_BY_FIELD[field];

    if (!column || !EDITABLE_FIELDS[field]) {
      return;
    }

    const value = normalizeCellValue(field, changes[field]);
    sheet.getRange(rowIndex + 1, column).setValue(value);
  });
}

function movieToRow(movie, existingMovie, now) {
  const status = movie.status === 'watched' ? 'watched' : 'toWatch';
  const watchedAt = getWatchedAt(movie, existingMovie, status, now);

  return [
    String(movie.id || ''),
    Number(movie.tmdbId || 0),
    String(movie.title || ''),
    String(movie.year || ''),
    String(movie.poster || ''),
    movie.rtCriticsScore === null || movie.rtCriticsScore === undefined ? '' : Number(movie.rtCriticsScore),
    movie.rtAudienceScore === null || movie.rtAudienceScore === undefined ? '' : Number(movie.rtAudienceScore),
    String(movie.personalNote || ''),
    String(movie.addedAt || ''),
    watchedAt,
    movie.enteredBy === undefined ? String(existingMovie.enteredBy || '') : String(movie.enteredBy),
    status,
    String(movie.rtUrl || existingMovie.rtUrl || ''),
    String(movie.category || existingMovie.category || ''),
    movie.mar === undefined ? toBoolean(existingMovie.mar) : toBoolean(movie.mar),
    movie.benji === undefined ? toBoolean(existingMovie.benji) : toBoolean(movie.benji),
    getMediaType(movie, existingMovie),
  ];
}

function getMediaType(movie, existingMovie) {
  const mediaType = movie.mediaType === undefined ? existingMovie.mediaType : movie.mediaType;

  if (mediaType === 'movie' || mediaType === 'tv') {
    return mediaType;
  }

  const category = movie.category === undefined ? existingMovie.category : movie.category;
  return category === 'série' ? 'tv' : 'movie';
}

function normalizeCellValue(field, value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (field === 'mar' || field === 'benji') {
    return toBoolean(value);
  }

  if (field === 'rtCriticsScore' || field === 'rtAudienceScore' || field === 'tmdbId') {
    return value === '' ? '' : Number(value);
  }

  return String(value);
}

function getMoviesSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  const firstRow = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0];
  const hasHeaders = HEADERS.every((header, index) => firstRow[index] === header);

  if (!hasHeaders) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
  }

  return sheet;
}

function getExistingMoviesById(sheet) {
  const rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    return {};
  }

  return rows.slice(1).reduce((moviesById, row) => {
    const id = String(row[0] || '');

    if (id) {
      moviesById[id] = {
        watchedAt: String(row[9] || ''),
        enteredBy: String(row[10] || ''),
        rtUrl: String(row[12] || ''),
        category: String(row[13] || ''),
        mar: row[14],
        benji: row[15],
        mediaType: String(row[16] || ''),
      };
    }

    return moviesById;
  }, {});
}

function getWatchedAt(movie, existingMovie, status, now) {
  if (status !== 'watched') {
    return '';
  }

  if (movie.watchedAt !== undefined) {
    return String(movie.watchedAt);
  }

  return String(existingMovie.watchedAt || now);
}

function toNullableNumber(value) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function toBoolean(value) {
  return value === true || value === 'TRUE' || value === 'true';
}

function jsonResponse(payload, e) {
  const callback = e && e.parameter && e.parameter.callback;

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(payload)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
