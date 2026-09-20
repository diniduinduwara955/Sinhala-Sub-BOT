import { normalizeTitle } from './parser.js';

const API_BASE = 'https://api.themoviedb.org/3';
const cache = new Map();

function compactTitle(value = '') {
  return normalizeTitle(value).replace(/\s+/g, '');
}

function scoreCandidate(queryTitle, year, item) {
  const q = normalizeTitle(queryTitle);
  const candidateTitle = normalizeTitle(item?.title || item?.name || '');
  if (!q || !candidateTitle) return -1;

  const qc = compactTitle(queryTitle);
  const cc = compactTitle(item?.title || item?.name || '');
  const candidateYear = Number((item?.release_date || item?.first_air_date || '').slice(0, 4)) || null;

  let score = 0;
  if (candidateTitle === q) score += 100;
  if (cc === qc) score += 85;
  if (candidateTitle.startsWith(q) || q.startsWith(candidateTitle)) score += 25;
  if (cc.startsWith(qc) || qc.startsWith(cc)) score += 15;
  if (year && candidateYear === Number(year)) score += 35;
  if (item?.media_type === 'movie') score += 2;
  if (item?.media_type === 'tv') score += 1;
  score += Math.min(Number(item?.vote_count) || 0, 1000) / 1000;
  return score;
}

async function tmdbFetch(path, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) return null;

  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'en-US');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url);
  if (!response.ok) return null;
  return response.json();
}

export async function resolveTitle(title, year = null) {
  const cleanTitle = String(title || '').trim();
  const key = `${cleanTitle}|${year || ''}`.toLowerCase();
  if (cache.has(`resolve:${key}`)) return cache.get(`resolve:${key}`);
  if (!cleanTitle) return null;

  const data = await tmdbFetch('/search/multi', {
    query: cleanTitle,
    year: year || undefined,
    include_adult: 'false'
  });

  const results = Array.isArray(data?.results)
    ? data.results.filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
    : [];

  if (!results.length) {
    cache.set(`resolve:${key}`, null);
    return null;
  }

  const preferred = [...results]
    .map((item) => ({ item, score: scoreCandidate(cleanTitle, year, item) }))
    .sort((a, b) => b.score - a.score)[0]?.item;

  if (!preferred?.id) {
    cache.set(`resolve:${key}`, null);
    return null;
  }

  const baseResolved = {
    tmdbId: Number(preferred.id),
    mediaType: preferred.media_type,
    title: preferred.title || preferred.name || cleanTitle,
    year: Number((preferred.release_date || preferred.first_air_date || '').slice(0, 4)) || year || null,
    rating: typeof preferred.vote_average === 'number' ? preferred.vote_average : null,
    posterPath: preferred.poster_path || null,
    collectionId: null,
    collectionName: null
  };

  if (preferred.media_type === 'movie') {
    const detail = await tmdbFetch(`/movie/${preferred.id}`);
    if (detail) {
      baseResolved.collectionId = detail.belongs_to_collection?.id ? Number(detail.belongs_to_collection.id) : null;
      baseResolved.collectionName = detail.belongs_to_collection?.name || null;
      baseResolved.title = detail.title || baseResolved.title;
      baseResolved.year = Number((detail.release_date || '').slice(0, 4)) || baseResolved.year;
      baseResolved.rating = typeof detail.vote_average === 'number' ? detail.vote_average : baseResolved.rating;
      baseResolved.posterPath = detail.poster_path || baseResolved.posterPath;
    }
  }

  cache.set(`resolve:${key}`, baseResolved);
  return baseResolved;
}

export async function getMovieById(tmdbId) {
  const id = Number(tmdbId);
  if (!Number.isInteger(id) || id <= 0) return null;

  const key = `movie:${id}`;
  if (cache.has(key)) return cache.get(key);

  const detail = await tmdbFetch(`/movie/${id}`);
  if (!detail?.id) {
    cache.set(key, null);
    return null;
  }

  const movie = {
    tmdbId: Number(detail.id),
    mediaType: 'movie',
    title: detail.title || `Movie ${id}`,
    year: Number((detail.release_date || '').slice(0, 4)) || null,
    rating: typeof detail.vote_average === 'number' ? detail.vote_average : null,
    posterPath: detail.poster_path || null,
    collectionId: detail.belongs_to_collection?.id ? Number(detail.belongs_to_collection.id) : null,
    collectionName: detail.belongs_to_collection?.name || null
  };

  cache.set(key, movie);
  return movie;
}

export async function getCollectionMovies(collectionId) {
  const id = Number(collectionId);
  if (!Number.isInteger(id) || id <= 0) return [];

  const key = `collection:${id}`;
  if (cache.has(key)) return cache.get(key);

  const data = await tmdbFetch(`/collection/${id}`);
  const movies = Array.isArray(data?.parts)
    ? data.parts
      .filter((item) => item?.id && item?.title)
      .map((item) => ({
        tmdbId: Number(item.id),
        mediaType: 'movie',
        title: item.title,
        year: Number((item.release_date || '').slice(0, 4)) || null,
        rating: typeof item.vote_average === 'number' ? item.vote_average : null,
        posterPath: item.poster_path || null,
        collectionId: id,
        collectionName: data.name || null
      }))
      .sort((a, b) => {
        const ay = a.year || 9999;
        const by = b.year || 9999;
        return ay - by || a.title.localeCompare(b.title);
      })
    : [];

  cache.set(key, movies);
  return movies;
}
