import { supabase } from './supabaseClient';
import { 
  LeaderboardEntry, 
  UserProfile,
  LeaderboardTimeframe,
  DailyTotal,
  WeeklyTotal
} from '../types/leaderboard';
import type { DailyMetricScore } from '../types/schemas';
import { calculateTotalPoints, safeGetPoints } from '../utils/pointsCalculator';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'expo-image';

// Define types for Supabase response data
interface SupabaseDailyTotalWithProfile {
  id: string;
  user_id: string;
  date: string;
  total_points: number;
  metrics_completed: number;
  user_profiles: UserProfile | null;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseWeeklyTotalWithProfile {
  id: string;
  user_id: string;
  week_start: string;
  total_points: number;
  metrics_completed: number;
  user_profiles: UserProfile | null;
  created_at?: string;
  updated_at?: string;
  is_test_data?: boolean;
}

interface SupabaseDailyTotalWithProfileJoin {
  user_id: string;
  total_points: number;
  metrics_completed: number;
  user_profiles: UserProfile | null;
}

// Helper function to get week start date
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Set to Sunday
  return d.toISOString().split('T')[0];
}

export const leaderboardService = {
  subscribeToLeaderboard(date: string, timeframe: LeaderboardTimeframe, onUpdate: (entries: LeaderboardEntry[]) => void) {
    console.log(`Setting up ${timeframe} leaderboard subscription for date:`, date);
    
    const table = timeframe === 'daily' ? 'daily_totals' : 'weekly_totals';
    const dateField = timeframe === 'daily' ? 'date' : 'week_start';
    const dateValue = timeframe === 'daily' ? date : getWeekStart(new Date(date));
    
    return supabase
      .channel(`${timeframe}-leaderboard-${date}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `${dateField}=eq.${dateValue}`,
        },
        async () => {
          // Fetch updated data when changes occur
          const entries = timeframe === 'daily' 
            ? await this.getDailyLeaderboard(date)
            : await this.getWeeklyLeaderboard(date);
          onUpdate(entries);
        }
      )
      .subscribe((status) => {
        console.log(`${timeframe} leaderboard subscription status:`, status);
      });
  },

  async getDailyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching daily leaderboard for date:', date);
    
    try {
      // First try to get data directly from daily_totals table
      // This is more efficient than recalculating from raw metrics
      const { data: totalsData, error: totalsError } = await supabase
        .from('daily_totals')
        .select(`
          id,
          user_id,
          date,
          total_points,
          metrics_completed,
          user_profiles (
            id,
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('date', date)
        .eq('is_test_data', false)
        .order('total_points', { ascending: false });

      if (totalsError) {
        console.warn('Error fetching from daily_totals, falling back to metrics calculation:', totalsError);
      } else if (totalsData && totalsData.length > 0) {
        console.log(`Found ${totalsData.length} entries in daily_totals`);
        
        // Process and transform the data into LeaderboardEntry format
        const entries: LeaderboardEntry[] = (totalsData as unknown as SupabaseDailyTotalWithProfile[])
          .filter(item => item.user_profiles && item.user_profiles.show_profile !== false)
          .map((item, index) => ({
            user_id: item.user_id,
            display_name: item.user_profiles?.display_name || `User ${item.user_id.slice(0, 8)}`,
            avatar_url: item.user_profiles?.avatar_url || null,
            total_points: item.total_points || 0,
            points: item.total_points || 0, // For backward compatibility
            metrics_completed: item.metrics_completed || 0,
            rank: index + 1,
            show: true
          }));

        // Log the entries for debugging
        console.log(`Processed ${entries.length} leaderboard entries with points:`, 
          entries.slice(0, 3).map(e => ({ name: e.display_name, points: e.total_points })));

        return entries;
      }

      // If we couldn't get data from daily_totals, fall back to metrics calculation
      console.log('No data in daily_totals, calculating from metrics');
      
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value, points, goal_reached')
        .eq('date', date);

      if (metricsError) throw metricsError;

      // Group metrics by user
      const userMetrics = new Map<string, DailyMetricScore[]>();
      metricsData?.forEach(metric => {
        const metrics = userMetrics.get(metric.user_id) || [];
        userMetrics.set(metric.user_id, [...metrics, metric as DailyMetricScore]);
      });

      // Calculate points using the same function as Dashboard
      const userPoints = new Map<string, { total: number, completed: number }>();
      userMetrics.forEach((metrics, userId) => {
        // Count completed metrics
        const completedMetrics = metrics.filter(m => m.goal_reached).length;
        
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics, 'leaderboardService.getDailyLeaderboard'),
          completed: completedMetrics
        });
      });

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, show_profile');

      if (profilesError) throw profilesError;

      // Create leaderboard entries
      const entries = Array.from(userPoints.entries())
        .map(([userId, points]) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            user_id: userId,
            display_name: profile?.display_name || `User ${userId.slice(0, 8)}`,
            avatar_url: profile?.avatar_url || null,
            total_points: points.total,
            points: points.total, // Add points as fallback for components that expect it
            metrics_completed: points.completed,
            rank: 0, // Will be assigned after sorting
            show: profile?.show_profile !== false
          };
        })
        .filter(entry => entry.show);

      // Sort by points and assign ranks
      entries.sort((a, b) => b.total_points - a.total_points);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (error) {
      console.error('Error in getDailyLeaderboard:', error);
      throw error;
    }
  },

  async getUserRank(userId: string, date: string): Promise<number | null> {
    try {
      const leaderboard = await this.getDailyLeaderboard(date);
      const userIndex = leaderboard.findIndex(entry => entry.user_id === userId);
      return userIndex === -1 ? null : userIndex + 1;
    } catch (error) {
      console.error('Error in getUserRank:', error);
      throw error;
    }
  },

  async getUserProfile(userId: string) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching user profile:', error);
      
      // If profile not found, try to create one from auth metadata
      if (error.code === 'PGRST116') { // Record not found
        try {
          // Get user metadata from auth
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const metadata = userData.user.user_metadata;
            const defaultProfile = this.mapMetadataToProfile(metadata);
            
            // Create profile from metadata
            await this.updateUserProfile(userId, defaultProfile);
            
            // Return the newly created profile
            return {
              id: userId,
              ...defaultProfile,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
        } catch (createError) {
          console.error('Error creating profile from metadata:', createError);
        }
      }
      
      throw error;
    }

    return data;
  },

  async updateUserProfile(userId: string, profile: Partial<UserProfile>) {
    // Ensure we have a valid display name
    const displayName = profile.display_name?.trim() || null;
    
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        id: userId,
        display_name: displayName,
        show_profile: profile.show_profile,
        avatar_url: profile.avatar_url,
        device_type: profile.device_type,
        measurement_system: profile.measurement_system,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error updating user profile:', error);
      throw error;
    } else {
      console.log('User profile updated successfully:', data);
      
      // Also update the auth metadata to keep display name in sync
      try {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: { 
            displayName: displayName 
          }
        });
        
        if (metadataError) {
          console.warn('Failed to update auth metadata with display name:', metadataError);
        }
      } catch (metadataUpdateError) {
        console.warn('Error updating auth metadata:', metadataUpdateError);
        // Don't throw - this is a non-critical update
      }
    }

    return data;
  },

  mapMetadataToProfile(metadata: any): Partial<UserProfile> {
    return {
      display_name: metadata.displayName || null,
      avatar_url: metadata.avatarUri || null,
      device_type: metadata.deviceType || null,
      measurement_system: metadata.measurementSystem || 'metric',
      show_profile: metadata.showProfile !== undefined ? metadata.showProfile : true,
    };
  },

  async createUserProfile(userId: string, profile: Partial<UserProfile>): Promise<UserProfile | null> {
    console.log(`[leaderboardService] Creating profile for user ${userId}:`, profile);
    
    // Ensure we have a valid display name
    const displayName = profile.display_name?.trim() || null;
    
    try {
      // Check if profile already exists
      const { data: existing, error: checkError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
        
      if (checkError && checkError.code !== 'PGRST116') { // Not found error is ok
        console.error('[leaderboardService] Error checking for existing profile:', checkError);
        throw checkError;
      }
      
      // If profile already exists, update it
      if (existing) {
        console.log('[leaderboardService] Profile already exists, updating instead');
        return this.updateUserProfile(userId, profile);
      }
      
      // Create minimal required fields for new profile
      const newProfile = {
        id: userId,
        display_name: displayName,
        // Use defaults for other fields to reduce chance of errors
        show_profile: true,
        device_type: 'os',
        measurement_system: 'metric',
        avatar_url: null as string | null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Override defaults with provided values
      if (profile.show_profile !== undefined) newProfile.show_profile = profile.show_profile;
      if (profile.device_type) newProfile.device_type = profile.device_type;
      if (profile.measurement_system) newProfile.measurement_system = profile.measurement_system;
      if (profile.avatar_url) newProfile.avatar_url = profile.avatar_url;
      
      // Create the profile
      const { data, error } = await supabase
        .from('user_profiles')
        .insert(newProfile)
        .select('*')
        .single();
      
      if (error) {
        console.error('[leaderboardService] Error creating user profile:', error);
        throw error;
      }
      
      console.log('[leaderboardService] Profile created successfully:', data);
      return data;
    } catch (error) {
      console.error('[leaderboardService] Error in createUserProfile:', error);
      throw error;
    }
  },

  async uploadAvatar(userId: string, imageUri: string): Promise<string | null> {
    try {
      console.log('[leaderboardService] Starting avatar upload for user:', userId);
      
      // Create filename with consistent format and timestamp for cache busting
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}.jpeg`;
      
      // Process and resize image
      const manipResult = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Check file size and adjust compression if needed
      const fileInfo = await FileSystem.getInfoAsync(manipResult.uri);
      let compressedResult = manipResult;
      if (fileInfo.exists && 'size' in fileInfo && fileInfo.size > 1000000) { // 1MB
        // More aggressive compression for large images
        compressedResult = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 300, height: 300 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG }
        );
      }
      
      // Implement retry logic for uploads
      const maxRetries = 3;
      let attempt = 0;
      let lastError;
      
      while (attempt < maxRetries) {
        try {
          // Get auth token
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          
          if (!token) throw new Error('Not authenticated');
          
          // Upload with proper content type and headers
          const uploadResult = await FileSystem.uploadAsync(
            `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/avatars/public/${fileName}`,
            manipResult.uri,
            {
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: 'file',
              mimeType: 'image/jpeg', // Ensure this is set correctly
              headers: {
                'Authorization': `Bearer ${token}`,
                'x-upsert': 'true',
                'Cache-Control': 'max-age=0, no-cache, no-store, must-revalidate',
                'Content-Type': 'image/jpeg', // Add this explicit content type
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            }
          );
          
          if (uploadResult.status >= 200 && uploadResult.status < 300) {
            // Add a longer delay after successful upload
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get public URL and add cache busting parameter
            const { data } = supabase.storage
              .from('avatars')
              .getPublicUrl(fileName);
              
            const publicUrl = `${data.publicUrl}?v=${timestamp}`;
            
            // Try to clear any existing cached version
            try {
              if (Platform.OS === 'ios') {
                await Image.clearMemoryCache();  // Reset entire cache on iOS
              } else {
                await Image.clearDiskCache(); // Clear disk cache on Android
              }
            } catch (cacheError) {
              console.log('[leaderboardService] Cache clearing error (non-fatal):', cacheError);
            }
            
            console.log('[leaderboardService] Avatar uploaded successfully:', publicUrl);
            return publicUrl;
          }
          
          throw new Error(`Upload failed with status ${uploadResult.status}`);
        } catch (error) {
          attempt++;
          lastError = error;
          
          if (attempt < maxRetries) {
            // Add exponential backoff
            const delay = Math.pow(2, attempt) * 1000;
            console.log(`[leaderboardService] Retrying upload in ${delay}ms (attempt ${attempt}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      // All retries failed
      throw lastError || new Error('Upload failed after maximum retries');
      
    } catch (error) {
      console.error('[leaderboardService] Avatar upload failed:', error);
      throw error;
    }
  },

  async getWeeklyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching weekly leaderboard for date:', date);
    const weekStart = getWeekStart(new Date(date));
    
    try {
      // First try to get data from weekly_totals table
      const { data: weeklyData, error: weeklyError } = await supabase
        .from('weekly_totals')
        .select(`
          id,
          user_id,
          week_start,
          total_points,
          metrics_completed,
          user_profiles (
            id,
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .eq('week_start', weekStart)
        .eq('is_test_data', false)
        .order('total_points', { ascending: false });

      if (weeklyError) {
        console.warn('Error fetching from weekly_totals, falling back to daily totals:', weeklyError);
      } else if (weeklyData && weeklyData.length > 0) {
        console.log(`Found ${weeklyData.length} entries in weekly_totals`);
        
        // Process and transform the data into LeaderboardEntry format
        const entries: LeaderboardEntry[] = (weeklyData as unknown as SupabaseWeeklyTotalWithProfile[])
          .filter(item => item.user_profiles && item.user_profiles.show_profile !== false)
          .map((item, index) => ({
            user_id: item.user_id,
            display_name: item.user_profiles?.display_name || `User ${item.user_id.slice(0, 8)}`,
            avatar_url: item.user_profiles?.avatar_url || null,
            total_points: item.total_points || 0,
            points: item.total_points || 0, // For backward compatibility
            metrics_completed: item.metrics_completed || 0,
            rank: index + 1,
            show: true
          }));

        return entries;
      }

      // If we couldn't get data from weekly_totals, fall back to daily_totals
      console.log('No data in weekly_totals, calculating from daily_totals');
      
      // Get daily totals for the week
      const { data: dailyTotals, error: dailyError } = await supabase
        .from('daily_totals')
        .select(`
          user_id,
          total_points,
          metrics_completed,
          user_profiles (
            id,
            display_name,
            avatar_url,
            show_profile
          )
        `)
        .gte('date', weekStart)
        .lte('date', date)
        .eq('is_test_data', false);

      if (dailyError) throw dailyError;

      // Group and aggregate by user
      const userTotals = new Map<string, { 
        totalPoints: number, 
        metricsCompleted: number,
        profile: UserProfile | null
      }>();
      
      (dailyTotals as unknown as SupabaseDailyTotalWithProfileJoin[])?.forEach(item => {
        const userId = item.user_id;
        const existing = userTotals.get(userId) || { 
          totalPoints: 0, 
          metricsCompleted: 0,
          profile: item.user_profiles
        };
        
        existing.totalPoints += (item.total_points || 0);
        existing.metricsCompleted += (item.metrics_completed || 0);
        
        userTotals.set(userId, existing);
      });

      // Create leaderboard entries
      const entries = Array.from(userTotals.entries())
        .map(([userId, data]) => {
          return {
            user_id: userId,
            display_name: data.profile?.display_name || `User ${userId.slice(0, 8)}`,
            avatar_url: data.profile?.avatar_url || null,
            total_points: data.totalPoints,
            points: data.totalPoints, // For backward compatibility
            metrics_completed: data.metricsCompleted,
            rank: 0, // Will be assigned after sorting
            show: data.profile?.show_profile !== false
          };
        })
        .filter(entry => entry.show);

      // Sort by points and assign ranks
      entries.sort((a, b) => b.total_points - a.total_points);
      entries.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      return entries;
    } catch (error) {
      console.error('Error in getWeeklyLeaderboard:', error);
      throw error;
    }
  },

  async getUserWeeklyRank(userId: string, date: string): Promise<number | null> {
    try {
      const leaderboard = await this.getWeeklyLeaderboard(date);
      const userIndex = leaderboard.findIndex(entry => entry.user_id === userId);
      return userIndex === -1 ? null : userIndex + 1;
    } catch (error) {
      console.error('Error in getUserWeeklyRank:', error);
      throw error;
    }
  },
};
