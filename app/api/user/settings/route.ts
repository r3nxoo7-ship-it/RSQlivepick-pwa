import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

// Create admin client with service role key for bypassing RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, userId, full_name, email, currentPassword, newPassword } = body;

    // Get user from cookies/session
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('rsq_session');

    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Unauthorized - no session' },
        { status: 401 }
      );
    }

    // Validate userId is provided
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'updateProfile': {
        if (!full_name && !email) {
          return NextResponse.json(
            { error: 'At least one field must be provided' },
            { status: 400 }
          );
        }

        const updateData: any = {};
        if (full_name) updateData.full_name = full_name;
        if (email) updateData.email = email;
        updateData.updated_at = new Date().toISOString();

        console.log('📝 Updating user profile:', { userId, ...updateData });

        const { data, error } = await supabaseAdmin
          .from('users')
          .update(updateData)
          .eq('id', userId)
          .select('id, username, full_name, email, is_admin, updated_at')
          .single();

        if (error) {
          console.error('❌ Profile update error:', error);
          return NextResponse.json(
            { error: 'Failed to update profile: ' + error.message },
            { status: 400 }
          );
        }

        console.log('✅ Profile updated successfully:', data);

        return NextResponse.json({
          success: true,
          message: 'Profile updated successfully',
          data: data,
        });
      }

      case 'changePassword': {
        if (!currentPassword || !newPassword) {
          return NextResponse.json(
            { error: 'Current and new passwords are required' },
            { status: 400 }
          );
        }

        // Get current user using admin client
        const { data: users, error: getUserError } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('id', userId)
          .limit(1);

        if (getUserError || !users || users.length === 0) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        const user = users[0];

        // Verify current password
        const isValidPassword = bcrypt.compareSync(currentPassword, user.password_hash);
        if (!isValidPassword) {
          return NextResponse.json(
            { error: 'Current password is incorrect' },
            { status: 401 }
          );
        }

        // Hash new password
        const newPasswordHash = bcrypt.hashSync(newPassword, 10);

        console.log('🔐 Changing password for user:', userId);

        // Update password using admin client
        const { data, error: updateError } = await supabaseAdmin
          .from('users')
          .update({
            password_hash: newPasswordHash,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
          .select();

        if (updateError) {
          console.error('❌ Password update error:', updateError);
          return NextResponse.json(
            { error: 'Failed to change password: ' + updateError.message },
            { status: 400 }
          );
        }

        console.log('✅ Password changed successfully');

        return NextResponse.json({
          success: true,
          message: 'Password changed successfully',
        });
      }

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
