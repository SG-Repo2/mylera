import { supabase } from './supabaseClient';
import { 
  LeaderboardEntry, 
  UserProfile,
  LeaderboardTimeframe
} from '@/src/types/leaderboard';
import type { DailyMetricScore } from '@/src/types/schemas';
import { calculateTotalPoints } from '@/src/utils/pointsCalculator';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Helper function to get week start date
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Set to Sunday
  return d.toISOString().split('T')[0];
}

// Helper function to convert base64 to blob
function base64ToBlob(base64: string, contentType: string): Blob {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  
  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }
  
  return new Blob(byteArrays, { type: contentType });
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
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value, points')
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
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics, 'leaderboardService.getDailyLeaderboard'),
          completed: metrics.length
        });
      });

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, show_profile');

      if (profilesError) throw profilesError;

      // Create leaderboard entries
      const entries = Array.from(userPoints.entries())
        .map(([userId, points], index) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            user_id: userId,
            display_name: profile?.display_name || `User ${userId.slice(0, 8)}`,
            avatar_url: profile?.avatar_url || null,
            total_points: points.total,
            metrics_completed: points.completed,
            rank: index + 1,
            show: profile?.show_profile !== false
          };
        })
        .sort((a, b) => b.total_points - a.total_points)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
        .filter(entry => entry.show);

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
      
      // Extract file extension 
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      // Ensure proper MIME type (treat jpg as jpeg)
      const mimeType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
      const fileName = `${userId}-${Date.now()}.jpg`; // Always use jpg extension
      
      // Step 1: Verify the source file
      if (imageUri.startsWith('file://')) {
        console.log('[leaderboardService] Processing local file URI:', imageUri);
        try {
          // First check if file exists and log its info
          const fileInfo = await FileSystem.getInfoAsync(imageUri);
          if (!fileInfo.exists) {
            console.error('[leaderboardService] File does not exist:', imageUri);
            return null;
          }
          console.log('[leaderboardService] File info:', fileInfo);
          
          // For iOS, we'll try to use a more direct approach
          // Copy the file to a temporary location with a simpler name
          const tempFile = `${FileSystem.cacheDirectory}temp-avatar.jpg`;
          await FileSystem.copyAsync({
            from: imageUri,
            to: tempFile
          });
          
          console.log('[leaderboardService] Copied to temporary file:', tempFile);
          
          // Read the file as Base64 using Expo FileSystem
          const base64Data = await FileSystem.readAsStringAsync(tempFile, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          console.log('[leaderboardService] Successfully read file as base64, length:', base64Data.length);
          
          // Step 4: Upload the base64 data directly to Supabase
          console.log('[leaderboardService] Starting upload to Supabase storage');
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, base64Data, {
              contentType: 'image/jpeg', // Always use JPEG for consistency
              upsert: true,
              cacheControl: 'no-cache, max-age=0'
            });
          
          if (uploadError) {
            console.error('[leaderboardService] Upload error:', uploadError);
            return null;
          }
          
          console.log('[leaderboardService] Upload successful:', uploadData);
          
          // Use simple public URL instead of signed URL with transformations
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          console.log('[leaderboardService] Got public URL:', publicUrl);
          
          // Step 6: Update the user profile
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              avatar_url: publicUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
            
          if (updateError) {
            console.error('[leaderboardService] Profile update error:', updateError);
            return null;
          }
          
          // Step 7: Also update auth metadata
          try {
            const { error: authUpdateError } = await supabase.auth.updateUser({
              data: { 
                avatarUrl: publicUrl 
              }
            });
            
            if (authUpdateError) {
              console.warn('[leaderboardService] Auth metadata update failed:', authUpdateError);
            }
          } catch (authError) {
            console.warn('[leaderboardService] Auth update error:', authError);
          }
          
          // Try to prefetch the image to warm up the cache
          try {
            const { uri } = await FileSystem.downloadAsync(
              publicUrl,
              FileSystem.cacheDirectory + 'avatar-' + userId + '.jpg'
            );
            console.log('[leaderboardService] Prefetched avatar to:', uri);
          } catch (prefetchError) {
            console.warn('[leaderboardService] Failed to prefetch avatar:', prefetchError);
          }
          
          return publicUrl;
        } catch (fileError) {
          console.error('[leaderboardService] Error processing file:', fileError);
          return null;
        }
      } else {
        // For network URIs, we need to fetch and convert
        console.log('[leaderboardService] Processing network URI:', imageUri);
        try {
          // For network URIs, need to download first
          const fileUri = FileSystem.cacheDirectory + fileName;
          const downloadResult = await FileSystem.downloadAsync(imageUri, fileUri);
          
          console.log('[leaderboardService] Downloaded file to:', downloadResult.uri);
          
          // Now that we have a local file, read it as base64
          const base64Data = await FileSystem.readAsStringAsync(downloadResult.uri, {
            encoding: FileSystem.EncodingType.Base64
          });
          
          console.log('[leaderboardService] Successfully read network file as base64, length:', base64Data.length);
          
          // Upload to Supabase
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, base64Data, {
              contentType: mimeType,
              upsert: true,
              cacheControl: 'no-cache, max-age=0'
            });
          
          if (uploadError) {
            console.error('[leaderboardService] Upload error:', uploadError);
            return null;
          }
          
          console.log('[leaderboardService] Upload successful:', uploadData);
          
          // Use simple public URL instead of signed URL with transformations
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);
            
          console.log('[leaderboardService] Got public URL:', publicUrl);
          
          // Update profile
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ 
              avatar_url: publicUrl,
              updated_at: new Date().toISOString()
            })
            .eq('id', userId);
            
          if (updateError) {
            console.error('[leaderboardService] Profile update error:', updateError);
            return null;
          }
          
          // Update auth metadata
          try {
            const { error: authUpdateError } = await supabase.auth.updateUser({
              data: { 
                avatarUrl: publicUrl 
              }
            });
            
            if (authUpdateError) {
              console.warn('[leaderboardService] Auth metadata update failed:', authUpdateError);
            }
          } catch (authError) {
            console.warn('[leaderboardService] Auth update error:', authError);
          }
          
          // Try to prefetch the image
          try {
            const { uri } = await FileSystem.downloadAsync(
              publicUrl,
              FileSystem.cacheDirectory + 'avatar-' + userId + '.jpg'
            );
            console.log('[leaderboardService] Prefetched avatar to:', uri);
          } catch (prefetchError) {
            console.warn('[leaderboardService] Failed to prefetch avatar:', prefetchError);
          }
          
          return publicUrl;
        } catch (fetchError) {
          console.error('[leaderboardService] Error fetching image:', fetchError);
          return null;
        }
      }
    } catch (error) {
      console.error('[leaderboardService] Avatar upload error:', error);
      return null;
    }
  },

  async getWeeklyLeaderboard(date: string): Promise<LeaderboardEntry[]> {
    console.log('Fetching weekly leaderboard for date:', date);
    const weekStart = getWeekStart(new Date(date));
    
    try {
      const { data: metricsData, error: metricsError } = await supabase
        .from('daily_metric_scores')
        .select('user_id, metric_type, value, points, date')
        .gte('date', weekStart)
        .lte('date', date);

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
        userPoints.set(userId, {
          total: calculateTotalPoints(metrics, 'leaderboardService.getWeeklyLeaderboard'),
          completed: metrics.length
        });
      });

      // Get user profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id, display_name, avatar_url, show_profile');

      if (profilesError) throw profilesError;

      // Create leaderboard entries
      const entries = Array.from(userPoints.entries())
        .map(([userId, points], index) => {
          const profile = profiles?.find(p => p.id === userId);
          return {
            user_id: userId,
            display_name: profile?.display_name || `User ${userId.slice(0, 8)}`,
            avatar_url: profile?.avatar_url || null,
            total_points: points.total,
            metrics_completed: points.completed,
            rank: index + 1,
            show: profile?.show_profile !== false
          };
        })
        .sort((a, b) => b.total_points - a.total_points)
        .map((entry, index) => ({ ...entry, rank: index + 1 }))
        .filter(entry => entry.show);

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
