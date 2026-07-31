
-- 1) Switch SECURITY DEFINER helpers to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_module_lecturer(_user_id uuid, _module_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.modules WHERE id = _module_id AND lecturer_id = _user_id) $$;

CREATE OR REPLACE FUNCTION public.is_enrolled_in_module(_user_id uuid, _module_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.enrollments e ON e.qualification_id = m.qualification_id
    WHERE m.id = _module_id AND e.student_id = _user_id
  )
$$;

-- 2) modules: require lecturer/admin role for update/delete
DROP POLICY IF EXISTS "Lecturers can update own modules" ON public.modules;
DROP POLICY IF EXISTS "Lecturers can delete own modules" ON public.modules;

CREATE POLICY "Lecturers can update own modules" ON public.modules
FOR UPDATE TO authenticated
USING (lecturer_id = auth.uid() AND (public.has_role(auth.uid(),'lecturer') OR public.has_role(auth.uid(),'admin')))
WITH CHECK (lecturer_id = auth.uid() AND (public.has_role(auth.uid(),'lecturer') OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Lecturers can delete own modules" ON public.modules
FOR DELETE TO authenticated
USING (lecturer_id = auth.uid() AND (public.has_role(auth.uid(),'lecturer') OR public.has_role(auth.uid(),'admin')));

-- 3) profiles: restrict SELECT
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;

CREATE POLICY "Users view own profile" ON public.profiles
FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY "Admins view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE POLICY "Lecturers view all profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'lecturer'));

CREATE POLICY "Lecturer profiles viewable" ON public.profiles
FOR SELECT TO authenticated USING (public.has_role(id,'lecturer'));

-- 4) assessment_questions: allow students to read questions for enrolled+published assessments, but hide correct_index via column-level revoke
CREATE POLICY "Students view questions for enrolled published assessments" ON public.assessment_questions
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.assessments a
    WHERE a.id = assessment_questions.assessment_id
      AND a.published = true
      AND public.is_enrolled_in_module(auth.uid(), a.module_id)
  )
);

REVOKE SELECT (correct_index) ON public.assessment_questions FROM authenticated, anon;
GRANT SELECT (id, assessment_id, position, question, options, marks) ON public.assessment_questions TO authenticated;

-- 5) avatars bucket DELETE policy
CREATE POLICY "Avatar owners can delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
