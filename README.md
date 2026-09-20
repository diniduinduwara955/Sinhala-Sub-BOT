# Sinhala Subtitles Telegram Bot

Standalone Telegram bot for an authorized Sinhala subtitle repository.

## Welcome poster
- `/start` sends the included `assets/cine-universe-welcome.png` as the top image of the welcome message.
- Welcome buttons provide Search, How To Use, and About actions.

## Core flow
- Upload individual `.srt/.ass/.ssa/.vtt` files to a dedicated Telegram channel.
- Upload a **full-season `.zip`** to the same channel when you want the whole season delivered as one archive.
- ZIP files are **not extracted, not split, and not re-uploaded as individual subtitle files**.
- The bot stores the original Telegram `file_id` and metadata in Supabase.
- Users search movie/series names and can select a full-season ZIP when available.
- Clicking the ZIP button sends the **original ZIP document** exactly as uploaded to the repository channel.
- Movie collections are shown automatically when TMDB provides a collection.
- Notify Me requests are persisted in Supabase and are triggered when a matching subtitle or full-season ZIP is indexed.
