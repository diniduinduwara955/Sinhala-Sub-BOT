const BRAND = '🎬 𝑪𝑰𝑵𝑬 𝑼𝑵𝑰𝑽𝑬𝑹𝑺𝑬';
const DIVIDER = '━━━━━━━━━━━━━━━━━━━━';
const FOOTER = [
  DIVIDER,
  '⚡ 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑺𝒀𝑺𝑻𝑬𝑴',
  '© 𝑫𝒊𝒏𝒊𝒅𝒖 𝑰𝒏𝒅𝒖𝒘𝒂𝒓𝒂'
];

function rowLabel(row) {
  if (row.format === 'ZIP') {
    if (row.season != null) return `📦 𝑭𝒖𝒍𝒍 𝑺𝒆𝒂𝒔𝒐𝒏 ${String(row.season).padStart(2, '0')} • ZIP`;
    return '📦 𝑭𝒖𝒍𝒍 𝑺𝒆𝒂𝒔𝒐𝒏 • ZIP';
  }
  const bits = [];
  if (row.season != null) bits.push(`𝑺𝒆𝒂𝒔𝒐𝒏 ${String(row.season).padStart(2, '0')}`);
  if (row.episode != null) bits.push(`𝑬𝒑𝒊𝒔𝒐𝒅𝒆 ${String(row.episode).padStart(2, '0')}`);
  return bits.length ? bits.join(' • ') : '𝑴𝒐𝒗𝒊𝒆';
}

export function searchingMessage(query) {
  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '🔎 𝑺𝒆𝒂𝒓𝒄𝒉𝒊𝒏𝒈',
    `🎞️ ${query}`,
    '',
    '🔍 Identifying title... 🟢',
    '🇱🇰 Searching Sinhala subtitle database... 🟡',
    '',
    '⏳ 𝑷𝒍𝒆𝒂𝒔𝒆 𝑾𝒂𝒊𝒕...',
    ...FOOTER
  ].join('\n');
}

export function notFoundMessage(query) {
  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '🔎 𝑺𝒆𝒂𝒓𝒄𝒉 𝑹𝒆𝒔𝒖𝒍𝒕',
    `🎞️ ${query}`,
    '',
    '❌ 𝑺𝒊𝒏𝒉𝒂𝒍𝒂 𝒔𝒖𝒃𝒕𝒊𝒕𝒍𝒆 𝒏𝒐𝒕 𝒇𝒐𝒖𝒏𝒅.',
    '',
    '🔔 𝑾𝒂𝒏𝒕 𝒕𝒐 𝒃𝒆 𝒏𝒐𝒕𝒊𝒇𝒊𝒆𝒅 𝒘𝒉𝒆𝒏 𝒊𝒕 𝒊𝒔 𝒂𝒅𝒅𝒆𝒅?',
    '',
    ...FOOTER
  ].join('\n');
}

export function collectionMessage(query, tmdb, movies) {
  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '🎞️ 𝑴𝒐𝒗𝒊𝒆 𝑪𝒐𝒍𝒍𝒆𝒄𝒕𝒊𝒐𝒏',
    `🔎 𝑺𝒆𝒂𝒓𝒄𝒉 • ${query}`,
    `📚 ${tmdb?.collectionName || 'Collection'}`,
    `🎬 ${movies.length} movie${movies.length === 1 ? '' : 's'} available`,
    '',
    '👇 𝑺𝒆𝒍𝒆𝒄𝒕 𝒂 𝒎𝒐𝒗𝒊𝒆',
    '',
    ...FOOTER
  ].join('\n');
}

export function foundMessage(row, tmdb = null, resultCount = 1) {
  const year = row.year || tmdb?.year || '—';
  const rating = typeof tmdb?.rating === 'number' ? `${tmdb.rating.toFixed(1)} / 10` : '—';
  const isZip = row.format === 'ZIP';
  const title = tmdb?.title || row.title;
  const typeLine = row.season != null
    ? `📺 𝑺𝒆𝒂𝒔𝒐𝒏 ${String(row.season).padStart(2, '0')}  •  📅 ${year}`
    : `🎬 𝑴𝒐𝒗𝒊𝒆  •  📅 ${year}`;

  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '🔎 𝑺𝒆𝒂𝒓𝒄𝒉 𝑹𝒆𝒔𝒖𝒍𝒕',
    `🎞️  ${title}`,
    typeLine,
    `⭐ 𝑻𝑴𝑫𝑩  ${rating}`,
    '',
    '🇱🇰 𝑺𝒖𝒃𝒕𝒊𝒕𝒍𝒆',
    'Language  •  Sinhala',
    `Format    •  ${isZip ? 'ZIP  •  Full Season' : row.format}`,
    `Content   •  ${isZip ? '📦  Complete Season Pack' : 'Single Subtitle'}`,
    'Status    •  🟢  𝑨𝒗𝒂𝒊𝒍𝒂𝒃𝒍𝒆',
    resultCount > 1 ? `📚  ${resultCount} matching packs available` : '',
    '',
    '📥 𝑫𝒐𝒘𝒏𝒍𝒐𝒂𝒅',
    isZip ? '👇  𝑭𝒖𝒍𝒍 𝑺𝒆𝒂𝒔𝒐𝒏 𝒁𝑰𝑷 𝒊𝒔 𝒓𝒆𝒂𝒅𝒚.' : '👇  𝑺𝒊𝒏𝒉𝒂𝒍𝒂 𝑺𝒖𝒃𝒕𝒊𝒕𝒍𝒆 𝒊𝒔 𝒓𝒆𝒂𝒅𝒚.',
    '',
    ...FOOTER
  ].filter(Boolean).join('\n');
}

export function subtitleCaption(row) {
  const parts = ['🎬 CINE UNIVERSE', row.title];
  if (row.year) parts.push(String(row.year));
  if (row.season != null) parts.push(`S${String(row.season).padStart(2, '0')}`);
  if (row.episode != null) parts.push(`E${String(row.episode).padStart(2, '0')}`);
  parts.push(row.format === 'ZIP' ? '📦 Full Season ZIP' : `🇱🇰 Sinhala • ${row.format}`);
  parts.push('© Dinidu Induwara');
  return parts.join(' • ');
}

export function zipImportCaption(fileName) {
  return [
    '🎬 CINE UNIVERSE',
    `📦 SEASON ZIP • ${fileName}`,
    '🇱🇰 Sinhala Subtitle Repository',
    '✅ Original ZIP preserved',
    '© Dinidu Induwara'
  ].join('\n');
}

export function notifyActivatedMessage(query) {
  return [
    BRAND,
    '🔔 𝑵𝑶𝑻𝑰𝑭𝒀 𝑴𝑬',
    DIVIDER,
    '',
    `🎞️ ${query}`,
    '',
    '✅ 𝑵𝒐𝒕𝒊𝒇𝒊𝒄𝒂𝒕𝒊𝒐𝒏 𝒂𝒄𝒕𝒊𝒗𝒂𝒕𝒆𝒅.',
    '📩 We will notify you when the Sinhala subtitle or full-season ZIP is added.',
    '',
    ...FOOTER
  ].join('\n');
}

export function newlyAvailableMessage(row) {
  return [
    BRAND,
    '🟢 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑵𝑶𝑾 𝑨𝑽𝑨𝑰𝑳𝑨𝑩𝑳𝑬',
    DIVIDER,
    '',
    `🎞️ ${row.title}`,
    row.season != null ? `📺 S${String(row.season).padStart(2, '0')}` : '🎬 Movie',
    row.format === 'ZIP' ? '📦 Full Season ZIP' : `📦 ${row.format}`,
    '',
    row.format === 'ZIP'
      ? '✅ Your requested complete season ZIP is now available.'
      : '✅ Your requested Sinhala subtitle is now available.',
    '',
    ...FOOTER
  ].join('\n');
}


export function welcomeMessage() {
  return [
    '🎬 𝑪𝑰𝑵𝑬 𝑼𝑵𝑰𝑽𝑬𝑹𝑺𝑬',
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '👋 𝑾𝒆𝒍𝒄𝒐𝒎𝒆 𝒕𝒐 𝒕𝒉𝒆 𝑼𝒏𝒊𝒗𝒆𝒓𝒔𝒆!',
    '',
    '🎞️ Movies & TV Series',
    '🇱🇰 Sinhala Subtitle Search',
    '🖼️ TMDB Poster • ⭐ Rating',
    '📦 Full Season ZIP Packs',
    '🔔 Smart Notify Me',
    '',
    '🔎 𝑱𝒖𝒔𝒕 𝒔𝒆𝒏𝒅 𝒂 𝒕𝒊𝒕𝒍𝒆',
    '🎬 Avatar 2009',
    '📺 Silo S03',
    '🎞️ The Last of Us S02E03',
    '',
    '✨ 𝑺𝒆𝒂𝒓𝒄𝒉 • 𝑺𝒆𝒍𝒆𝒄𝒕 • 𝑫𝒐𝒘𝒏𝒍𝒐𝒂𝒅',
    '',
    ...FOOTER
  ].join('\n');
}

export function aboutMessage() {
  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '🎬 Movie & TV Series subtitle finder',
    '🖼️ TMDB poster & rating support',
    '📦 Full-season ZIP delivery',
    '🔔 Notify Me availability alerts',
    '',
    '⚡ 𝑭𝒂𝒔𝒕 • 𝑪𝒊𝒏𝒆𝒎𝒂𝒕𝒊𝒄 • 𝑺𝒊𝒎𝒑𝒍𝒆',
    '',
    ...FOOTER
  ].join('\n');
}

export function errorMessage() {
  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '⚠️ Something went wrong while processing your request.',
    '🔄 Please try again in a moment.',
    '',
    ...FOOTER
  ].join('\n');
}

export function helpMessage() {
  return [
    BRAND,
    '🇱🇰 𝑺𝑰𝑵𝑯𝑨𝑳𝑨 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬 𝑭𝑰𝑵𝑫𝑬𝑹',
    DIVIDER,
    '',
    '🔎 𝑺𝒆𝒏𝒅 a movie or series name.',
    '📺 Series • The Last of Us S02E03',
    '📦 Full season • The Last of Us S02',
    '🎞️ Movie • Interstellar 2014',
    '',
    '📚 Movie collections are shown automatically when TMDB provides one.',
    '📦 Full-season ZIP files are kept intact and sent as the original ZIP.',
    '🔔 Use Notify Me when a subtitle or season ZIP is not yet available.',
    '',
    ...FOOTER
  ].join('\n');
}
