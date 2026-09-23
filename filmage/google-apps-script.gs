const SPREADSHEET_ID = '19eoWtdqAyMeFuHmvjEMQfXJag1VHvRiDHdr5LyCX27k';
const SHEET_NAME = 'Movies';

const HEADERS = [
  'id',
  'tmdbId',
  'title',
  'year',
  'poster',
  'whereToWatch',
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

  const headerMap = getHeaderIndexMap(rows[0]);
  const movies = rows.slice(1)
    .filter(hasRowContent)
    .map((row) => rowToMovie(row, headerMap));

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
  const idColumnIndex = COLUMN_BY_FIELD.id - 1;
  const existingRowIndex = rows.findIndex((row, index) => index > 0 && String(row[idColumnIndex] || '') === String(movie.id));

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
  const idColumnIndex = COLUMN_BY_FIELD.id - 1;
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[idColumnIndex] || '') === String(id));

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
  const idColumnIndex = COLUMN_BY_FIELD.id - 1;
  const rowIndex = rows.findIndex((row, index) => index > 0 && String(row[idColumnIndex] || '') === String(id));

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
    String(movie.whereToWatch || existingMovie.whereToWatch || ''),
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

function rowToMovie(row, headerMap) {
  return {
    id: String(getRowValue(row, headerMap, 'id') || ''),
    tmdbId: Number(getRowValue(row, headerMap, 'tmdbId') || 0),
    title: String(getRowValue(row, headerMap, 'title') || ''),
    year: String(getRowValue(row, headerMap, 'year') || ''),
    poster: String(getRowValue(row, headerMap, 'poster') || ''),
    whereToWatch: String(getRowValue(row, headerMap, 'whereToWatch') || ''),
    rtCriticsScore: toNullableNumber(getRowValue(row, headerMap, 'rtCriticsScore')),
    rtAudienceScore: toNullableNumber(getRowValue(row, headerMap, 'rtAudienceScore')),
    personalNote: String(getRowValue(row, headerMap, 'personalNote') || ''),
    addedAt: String(getRowValue(row, headerMap, 'addedAt') || ''),
    watchedAt: String(getRowValue(row, headerMap, 'watchedAt') || ''),
    enteredBy: String(getRowValue(row, headerMap, 'enteredBy') || ''),
    status: getRowValue(row, headerMap, 'status') === 'watched' ? 'watched' : 'toWatch',
    rtUrl: String(getRowValue(row, headerMap, 'rtUrl') || ''),
    category: String(getRowValue(row, headerMap, 'category') || ''),
    mar: toBoolean(getRowValue(row, headerMap, 'mar')),
    benji: toBoolean(getRowValue(row, headerMap, 'benji')),
    mediaType: String(getRowValue(row, headerMap, 'mediaType') || ''),
  };
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
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return sheet;
  }

  const rows = sheet.getDataRange().getValues();

  if (rows.length === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return sheet;
  }

  const existingHeaders = rows[0].map((value) => String(value || ''));
  const hasHeaders = HEADERS.every((header, index) => existingHeaders[index] === header);

  if (hasHeaders) {
    return sheet;
  }

  migrateSheetToLatestSchema(sheet, rows, existingHeaders);
  return sheet;
}

function migrateSheetToLatestSchema(sheet, rows, existingHeaders) {
  const headerMap = getHeaderIndexMap(existingHeaders);
  const movies = rows.slice(1)
    .filter(hasRowContent)
    .map((row) => rowToMovie(row, headerMap));

  const values = movies.map((movie) => movieToRow(movie, movie, movie.addedAt || new Date().toISOString()));

  sheet.clearContents();
  sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

  if (values.length > 0) {
    sheet.getRange(2, 1, values.length, HEADERS.length).setValues(values);
  }
}

function getExistingMoviesById(sheet) {
  const rows = sheet.getDataRange().getValues();

  if (rows.length <= 1) {
    return {};
  }

  const headerMap = getHeaderIndexMap(rows[0]);

  return rows.slice(1).reduce((moviesById, row) => {
    const movie = rowToMovie(row, headerMap);
    const id = String(movie.id || '');

    if (id) {
      moviesById[id] = {
        whereToWatch: movie.whereToWatch,
        watchedAt: movie.watchedAt,
        enteredBy: movie.enteredBy,
        rtUrl: movie.rtUrl,
        category: movie.category,
        mar: movie.mar,
        benji: movie.benji,
        mediaType: movie.mediaType,
      };
    }

    return moviesById;
  }, {});
}

function getHeaderIndexMap(headers) {
  return headers.reduce((map, header, index) => {
    const normalizedHeader = String(header || '').trim();

    if (normalizedHeader) {
      map[normalizedHeader] = index;
    }

    return map;
  }, {});
}

function getRowValue(row, headerMap, field) {
  const index = headerMap[field];

  if (index === undefined) {
    return '';
  }

  return row[index];
}

function hasRowContent(row) {
  return row.some((value) => value !== '' && value !== null && value !== undefined);
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
