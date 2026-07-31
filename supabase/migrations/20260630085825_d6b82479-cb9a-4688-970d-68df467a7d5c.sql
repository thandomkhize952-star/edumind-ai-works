
-- Allow lecturers to create modules they own and manage them
CREATE POLICY "Lecturers can insert own modules" ON public.modules
  FOR INSERT TO authenticated
  WITH CHECK (lecturer_id = auth.uid() AND has_role(auth.uid(), 'lecturer'));

CREATE POLICY "Lecturers can update own modules" ON public.modules
  FOR UPDATE TO authenticated
  USING (lecturer_id = auth.uid())
  WITH CHECK (lecturer_id = auth.uid());

CREATE POLICY "Lecturers can delete own modules" ON public.modules
  FOR DELETE TO authenticated
  USING (lecturer_id = auth.uid());
