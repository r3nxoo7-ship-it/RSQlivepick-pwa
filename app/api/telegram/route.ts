import { NextRequest, NextResponse } from 'next/server';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export async function GET(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { configured: false, error: 'Telegram Bot token not configured' },
      { status: 500 }
    );
  }
  
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action') || 'getBotInfo';
  const chatId = searchParams.get('chatId');
  
  try {
    if (action === 'getBotInfo') {
      const response = await fetch(`${TELEGRAM_API_URL}/getMe`);
      const data = await response.json();
      
      if (!data.ok) {
        return NextResponse.json(
          { configured: false, error: data.description || 'Failed to get bot info' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        configured: true,
        bot: {
          id: data.result.id,
          first_name: data.result.first_name,
          username: data.result.username,
        },
      });
    }
    
    if (action === 'verifyChat' && chatId) {
      const response = await fetch(`${TELEGRAM_API_URL}/getChat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId }),
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        return NextResponse.json(
          { success: false, error: 'Invalid chat ID or bot not started' },
          { status: 400 }
        );
      }
      
      return NextResponse.json({
        success: true,
        user: {
          id: data.result.id,
          first_name: data.result.first_name || 'Unknown',
          last_name: data.result.last_name,
          username: data.result.username,
        },
      });
    }
    
    if (action === 'getWebhookInfo') {
      const response = await fetch(`${TELEGRAM_API_URL}/getWebhookInfo`);
      const data = await response.json();
      return NextResponse.json({ success: data.ok, webhook: data.result });
    }

    if (action === 'registerWebhook') {
      const webhookUrl = searchParams.get('url');
      const secret = searchParams.get('secret') || process.env.TELEGRAM_WEBHOOK_SECRET;
      if (!webhookUrl) {
        return NextResponse.json({ success: false, error: 'url param required' }, { status: 400 });
      }
      const body: Record<string, string> = { url: webhookUrl };
      if (secret) body.secret_token = secret;
      const response = await fetch(`${TELEGRAM_API_URL}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return NextResponse.json({ success: data.ok, description: data.description });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Telegram API error:', error);
    return NextResponse.json(
      { configured: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!TELEGRAM_BOT_TOKEN) {
    return NextResponse.json(
      { success: false, error: 'Telegram Bot token not configured' },
      { status: 500 }
    );
  }
  
  try {
    const body = await request.json();
    const { action, chatId, text, parseMode } = body;
    
    if (action === 'sendMessage') {
      if (!chatId || !text) {
        return NextResponse.json(
          { success: false, error: 'Missing chatId or text' },
          { status: 400 }
        );
      }
      
      const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: parseMode || 'HTML',
        }),
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        console.error('❌ Telegram sendMessage error:', data);
        return NextResponse.json(
          { success: false, error: data.description || 'Failed to send message' },
          { status: 400 }
        );
      }
      
      console.log('✅ Telegram message sent:', data.result.message_id);
      
      return NextResponse.json({
        success: true,
        messageId: data.result.message_id,
      });
    }
    
    if (action === 'deleteWebhook') {
      const response = await fetch(`${TELEGRAM_API_URL}/deleteWebhook`, { method: 'POST' });
      const data = await response.json();
      return NextResponse.json({ success: data.ok, description: data.description });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('❌ Telegram POST error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}