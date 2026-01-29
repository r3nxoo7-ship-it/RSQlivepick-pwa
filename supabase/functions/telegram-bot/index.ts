import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// These two variables are provided automatically by Supabase (do not set them manually)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

// The bot token is set in environment variables
const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN')

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

serve(async (req) => {
  try {
    const update = await req.json()

    // 1. When the user sends contact (phone number)
    if (update.message?.contact) {
      const phoneNumber = update.message.contact.phone_number.replace('+', '')
      const chatId = update.message.chat.id.toString()

      // Look up the profile by phone number (ensure the table/column exist)
      const { data: profile, error: searchError } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phoneNumber)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({ 
            telegram_chat_id: chatId,
            telegram_enabled: true,
            telegram_verified_at: new Date().toISOString()
          })
          .eq('id', profile.id)

        await sendToTelegram(chatId, "✅ Account connected successfully! You will receive notifications here.")
      } else {
        await sendToTelegram(chatId, "❌ Phone number not found in the application. Please check your profile settings in the app.")
      }
    } 
    
    // 2. Mesajul de start
    else if (update.message?.text === "/start") {
      await sendToTelegram(update.message.chat.id, "Hello! Press the button below to enable notifications:", {
        keyboard: [[{ text: "📲 Send your phone number", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true
      })
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (err) {
    console.error("Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { status: 200 })
  }
})

async function sendToTelegram(chatId: string, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      reply_markup: replyMarkup,
      parse_mode: 'HTML'
    })
  })
}