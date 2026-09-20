import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import TelegramBot from 'node-telegram-bot-api';
import { isSubtitleFile, isArchiveFile, parseFilename, parseArchiveFilename, parseQuery, normalizeTitle } from './subtitle/parser.js';
import { resolveTitle, getCollectionMovies, getMovieById } from './subtitle/tmdb.js';
import {
  upsertSubtitle,
  findSubtitles,
  findSubtitleById,
  addNotification,
  createNotificationRequest,
  findNotificationRequestById,
  deleteNotificationRequest,
  getPendingNotificationsForSubtitle,
  markNotificationSent,
  pingSupabase
} from './subtitle/db.js';
import {
  searchingMessage,
  foundMessage,
  collectionMessage,
  notFoundMessage,
  notifyActivatedMessage,
  newlyAvailableMessage,
  helpMessage,
  subtitleCaption,
  errorMessage,
  welcomeMessage,
  aboutMessage
} from './subtitle/messages.js';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is missing.');

const CHANNEL_ID = String(process.env.SUBTITLE_CHANNEL_CHAT_ID || '').trim();
const GROUP_ID = String(process.env.SUBTITLE_GROUP_CHAT_ID || '').trim();
const PORT = Number(process.env.PORT || 8787);
const RESULT_LIMIT = Number(process.env.SEARCH_RESULT_LIMIT || 10);

const bot = new TelegramBot(token, {
  polling: {
    interval: Number(process.env.POLL_INTERVAL_MS || 1000),
    autoStart: true,
    params: { allowed_updates: ['message', 'channel_post', 'callback_query'] }
  }
});

const app = express();
app.get('/', (_req, res) => res.json({ ok: true, service: 'Sinhala Subtitle Bot' }));
app.get('/health', (_req, res) => res.json({ ok: true }));
app.listen(PORT, () => console.log(`🌐 Health server running on port ${PORT}`));

function safeString(value) {
  return String(value ?? '').trim();
}

function posterUrl(tmdb) {
  return tmdb?.posterPath ? `https://image.tmdb.org/t/p/w500${tmdb.posterPath}` : null;
}

async function deliverFoundResult(chatId, waitingMessageId, row, tmdb, keyboard, resultCount) {
  const caption = foundMessage(row, tmdb, resultCount);
  const replyMarkup = { inline_keyboard: keyboard };
  const poster = posterUrl(tmdb);

  if (poster) {
    await bot.deleteMessage(chatId, String(waitingMessageId)).catch(() => {});
    await bot.sendPhoto(chatId, poster, {
      caption,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    });
    return;
  }

  await bot.editMessageText(caption, {
    chat_id: chatId,
    message_id: waitingMessageId,
    parse_mode: 'HTML',
    reply_markup: replyMarkup
  });
}

function allowedChat(chat) {
  if (!chat) return false;
  if (chat.type === 'private') return true;
  return GROUP_ID && String(chat.id) === GROUP_ID;
}

async function sendPendingNotifications(savedRow) {
  const notifications = await getPendingNotificationsForSubtitle(savedRow);
  for (const notification of notifications) {
    try {
      await bot.sendDocument(notification.user_id, savedRow.telegram_file_id, {
        caption: subtitleCaption(savedRow)
      });
      await markNotificationSent(notification.id);
      console.log(`🔔 Notification sent: ${notification.user_id} -> ${savedRow.file_name}`);
    } catch (error) {
      console.error(`⚠️ Notification failed for ${notification.user_id}:`, error.message);
    }
  }
}

async function indexTelegramDocument(message, document = message?.document) {
  if (!CHANNEL_ID) return false;
  if (String(message?.chat?.id) !== CHANNEL_ID) return false;
  if (!document?.file_name) return false;
  const isSub = isSubtitleFile(document.file_name);
  const isZip = isArchiveFile(document.file_name);
  if (!isSub && !isZip) return false;

  const parsed = isZip ? parseArchiveFilename(document.file_name) : parseFilename(document.file_name);
  const tmdb = await resolveTitle(parsed.title, parsed.year);
  const title = tmdb?.title || parsed.title;
  const normalizedTitle = tmdb?.title ? normalizeTitle(tmdb.title) : parsed.normalizedTitle;
  const format = isZip ? 'ZIP' : parsed.format;

  const uniqueKey = [
    document.file_unique_id || document.file_id,
    parsed.season ?? '',
    parsed.episode ?? '',
    format
  ].join('|');

  const row = {
    unique_key: uniqueKey,
    tmdb_id: tmdb?.tmdbId || null,
    title,
    normalized_title: normalizedTitle,
    year: parsed.year || tmdb?.year || null,
    season: parsed.season,
    episode: isZip ? null : parsed.episode,
    language: 'Sinhala',
    format,
    telegram_channel_id: String(message.chat.id),
    telegram_message_id: Number(message.message_id),
    telegram_file_id: document.file_id,
    telegram_file_unique_id: document.file_unique_id || null,
    file_name: document.file_name
  };

  const saved = await upsertSubtitle(row);
  const savedRow = Array.isArray(saved) && saved[0] ? saved[0] : row;
  console.log(`✅ Indexed ${isZip ? 'full-season ZIP' : 'subtitle'}: ${document.file_name}`);
  await sendPendingNotifications(savedRow);
  return true;
}

async function indexChannelDocument(message) {
  if (!CHANNEL_ID || String(message?.chat?.id) !== CHANNEL_ID) return;
  const document = message.document;
  if (!document?.file_name) return;

  try {
    // IMPORTANT: ZIP files are NEVER extracted or re-uploaded.
    // The original Telegram ZIP file_id is stored and the same ZIP is later sent to the user.
    await indexTelegramDocument(message, document);
  } catch (error) {
    console.error('❌ Channel indexing failed:', error.message);
  }
}

async function searchMovieByResolvedTitle(chatId, messageId, tmdbMovie, originalQuery, backCollectionId = null) {
  const parsedQuery = parseQuery(originalQuery);
  let results = await findSubtitles({
    normalizedTitle: parsedQuery.normalizedTitle,
    tmdbId: tmdbMovie.tmdbId,
    year: null,
    season: null,
    episode: null,
    limit: RESULT_LIMIT
  });

  if (!results?.length) {
    results = await findSubtitles({
      normalizedTitle: parsedQuery.normalizedTitle,
      tmdbId: null,
      year: tmdbMovie.year || null,
      season: null,
      episode: null,
      limit: RESULT_LIMIT
    });
  }

  if (!results?.length) {
    results = await findSubtitles({
      normalizedTitle: normalizeTitle(tmdbMovie.title || ''),
      tmdbId: null,
      year: null,
      season: null,
      episode: null,
      limit: RESULT_LIMIT
    });
  }

  if (!results?.length) {
    const request = await createNotificationRequest({
      user_id: String(chatId),
      title: tmdbMovie.title,
      tmdb_id: tmdbMovie.tmdbId,
      year: tmdbMovie.year || null,
      season: null,
      episode: null,
      language: 'Sinhala'
    });
    const requestId = Array.isArray(request) && request[0]?.id ? request[0].id : request?.id;
    if (!requestId) throw new Error('Could not create notification request.');

    const notFoundButtons = [[{ text: '🔔 𝑵𝑶𝑻𝑰𝑭𝒀 𝑴𝑬', callback_data: `subtitle_notify:${requestId}` }]];
    if (backCollectionId) {
      notFoundButtons.push([{ text: '↩️ 𝑩𝑨𝑪𝑲 𝑻𝑶 𝑪𝑶𝑳𝑳𝑬𝑪𝑻𝑰𝑶𝑵', callback_data: `collection_back:${backCollectionId}` }]);
    }
    await bot.editMessageText(notFoundMessage(tmdbMovie.title), {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: { inline_keyboard: notFoundButtons }
    });
    return;
  }

  const row = results[0];
  const keyboard = results.map((item) => [{
    text: item.format === 'ZIP'
      ? `📦 DOWNLOAD ${item.season != null ? `SEASON ${String(item.season).padStart(2, '0')} ` : ''}ZIP`
      : `📥 ${item.format}`,
    callback_data: `subtitle_get:${item.id}`
  }]);
  if (backCollectionId) {
    keyboard.push([{
      text: '↩️ 𝑩𝑨𝑪𝑲 𝑻𝑶 𝑪𝑶𝑳𝑳𝑬𝑪𝑻𝑰𝑶𝑵',
      callback_data: `collection_back:${backCollectionId}`
    }]);
  }

  await deliverFoundResult(chatId, messageId, row, tmdbMovie, keyboard, results.length);
}

async function showCollection(chatId, messageId, query, tmdb) {
  if (!tmdb?.collectionId) return false;
  const movies = await getCollectionMovies(tmdb.collectionId);
  if (movies.length < 2) return false;

  const keyboard = movies.map((movie) => [{
    text: `🎬 ${movie.title}${movie.year ? ` (${movie.year})` : ''}`,
    callback_data: `collection_movie:${movie.tmdbId}:${tmdb.collectionId}`
  }]);

  await bot.editMessageText(collectionMessage(query, tmdb, movies), {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: keyboard }
  });
  return true;
}

async function performSearch(chatId, rawQuery, replyToMessageId = null) {
  const parsedQuery = parseQuery(rawQuery);
  if (!parsedQuery.normalizedTitle) return;

  const waiting = await bot.sendMessage(chatId, searchingMessage(rawQuery), {
    reply_to_message_id: replyToMessageId || undefined
  });

  try {
    const titleOnlyQuery = rawQuery
      .replace(/\bS\d{1,2}E\d{1,3}\b/gi, '')
      .replace(/\bSeason[ ._-]?\d{1,2}\b/gi, '')
      .replace(/\bS\d{1,2}\b/gi, '')
      .trim();
    const tmdb = await resolveTitle(titleOnlyQuery || rawQuery, parsedQuery.year);

    if (tmdb?.mediaType === 'movie' && parsedQuery.season == null && parsedQuery.episode == null && !parsedQuery.year) {
      const collectionShown = await showCollection(chatId, waiting.message_id, rawQuery, tmdb);
      if (collectionShown) return;
    }

    let results = await findSubtitles({
      normalizedTitle: parsedQuery.normalizedTitle,
      tmdbId: tmdb?.tmdbId || null,
      year: parsedQuery.year,
      season: parsedQuery.season,
      episode: parsedQuery.episode,
      limit: RESULT_LIMIT
    });

    if ((!results || !results.length) && tmdb?.tmdbId) {
      results = await findSubtitles({
        normalizedTitle: normalizeTitle(tmdb.title || titleOnlyQuery || rawQuery),
        tmdbId: null,
        year: parsedQuery.year || tmdb.year,
        season: parsedQuery.season,
        episode: parsedQuery.episode,
        limit: RESULT_LIMIT
      });
    }

    if (!results || !results.length) {
      const request = await createNotificationRequest({
        user_id: String(chatId),
        title: tmdb?.title || titleOnlyQuery || rawQuery,
        tmdb_id: tmdb?.tmdbId || null,
        year: parsedQuery.year || tmdb?.year || null,
        season: parsedQuery.season,
        episode: parsedQuery.episode,
        language: 'Sinhala'
      });
      const requestId = Array.isArray(request) && request[0]?.id ? request[0].id : request?.id;
      if (!requestId) throw new Error('Could not create notification request.');

      await bot.editMessageText(notFoundMessage(rawQuery), {
        chat_id: chatId,
        message_id: waiting.message_id,
        reply_markup: { inline_keyboard: [[{ text: '🔔 NOTIFY ME', callback_data: `subtitle_notify:${requestId}` }]] }
      });
      return;
    }

    const row = results[0];
    const keyboard = results.map((item) => {
      const label = item.format === 'ZIP'
        ? `📦 𝑫𝑶𝑾𝑵𝑳𝑶𝑨𝑫 • ${item.season != null ? `S${String(item.season).padStart(2, '0')} • ` : ''}FULL SEASON ZIP`
        : item.season != null && item.episode != null
          ? `📥 S${String(item.season).padStart(2, '0')}E${String(item.episode).padStart(2, '0')} • ${item.format}`
          : `📥 ${item.format} • ${item.year || 'Movie'}`;
      return [{ text: label, callback_data: `subtitle_get:${item.id}` }];
    });

    await deliverFoundResult(chatId, waiting.message_id, row, tmdb, keyboard, results.length);
  } catch (error) {
    console.error('❌ Search failed:', error.message);
    await bot.editMessageText(errorMessage(), {
      chat_id: chatId,
      message_id: waiting.message_id
    });
  }
}

bot.on('channel_post', indexChannelDocument);

bot.on('message', async (message) => {
  if (!allowedChat(message.chat)) return;
  if (message.from?.is_bot) return;

  const text = safeString(message.text);
  if (!text) return;

  if (text === '/start') {
    const welcomeImage = path.join(process.cwd(), 'assets', 'cine-universe-welcome.png');
    const keyboard = {
      inline_keyboard: [
        [{ text: '🔎 𝑺𝑬𝑨𝑹𝑪𝑯 𝑺𝑼𝑩𝑻𝑰𝑻𝑳𝑬', callback_data: 'welcome_search' }],
        [{ text: '📖 𝑯𝑶𝑾 𝑻𝑶 𝑼𝑺𝑬', callback_data: 'welcome_help' }, { text: 'ℹ️ 𝑨𝑩𝑶𝑼𝑻', callback_data: 'welcome_about' }]
      ]
    };
    try {
      await bot.sendPhoto(message.chat.id, welcomeImage, {
        caption: welcomeMessage(),
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
    } catch (error) {
      console.error('⚠️ Welcome poster send failed:', error.message);
      await bot.sendMessage(message.chat.id, welcomeMessage(), { reply_markup: keyboard });
    }
    return;
  }

  if (text === '/help') {
    await bot.sendMessage(message.chat.id, helpMessage());
    return;
  }

  if (text.startsWith('/')) return;
  await performSearch(message.chat.id, text, message.message_id);
});

bot.on('callback_query', async (query) => {
  const data = safeString(query.data);
  const chatId = query.message?.chat?.id;

  try {
    if (data === 'welcome_search') {
      await bot.answerCallbackQuery(query.id, { text: 'Send a movie or series title 🔎' });
      if (chatId) await bot.sendMessage(chatId, '🔎 𝑺𝒆𝒏𝒅 a movie or series name now.\n\n🎬 Avatar 2009\n📺 Silo S03\n🎞️ The Last of Us S02E03');
      return;
    }

    if (data === 'welcome_help') {
      await bot.answerCallbackQuery(query.id);
      if (chatId) await bot.sendMessage(chatId, helpMessage());
      return;
    }

    if (data === 'welcome_about') {
      await bot.answerCallbackQuery(query.id);
      if (chatId) await bot.sendMessage(chatId, aboutMessage());
      return;
    }

    if (data.startsWith('collection_movie:')) {
      const parts = data.slice('collection_movie:'.length).split(':');
      const tmdbId = Number(parts[0]);
      const collectionId = Number(parts[1]);
      const movie = await getMovieById(tmdbId);
      if (!movie) {
        await bot.answerCallbackQuery(query.id, { text: 'Movie details not available.' });
        return;
      }
      await bot.answerCallbackQuery(query.id, { text: 'Searching Sinhala subtitles…' });
      if (!chatId || !query.message?.message_id) return;
      await searchMovieByResolvedTitle(chatId, query.message.message_id, movie, movie.title, Number.isInteger(collectionId) && collectionId > 0 ? collectionId : null);
      return;
    }

    if (data.startsWith('collection_back:')) {
      const collectionId = Number(data.slice('collection_back:'.length));
      const movies = await getCollectionMovies(collectionId);
      if (!movies.length || !chatId || !query.message?.message_id) {
        await bot.answerCallbackQuery(query.id, { text: 'Collection unavailable.' });
        return;
      }
      const tmdb = { collectionId, collectionName: movies[0]?.collectionName || 'Collection' };
      const keyboard = movies.map((item) => [{
        text: `🎬 ${item.title}${item.year ? ` (${item.year})` : ''}`,
        callback_data: `collection_movie:${item.tmdbId}:${collectionId}`
      }]);
      await bot.answerCallbackQuery(query.id);
      const collectionText = collectionMessage(tmdb.collectionName, tmdb, movies);
      try {
        await bot.editMessageText(collectionText, {
          chat_id: chatId,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: keyboard }
        });
      } catch {
        await bot.deleteMessage(chatId, String(query.message.message_id)).catch(() => {});
        await bot.sendMessage(chatId, collectionText, { reply_markup: { inline_keyboard: keyboard } });
      }
      return;
    }

    if (data.startsWith('subtitle_get:')) {
      const id = Number(data.split(':')[1]);
      const row = await findSubtitleById(id);
      if (!row) {
        await bot.answerCallbackQuery(query.id, { text: 'Subtitle pack no longer available.' });
        return;
      }
      await bot.answerCallbackQuery(query.id, { text: row.format === 'ZIP' ? 'Sending full season ZIP…' : 'Sending subtitle…' });
      await bot.sendDocument(chatId, row.telegram_file_id, { caption: subtitleCaption(row) });
      return;
    }

    if (data.startsWith('subtitle_notify:')) {
      const requestId = Number(data.slice('subtitle_notify:'.length));
      if (!Number.isInteger(requestId) || requestId <= 0) {
        await bot.answerCallbackQuery(query.id, { text: 'Invalid notification request.' });
        return;
      }
      const request = await findNotificationRequestById(requestId);
      if (!request) {
        await bot.answerCallbackQuery(query.id, { text: 'This notification request has expired.' });
        return;
      }
      const userId = String(query.from.id);
      if (String(request.user_id) !== userId) {
        await bot.answerCallbackQuery(query.id, { text: 'This button belongs to another user.' });
        return;
      }
      const uniqueKey = [userId, request.tmdb_id || '', String(request.title || '').toLowerCase(), request.year || '', request.season ?? '', request.episode ?? '', 'Sinhala'].join('|');
      await addNotification({
        unique_key: uniqueKey,
        user_id: userId,
        tmdb_id: request.tmdb_id || null,
        title: String(request.title || '').trim(),
        year: request.year || null,
        season: request.season ?? null,
        episode: request.episode ?? null,
        language: 'Sinhala',
        notified: false
      });
      await deleteNotificationRequest(requestId);
      await bot.answerCallbackQuery(query.id, { text: 'Notification activated ✅' });
      if (chatId) await bot.sendMessage(chatId, notifyActivatedMessage(request.title));
      return;
    }
  } catch (error) {
    console.error('❌ Callback error:', error.message);
    try { await bot.answerCallbackQuery(query.id, { text: 'Something went wrong.' }); } catch {}
  }
});

bot.on('polling_error', (error) => console.error('⚠️ Telegram polling error:', error.message));

async function startupCheck() {
  try {
    await bot.getMe();
    await pingSupabase();
    console.log('✅ Telegram bot connected.');
    console.log('✅ Supabase connected.');
    console.log(`📺 Subtitle channel: ${CHANNEL_ID || '(not configured)'}`);
    console.log(`👥 Subtitle group: ${GROUP_ID || '(not configured)'}`);
    console.log('📦 Full-season ZIP mode: ORIGINAL ZIP preserved; no extraction/re-upload.');
  } catch (error) {
    console.error('⚠️ Startup check failed:', error.message);
  }
}

startupCheck();
