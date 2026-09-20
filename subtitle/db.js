import { normalizeTitle } from './parser.js';

function getConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase configuration is missing.');
  return { url, key };
}

async function supabaseRequest(path, options = {}) {
  const { url, key } = getConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase ${response.status}: ${body}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function upsertSubtitle(row) {
  return supabaseRequest('cine_subtitles?on_conflict=unique_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
}

function addIlike(params, field, value) {
  if (value) params.set(field, `ilike.*${value.replace(/[,%]/g, '')}*`);
}

export async function findSubtitles({ normalizedTitle, tmdbId, year, season, episode, limit = 10 }) {
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('language', 'eq.Sinhala');
  params.set('limit', String(limit));
  params.set('order', 'season.asc,episode.asc,year.desc,created_at.desc');

  if (tmdbId) {
    params.set('tmdb_id', `eq.${tmdbId}`);
  } else if (normalizedTitle) {
    addIlike(params, 'normalized_title', normalizedTitle);
  }

  if (year) params.set('year', `eq.${year}`);
  if (season !== null && season !== undefined) params.set('season', `eq.${season}`);
  if (episode !== null && episode !== undefined) params.set('episode', `eq.${episode}`);

  return supabaseRequest(`cine_subtitles?${params.toString()}`);
}

export async function findSubtitleById(id) {
  const params = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
  const rows = await supabaseRequest(`cine_subtitles?${params.toString()}`);
  return rows?.[0] || null;
}

export async function addNotification(row) {
  return supabaseRequest('cine_subtitle_notifications?on_conflict=unique_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(row)
  });
}

export async function createNotificationRequest(row) {
  return supabaseRequest('cine_subtitle_notification_requests', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(row)
  });
}

export async function findNotificationRequestById(id) {
  const params = new URLSearchParams({ select: '*', id: `eq.${id}`, limit: '1' });
  const rows = await supabaseRequest(`cine_subtitle_notification_requests?${params.toString()}`);
  return rows?.[0] || null;
}

export async function deleteNotificationRequest(id) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  return supabaseRequest(`cine_subtitle_notification_requests?${params.toString()}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' }
  });
}

export async function getPendingNotificationsForSubtitle(subtitle) {
  const params = new URLSearchParams({
    select: '*',
    notified: 'eq.false',
    language: 'eq.Sinhala',
    limit: '1000'
  });

  const rows = await supabaseRequest(`cine_subtitle_notifications?${params.toString()}`);
  const subtitleTitle = normalizeTitle(subtitle.normalized_title || subtitle.title || '');

  return (rows || []).filter((row) => {
    const sameSeason = (row.season ?? null) === (subtitle.season ?? null);
    const sameEpisode = (row.episode ?? null) === (subtitle.episode ?? null);
    if (!sameSeason || !sameEpisode) return false;

    if (subtitle.tmdb_id && row.tmdb_id && Number(row.tmdb_id) === Number(subtitle.tmdb_id)) {
      return true;
    }

    const notificationTitle = normalizeTitle(row.title || '');
    if (!notificationTitle || !subtitleTitle || notificationTitle !== subtitleTitle) {
      return false;
    }

    // Year is only a hard requirement when both sides know the year.
    if (row.year != null && subtitle.year != null && Number(row.year) !== Number(subtitle.year)) {
      return false;
    }

    return true;
  });
}

export async function markNotificationSent(id) {
  const params = new URLSearchParams({ id: `eq.${id}` });
  return supabaseRequest(`cine_subtitle_notifications?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ notified: true, notified_at: new Date().toISOString() })
  });
}

export async function pingSupabase() {
  const params = new URLSearchParams({ select: 'id', limit: '1' });
  return supabaseRequest(`cine_subtitles?${params.toString()}`);
}
