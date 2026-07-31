
-- Drop the two problematic profile visibility policies
DROP POLICY IF EXISTS "Lecturer profiles viewable" ON public.profiles;
DROP POLICY IF EXISTS "Lecturers view all profiles" ON public.profiles;

-- Lecturers can only view profiles of students enrolled in modules they teach
CREATE POLICY "Lecturers view enrolled students"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'lecturer')
  AND EXISTS (
    SELECT 1
    FROM public.modules m
    JOIN public.enrollments e ON e.qualification_id = m.qualification_id
    WHERE m.lecturer_id = auth.uid()
      AND e.student_id = profiles.id
  )
);

-- Explicitly block any INSERT/UPDATE into user_roles unless the caller is an admin.
-- (Trigger-based inserts run as SECURITY DEFINER and bypass RLS, so signup still works.)
DROP POLICY IF EXISTS "Only admins insert roles" ON public.user_roles;
CREATE POLICY "Only admins insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Only admins update roles" ON public.user_roles;
CREATE POLICY "Only admins update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
