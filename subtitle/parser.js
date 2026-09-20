const SUBTITLE_EXTENSIONS = new Set(['srt', 'ass', 'ssa', 'vtt']);
const ARCHIVE_EXTENSIONS = new Set(['zip']);

const NOISE_PATTERNS = [
  /\b(?:webrip|web[- ]dl|webdl|bluray|brrip|dvdrip|hdrip|hdtv|x264|x265|hevc|av1|10bit|5\.1|7\.1|aac|ac3|ddp\d*|eac3|dts|proper|repack|remux|nf|amzn|multi|subs?|subtitles?|sinhala|english|eng|sinhalasub|sinhalasubtitle|yts|etrg|srt|ass|ssa|vtt|zip)\b/gi,
  /\b(?:480p|576p|720p|1080p|1440p|2160p|4k|8k)\b/gi
];

export function isSubtitleFile(fileName = '') {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return Boolean(match && SUBTITLE_EXTENSIONS.has(match[1]));
}

export function isArchiveFile(fileName = '') {
  const match = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/);
  return Boolean(match && ARCHIVE_EXTENSIONS.has(match[1]));
}

export function subtitleFormat(fileName = '') {
  const ext = String(fileName).toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext ? ext.toUpperCase() : 'SRT';
}

function parseName(fileName = '') {
  const original = String(fileName).trim();
  const withoutExt = original.replace(/\.[a-z0-9]{2,5}$/i, '');
  const format = subtitleFormat(original);

  const se = withoutExt.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
  const seasonOnly = withoutExt.match(/\bSeason[ ._-]?(\d{1,2})\b/i) || withoutExt.match(/\bS(\d{1,2})(?![A-Za-z0-9])\b/i);
  const episodeOnly = withoutExt.match(/\b(?:Episode|Ep)[ ._-]?(\d{1,3})\b/i);
  const yearMatch = withoutExt.match(/\b((?:19|20)\d{2})\b/);

  const season = se ? Number(se[1]) : seasonOnly ? Number(seasonOnly[1]) : null;
  const episode = se ? Number(se[2]) : episodeOnly ? Number(episodeOnly[1]) : null;
  const year = yearMatch ? Number(yearMatch[1]) : null;

  let title = withoutExt;
  const cutTokens = [se?.[0], seasonOnly?.[0], episodeOnly?.[0], yearMatch?.[0]].filter(Boolean);
  for (const token of cutTokens) title = title.split(token)[0];

  title = title
    .replace(/[._-]+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(?:sinhala|english|eng|sinhalasub|subtitle|subtitles|subs|srt|ass|ssa|vtt|zip)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const normalizedTitle = normalizeTitle(title);

  return {
    fileName: original,
    title: title || normalizedTitle || original,
    normalizedTitle,
    year,
    season,
    episode,
    format,
    language: 'Sinhala'
  };
}

export function normalizeTitle(value = '') {
  let output = String(value ?? '');
  output = output.replace(/\.[a-z0-9]{2,5}$/i, '');
  output = output
    .replace(/[._-]+/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ');

  for (const pattern of NOISE_PATTERNS) output = output.replace(pattern, ' ');

  return output
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\bS\d{1,2}E\d{1,3}\b/gi, ' ')
    .replace(/\bS\d{1,2}\b/gi, ' ')
    .replace(/\bSeason\s*\d{1,2}\b/gi, ' ')
    .replace(/\bEpisode\s*\d{1,3}\b/gi, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function parseFilename(fileName = '') {
  return parseName(fileName);
}

export function parseArchiveFilename(fileName = '') {
  const parsed = parseName(fileName);
  if (!isArchiveFile(fileName)) throw new Error('Not a supported subtitle archive.');
  return parsed;
}

export function parseQuery(input = '') {
  const raw = String(input).trim();
  const se = raw.match(/\bS(\d{1,2})E(\d{1,3})\b/i);
  const seasonOnly = raw.match(/\bSeason[ ._-]?(\d{1,2})\b/i) || raw.match(/\bS(\d{1,2})(?![A-Za-z0-9])\b/i);
  const yearMatch = raw.match(/\b((?:19|20)\d{2})\b/);
  const season = se ? Number(se[1]) : seasonOnly ? Number(seasonOnly[1]) : null;
  const episode = se ? Number(se[2]) : null;

  return {
    raw,
    normalizedTitle: normalizeTitle(raw),
    season,
    episode,
    year: yearMatch ? Number(yearMatch[1]) : null
  };
}
