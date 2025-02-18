import { supabase } from './supabaseClient';
import * as FileSystem from 'expo-file-system';

export const avatarService = {
  async uploadAvatar(userId: string, uri: string): Promise<string> {
    console.log('[avatarService] Starting avatar upload for user:', userId);
    try {
      // Get file info
      console.log('[avatarService] Getting file info for URI:', uri);
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('File does not exist');
      }

      // Check file size (limit to 5MB)
      if (fileInfo.size && fileInfo.size > 5 * 1024 * 1024) {
        throw new Error('File size exceeds 5MB limit');
      }
      console.log('[avatarService] File size check passed:', fileInfo.size);

      // Determine file extension from URI
      const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      console.log('[avatarService] Generated file path:', filePath);

      // Create a blob from the file URI directly
      console.log('[avatarService] Creating blob from file');
      let blob: Blob | null = null;
      
      try {
        const response = await fetch(uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
        }
        blob = await response.blob();
        console.log('[avatarService] Blob created successfully');

        // Upload to Supabase Storage with proper content type
        console.log('[avatarService] Starting Supabase upload');
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, {
            contentType: `image/${fileExt}`,
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          throw new Error(`Failed to upload avatar: ${uploadError.message}`);
        }

        if (!uploadData) {
          throw new Error('Upload succeeded but no data returned');
        }
        console.log('[avatarService] Upload successful');

        // Get the public URL
        console.log('[avatarService] Getting public URL');
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);

        if (!urlData?.publicUrl) {
          throw new Error('Failed to get public URL for uploaded avatar');
        }
        console.log('[avatarService] Successfully got public URL:', urlData.publicUrl);

        return urlData.publicUrl;
      } catch (error) {
        console.error('[avatarService] Error:', error);
        let errorMessage = 'Avatar upload failed';
        
        if (error instanceof Error) {
          if (error.message.includes('File does not exist')) {
            errorMessage = 'Selected image file no longer exists';
          } else if (error.message.includes('File size exceeds')) {
            errorMessage = 'Image file is too large (max 5MB)';
          } else if (error.message.includes('Failed to fetch file')) {
            errorMessage = 'Unable to access selected image file';
          } else if (error.message.includes('Failed to upload avatar')) {
            errorMessage = 'Failed to upload image to server';
          } else {
            errorMessage = `Avatar upload failed: ${error.message}`;
          }
        }
        
        throw new Error(errorMessage);
      } finally {
        if (blob) {
          console.log('[avatarService] Cleaning up resources');
        }
      }
    } catch (error) {
      throw error;
    }
  }
};