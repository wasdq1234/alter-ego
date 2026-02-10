-- Create persona-images storage bucket (public for CDN access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('persona-images', 'persona-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-images');

-- Allow public read access (public bucket)
CREATE POLICY "Public read access for persona images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'persona-images');

-- Allow authenticated users to delete their own images
CREATE POLICY "Authenticated users can delete images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'persona-images');
