import assert from 'node:assert/strict';

process.env.SUPABASE_URL = 'http://mock.supabase';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

let pending = [
  {
    id: 17,
    unique_key: 'u1',
    user_id: '12345',
    tmdb_id: null,
    title: 'Avatar: The Way of Water',
    year: 2022,
    season: null,
    episode: null,
    language: 'Sinhala',
    notified: false
  },
  {
    id: 18,
    unique_key: 'u2',
    user_id: '67890',
    tmdb_id: null,
    title: 'Avatar: The Way of Water',
    year: 2022,
    season: null,
    episode: null,
    language: 'Sinhala',
    notified: true
  }
];

const calls = [];
global.fetch = async (url, options = {}) => {
  calls.push({ url, options });
  const u = new URL(url);
  const path = u.pathname;

  if ((!options.method || options.method === 'GET') && path.endsWith('/cine_subtitle_notifications')) {
    return new Response(JSON.stringify(pending.filter((r) => !r.notified)), { status: 200 });
  }

  if (options.method === 'POST' && path.endsWith('/cine_subtitle_notifications')) {
    const body = JSON.parse(options.body);
    return new Response(JSON.stringify([body]), { status: 201 });
  }

  if (options.method === 'PATCH' && path.endsWith('/cine_subtitle_notifications')) {
    const id = Number(u.searchParams.get('id')?.replace('eq.', ''));
    pending = pending.map((r) => r.id === id ? { ...r, notified: true } : r);
    return new Response('', { status: 200 });
  }

  throw new Error(`Unexpected request: ${options.method || 'GET'} ${path}`);
};

const { getPendingNotificationsForSubtitle, addNotification, markNotificationSent } = await import('./subtitle/db.js');

const matches = await getPendingNotificationsForSubtitle({
  tmdb_id: null,
  normalized_title: 'avatar the way of water',
  title: 'Avatar the Way of Water',
  year: 2022,
  season: null,
  episode: null
});

assert.equal(matches.length, 1);
assert.equal(matches[0].id, 17);

await addNotification({
  unique_key: 'test-user|avatar|2022|Sinhala',
  user_id: '999',
  tmdb_id: null,
  title: 'Avatar: The Way of Water',
  year: 2022,
  season: null,
  episode: null,
  language: 'Sinhala',
  notified: false
});

await markNotificationSent(17);

assert.ok(calls.some((c) => c.options.method === 'POST'));
assert.ok(calls.some((c) => c.options.method === 'PATCH'));
assert.equal(pending.find((r) => r.id === 17).notified, true);

console.log('✅ Notify flow test passed.');
console.log('   • Notification title normalization matched successfully.');
console.log('   • Pending notification was found.');
console.log('   • Notification insert path works.');
console.log('   • Mark-as-notified path works.');
