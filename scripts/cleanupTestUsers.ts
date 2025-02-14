import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupTestUsers() {
  try {
    console.log('Starting test user cleanup...');

    // First, get all test users from daily_totals
    const { data: dailyTotals, error: dailyTotalsError } = await supabase
      .from('daily_totals')
      .select('user_id')
      .eq('is_test_data', true);

    if (dailyTotalsError) throw dailyTotalsError;

    const testUserIds = dailyTotals?.map(record => record.user_id) || [];
    console.log(`Found ${testUserIds.length} test users in daily_totals`);

    // Delete records in order to maintain referential integrity
    if (testUserIds.length > 0) {
      // 1. Delete daily_totals records
      const { error: deleteDailyTotalsError } = await supabase
        .from('daily_totals')
        .delete()
        .in('user_id', testUserIds);

      if (deleteDailyTotalsError) throw deleteDailyTotalsError;
      console.log('Deleted daily_totals records');

      // 2. Delete user_profiles records
      const { error: deleteProfilesError } = await supabase
        .from('user_profiles')
        .delete()
        .in('id', testUserIds);

      if (deleteProfilesError) throw deleteProfilesError;
      console.log('Deleted user_profiles records');

      // 3. Delete auth.users records (requires service role key)
      for (const userId of testUserIds) {
        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteUserError) {
          console.error(`Failed to delete auth user ${userId}:`, deleteUserError);
        }
      }
      console.log('Deleted auth users');

      // 4. Clean up any orphaned avatar files
      const { data: files, error: listError } = await supabase.storage
        .from('avatars')
        .list();

      if (listError) throw listError;

      const testUserAvatars = files?.filter(file => 
        testUserIds.some(id => file.name.startsWith(`${id}-`))
      ) || [];

      if (testUserAvatars.length > 0) {
        const { error: deleteFilesError } = await supabase.storage
          .from('avatars')
          .remove(testUserAvatars.map(file => file.name));

        if (deleteFilesError) throw deleteFilesError;
        console.log(`Deleted ${testUserAvatars.length} avatar files`);
      }
    }

    console.log('Cleanup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupTestUsers();
