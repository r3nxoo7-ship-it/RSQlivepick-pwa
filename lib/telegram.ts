// ============================================
// R$Q - TELEGRAM CLIENT LIBRARY
// ============================================
// Uses secure API route for all Telegram operations

// ⚠️ NU mai folosim token-ul direct!
// Toate call-urile merg prin /api/telegram (server-side)

// ============================================
// TYPES
// ============================================

export interface TelegramMessage {
  chat_id: string | number;
  text: string;
  parse_mode?: 'Markdown' | 'HTML';
  disable_notification?: boolean;
}

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

// ============================================
// CORE FUNCTIONS
// ============================================

/**
 * Check if Telegram bot is configured (via API route)
 */
export async function testTelegramConnection(): Promise<{
  configured: boolean;
  botInfo?: any;
  error?: string;
}> {
  try {
    const response = await fetch('/api/telegram?action=getBotInfo');
    const data = await response.json();
    
    return {
      configured: data.configured || false,
      botInfo: data.bot,
      error: data.error,
    };
  } catch (error) {
    return {
      configured: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Always returns false on client - check via API
 */
export function isTelegramConfigured(): boolean {
  // Client-side nu poate verifica direct
  // Trebuie să folosească testTelegramConnection()
  return false;
}

/**
 * Send message via Telegram Bot (through API route)
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  parseMode: 'Markdown' | 'HTML' = 'HTML'
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sendMessage',
        chatId,
        text,
        parseMode,
      }),
    });
    
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ Telegram API error:', data.error);
      return {
        success: false,
        error: data.error || 'Failed to send message',
      };
    }
    
    console.log('✅ Telegram message sent via API');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error sending Telegram message:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send match notification via Telegram
 */
export async function sendTelegramMatchNotification(
  chatId: string | number,
  matchData: {
    homeTeam: string;
    awayTeam: string;
    league: string;
    score: string;
    minute: number | null;
    filters: string[];
  }
): Promise<{ success: boolean; error?: string }> {
  const { homeTeam, awayTeam, league, score, minute, filters } = matchData;
  
  // Format message în HTML
  const message = `
🎯 <b>R$Q Alert - Match Found!</b>

⚽ <b>${homeTeam} vs ${awayTeam}</b>
📊 ${league}
🔢 Score: <b>${score}</b>
${minute ? `⏱️ ${minute}'` : ''}

🎯 <b>Filters Matched:</b>
${filters.map(f => `  • ${f}`).join('\n')}

💡 <i>Check the app for more details!</i>
  `.trim();
  
  return await sendTelegramMessage(chatId, message, 'HTML');
}

/**
 * Verify Telegram chat ID (through API route)
 */
export async function verifyTelegramChatId(
  chatId: string | number
): Promise<{ success: boolean; user?: TelegramUser; error?: string }> {
  try {
    const response = await fetch(`/api/telegram?action=verifyChat&chatId=${chatId}`);
    const data = await response.json();
    
    if (!data.success) {
      return {
        success: false,
        error: data.error || 'Invalid chat ID',
      };
    }
    
    return {
      success: true,
      user: data.user,
    };
    
  } catch (error) {
    console.error('❌ Error verifying chat ID:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get bot info (through API route)
 */
export async function getBotInfo(): Promise<{
  success: boolean;
  bot?: {
    id: number;
    first_name: string;
    username: string;
  };
  error?: string;
}> {
  try {
    const response = await fetch('/api/telegram?action=getBotInfo');
    const data = await response.json();
    
    if (!data.configured) {
      return {
        success: false,
        error: data.error || 'Bot not configured',
      };
    }
    
    return {
      success: true,
      bot: data.bot,
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format match data for Telegram
 */
export function formatMatchForTelegram(match: any, filters: string[]): string {
  return `
🎯 <b>Match Alert</b>

⚽ ${match.teams.home.name} vs ${match.teams.away.name}
📊 ${match.league.name}
🔢 ${match.goals.home} - ${match.goals.away}
${match.fixture.status.elapsed ? `⏱️ ${match.fixture.status.elapsed}'` : ''}

🎯 <b>Matched Filters:</b>
${filters.map((f: string) => `  • ${f}`).join('\n')}
  `.trim();
}

// ============================================
// EXPORT
// ============================================

const telegramLib = {
  isTelegramConfigured,
  sendTelegramMessage,
  sendTelegramMatchNotification,
  verifyTelegramChatId,
  getBotInfo,
  formatMatchForTelegram,
  testTelegramConnection,
};

export default telegramLib;
