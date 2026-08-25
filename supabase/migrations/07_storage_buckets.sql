-- ==============================================================================
-- 07: STORAGE BUCKETS & AVATAR POLICIES
-- ==============================================================================

-- 1. Create public 'avatars' storage bucket if it does not exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies
DROP POLICY IF EXISTS "Avatar Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

-- Public read access for profile pictures
CREATE POLICY "Avatar Public Access" ON storage.objects 
FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated user isolated uploads (foldername matches user_id)
CREATE POLICY "Users can upload their own avatar" ON storage.objects 
FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- Authenticated user isolated updates
CREATE POLICY "Users can update their own avatar" ON storage.objects 
FOR UPDATE USING (
  bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]
);
