import { faker } from '@faker-js/faker';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import type { UserProfile, DailyTotal } from '../src/types/leaderboard';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase configuration. Please check your .env file.');
}

// Initialize Supabase client with service role key and admin headers to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      Authorization: `Bearer ${supabaseServiceKey}`,
      // This header bypasses RLS
      'x-supabase-admin-auth': 'true'
    }
  }
});

// Configuration
const NUM_USERS = 20;
const AVATAR_PROBABILITY = 0.7;        // 70% will have avatars
const POINTS_RANGE = { min: 50, max: 500 };
const TEST_DATE = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format

// Helper: generate a random integer in a given range
function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper: generate points using a normal distribution
function generatePoints(): number {
  // Use Box-Muller transform to generate normally distributed numbers
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  // Transform to our desired range
  const mean = (POINTS_RANGE.max + POINTS_RANGE.min) / 2;
  const stdDev = (POINTS_RANGE.max - POINTS_RANGE.min) / 6; // 99.7% of values within range
  const points = Math.round(z * stdDev + mean);
  
  // Clamp to our desired range
  return Math.max(POINTS_RANGE.min, Math.min(POINTS_RANGE.max, points));
}

// Step 1: Create auth users and update their profiles
async function seedUserProfiles(): Promise<UserProfile[]> {
  const userProfiles: UserProfile[] = [];
  
  for (let i = 0; i < NUM_USERS; i++) {
    // Create an auth user
    const email = faker.internet.email();
    const password = faker.internet.password();
    
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      console.error('Error creating auth user:', authError);
      throw authError;
    }

    if (!authData.user) {
      throw new Error('No user returned from createUser');
    }

    const id = authData.user.id;
    
    // Wait a bit to ensure trigger has created the profile
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Update the automatically created profile
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({
        display_name: faker.person.fullName(),
        avatar_url: Math.random() < AVATAR_PROBABILITY ? faker.image.avatar() : null,
        show_profile: true, // Always make profiles visible
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating user profile:', updateError);
      throw updateError;
    }

    // Fetch the updated profile
    const { data: profile, error: fetchError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !profile) {
      console.error('Error fetching updated profile:', fetchError);
      throw fetchError || new Error('Profile not found after update');
    }

    userProfiles.push(profile);
    console.log(`Created and updated user ${i + 1}/${NUM_USERS}`);
  }
  
  console.log(`Created ${userProfiles.length} users with profiles`);
  return userProfiles;
}

// Step 2: Generate and insert daily totals
async function seedDailyTotals(userProfiles: UserProfile[]): Promise<void> {
  console.log('Starting to seed daily totals...');
  const dailyTotals: Omit<DailyTotal, 'id'>[] = userProfiles.map(profile => {
    const total_points = generatePoints();
    // More points generally means more metrics completed
    const metrics_completed = Math.max(1, Math.min(5, Math.floor(total_points / 100)));
    
    return {
      user_id: profile.id,
      date: TEST_DATE,
      total_points,
      metrics_completed,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_test_data: true
    };
  });

  // First, clear any existing test data for today
  const { error: deleteError } = await supabase
    .from('daily_totals')
    .delete()
    .eq('date', TEST_DATE)
    .eq('is_test_data', true);

  if (deleteError) {
    console.error('Error clearing existing test data:', deleteError);
    throw deleteError;
  }

  console.log(`Cleared existing test data for date ${TEST_DATE}`);

  // Insert new daily totals
  const { error } = await supabase
    .from('daily_totals')
    .insert(dailyTotals);
  if (error) {
    console.error('Error seeding daily_totals:', error);
    throw error;
  }
  
  console.log(`Created ${dailyTotals.length} daily totals for date ${TEST_DATE}`);
}

// Main seeding function
async function seedLeaderboard() {
  try {
    console.log('Starting leaderboard seeding...');
    console.log(`Target date: ${TEST_DATE}`);
    
    const userProfiles = await seedUserProfiles();
    await seedDailyTotals(userProfiles);
    
    console.log('Leaderboard seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during leaderboard seeding:', error);
    process.exit(1);
  }
}

// Run the seeding
seedLeaderboard();
