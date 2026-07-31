
-- Tighten storage RLS on the 'materials' bucket so access matches the
-- public.materials table policies. File paths follow `${module_id}/...`.

DROP POLICY IF EXISTS "Materials read authenticated" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers upload materials" ON storage.objects;
DROP POLICY IF EXISTS "Lecturers delete materials" ON storage.objects;

-- Read: admin, the module's lecturer, or an enrolled student
CREATE POLICY "Materials read by module members"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_module_lecturer(auth.uid(), ((storage.foldername(name))[1])::uuid)
    OR public.is_enrolled_in_module(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- Upload: admin or the module's assigned lecturer
CREATE POLICY "Materials upload by module lecturer"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_module_lecturer(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- Update: same as upload (covers metadata changes)
CREATE POLICY "Materials update by module lecturer"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_module_lecturer(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_module_lecturer(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);

-- Delete: admin or the module's assigned lecturer
CREATE POLICY "Materials delete by module lecturer"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'materials'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.is_module_lecturer(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
);
