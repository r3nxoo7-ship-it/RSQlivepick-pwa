import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  const { username, password, fullName } = await request.json();

  // 1. Criptăm parola aici, pe server (sigur)
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Atenție: Ai nevoie de Service Role Key aici
  );

  // Check for existing username (case-insensitive)
  const { data: existingUsers } = await supabase
    .from('users')
    .select('id')
    .ilike('username', username)
    .limit(1);

  if (existingUsers && existingUsers.length > 0) {
    return NextResponse.json(
      { error: 'Utilizatorul deja există' },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('users')
    .insert([
      { 
        username, 
        full_name: fullName, 
        password_hash: hashedPassword,
        is_active: true 
      }
    ]);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ message: 'User creat corect' });
}