/**
 * POST /api/telegram/webhook
 *
 * Receives incoming Telegram Bot updates (messages, commands).
 * Must be registered as the Telegram webhook URL:
 *
 *   https://api.telegram.org/bot{TOKEN}/setWebhook
 *     ?url=https://your-domain.vercel.app/api/telegram/webhook
 *     &secret_token={TELEGRAM_WEBHOOK_SECRET}
 *
 * Set TELEGRAM_WEBHOOK_SECRET in Vercel env vars — Telegram sends it as
 * the X-Telegram-Bot-Api-Secret-Token header on every request.
 *
 * Supported commands:
 *   /start  — Welcome message, shows the user's Chat ID so they can paste
 *             it into the LivePick app (Settings → Telegram)
 *   /id     — Same as /start but shorter
 *   /help   — Usage instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

// Supabase service-role client (for auto phone linking if needed later)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ─── Send a Telegram message ──────────────────────────────────────────────────

async function reply(chatId: number | string, text: string, extra?: object) {
  if (!BOT_TOKEN) return;
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra }),
  });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Validate Telegram's secret token header
  if (WEBHOOK_SECRET) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token');
    if (incoming !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (!BOT_TOKEN) {
    return NextResponse.json({ error: 'Bot not configured' }, { status: 500 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const msg = update?.message;
  if (!msg) {
    // Non-message updates (inline queries, etc.) — just acknowledge
    return NextResponse.json({ ok: true });
  }

  const chatId = msg.chat?.id;
  const text = (msg.text ?? '').trim().toLowerCase();
  const firstName = msg.from?.first_name ?? 'there';

  // ── /start or /id — return Chat ID ─────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ') || text === '/id') {
    await reply(
      chatId,
      [
        `👋 Hello, <b>${firstName}</b>! Welcome to <b>LivePick</b>.`,
        ``,
        `Your <b>Telegram Chat ID</b> is:`,
        ``,
        `<code>${chatId}</code>`,
        ``,
        `Copy this ID and paste it in the LivePick app:`,
        `<b>Dashboard → Settings → Telegram</b>`,
        ``,
        `Once connected, you'll receive live match alerts automatically — no need to keep the app open! ⚽`,
      ].join('\n'),
    );

    // Try to auto-link if the user's Telegram username matches a profile
    // (Optional enhancement — works only if users have the same username in their profile)
    if (msg.from?.username) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, telegram_chat_id')
          .eq('telegram_username', msg.from.username)
          .single();

        if (profile && !profile.telegram_chat_id) {
          await supabase
            .from('profiles')
            .update({
              telegram_chat_id: String(chatId),
              telegram_enabled: true,
              telegram_verified_at: new Date().toISOString(),
            })
            .eq('id', profile.id);

          await reply(
            chatId,
            `✅ <b>Auto-linked!</b> Your LivePick account (@${msg.from.username}) has been connected. You'll now receive notifications here.`,
          );
        }
      } catch { /* no profile with this username — that's fine */ }
    }

    return NextResponse.json({ ok: true });
  }

  // ── /help ────────────────────────────────────────────────────────────────────
  if (text === '/help') {
    await reply(
      chatId,
      [
        `<b>LivePick Bot — Help</b>`,
        ``,
        `/start or /id — Get your Chat ID to connect in the app`,
        `/help — Show this message`,
        ``,
        `<b>How to set up notifications:</b>`,
        `1. Send /start to get your Chat ID`,
        `2. Open LivePick → Settings → Telegram`,
        `3. Paste your Chat ID and click Verify`,
        `4. Enable Telegram on your filters`,
        ``,
        `You'll then receive live match alerts automatically. ⚽`,
      ].join('\n'),
    );
    return NextResponse.json({ ok: true });
  }

  // ── Unknown message — gentle guidance ────────────────────────────────────────
  await reply(
    chatId,
    `I don't understand that command. Send /start to get your Chat ID, or /help for instructions.`,
  );

  return NextResponse.json({ ok: true });
}

// Telegram only POSTs to webhooks — return 405 for other methods
export async function GET() {
  return NextResponse.json(
    { message: 'LivePick Telegram Webhook is active. Use /start in the bot.' },
    { status: 200 },
  );
}
