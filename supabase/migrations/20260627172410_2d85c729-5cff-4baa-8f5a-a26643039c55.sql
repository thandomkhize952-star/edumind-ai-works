
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'lecturer', 'student');
CREATE TYPE public.assessment_type AS ENUM ('quiz', 'test', 'exam', 'assignment');
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late', 'excused');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  student_number TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Qualifications (admin-managed)
CREATE TABLE public.qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qualifications TO authenticated;
GRANT ALL ON public.qualifications TO service_role;
ALTER TABLE public.qualifications ENABLE ROW LEVEL SECURITY;

-- Modules
CREATE TABLE public.modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  lecturer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(qualification_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modules TO authenticated;
GRANT ALL ON public.modules TO service_role;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

-- Enrollments (student <-> qualification)
CREATE TABLE public.enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qualification_id UUID NOT NULL REFERENCES public.qualifications(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, qualification_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enrollments TO authenticated;
GRANT ALL ON public.enrollments TO service_role;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Helper: is student enrolled in module's qualification
CREATE OR REPLACE FUNCTION public.is_enrolled_in_module(_user_id UUID, _module_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.modules m
    JOIN public.enrollments e ON e.qualification_id = m.qualification_id
    WHERE m.id = _module_id AND e.student_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_module_lecturer(_user_id UUID, _module_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.modules WHERE id = _module_id AND lecturer_id = _user_id)
$$;

-- Assessments
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type assessment_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  total_marks NUMERIC NOT NULL DEFAULT 0,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessments TO authenticated;
GRANT ALL ON public.assessments TO service_role;
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Questions (MCQ: options jsonb array, correct_index int)
CREATE TABLE public.assessment_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  position INT NOT NULL DEFAULT 0,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_index INT NOT NULL DEFAULT 0,
  marks NUMERIC NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_questions TO authenticated;
GRANT ALL ON public.assessment_questions TO service_role;
ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

-- Submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  score NUMERIC,
  feedback TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(assessment_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- Materials
CREATE TABLE public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

-- Attendance
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status attendance_status NOT NULL DEFAULT 'present',
  marked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module_id, student_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- AI chats
CREATE TABLE public.ai_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chats TO authenticated;
GRANT ALL ON public.ai_chats TO service_role;
ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.ai_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

-- =============== POLICIES ===============

-- Profiles: anyone signed in can view (needed for lecturer/admin lookups), only owner or admin updates
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins update any profile" ON public.profiles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles: users can see their own; admins see all and manage
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Qualifications: all authenticated read; admins manage
CREATE POLICY "Qualifications viewable" ON public.qualifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage qualifications" ON public.qualifications FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Modules: all authenticated read; admins manage
CREATE POLICY "Modules viewable" ON public.modules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage modules" ON public.modules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Enrollments: student sees own; admin/lecturer see all
CREATE POLICY "Students view own enrollments" ON public.enrollments FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'lecturer'));
CREATE POLICY "Admins manage enrollments" ON public.enrollments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Students enroll themselves" ON public.enrollments FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());

-- Assessments: students see published in their modules; lecturers see own; admins all
CREATE POLICY "View assessments" ON public.assessments FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR public.is_module_lecturer(auth.uid(), module_id)
  OR (published AND public.is_enrolled_in_module(auth.uid(), module_id))
);
CREATE POLICY "Lecturers create assessments" ON public.assessments FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id))
);
CREATE POLICY "Lecturers update own assessments" ON public.assessments FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
);
CREATE POLICY "Lecturers delete own assessments" ON public.assessments FOR DELETE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
);

-- Questions: same scope as parent assessment; students should NOT see correct_index — exposed via server fn only.
-- To prevent leakage from direct REST reads, restrict SELECT to admin/lecturer; students fetch sanitized questions through a server function.
CREATE POLICY "Lecturer/admin view questions" ON public.assessment_questions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.is_module_lecturer(auth.uid(), a.module_id))
);
CREATE POLICY "Lecturer/admin manage questions" ON public.assessment_questions FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.is_module_lecturer(auth.uid(), a.module_id))
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.is_module_lecturer(auth.uid(), a.module_id))
);

-- Submissions
CREATE POLICY "Students view own submissions" ON public.submissions FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Lecturer/admin view submissions" ON public.submissions FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.is_module_lecturer(auth.uid(), a.module_id))
);
CREATE POLICY "Students insert own submissions" ON public.submissions FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Students update own ungraded submissions" ON public.submissions FOR UPDATE TO authenticated USING (student_id = auth.uid() AND graded_at IS NULL);
CREATE POLICY "Lecturer/admin grade submissions" ON public.submissions FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM public.assessments a WHERE a.id = assessment_id AND public.is_module_lecturer(auth.uid(), a.module_id))
);

-- Materials
CREATE POLICY "View materials in module" ON public.materials FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin')
  OR public.is_module_lecturer(auth.uid(), module_id)
  OR public.is_enrolled_in_module(auth.uid(), module_id)
);
CREATE POLICY "Lecturer/admin manage materials" ON public.materials FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
);

-- Attendance
CREATE POLICY "Students view own attendance" ON public.attendance FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Lecturer/admin view attendance" ON public.attendance FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
);
CREATE POLICY "Lecturer/admin manage attendance" ON public.attendance FOR ALL TO authenticated USING (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
) WITH CHECK (
  public.has_role(auth.uid(),'admin') OR public.is_module_lecturer(auth.uid(), module_id)
);

-- AI chats/messages: owner only
CREATE POLICY "Own ai chats" ON public.ai_chats FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own ai messages" ON public.ai_messages FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.ai_chats c WHERE c.id = chat_id AND c.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.ai_chats c WHERE c.id = chat_id AND c.user_id = auth.uid())
);

-- Storage policies
-- avatars: public bucket, owner uploads
CREATE POLICY "Avatar images public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- materials: authenticated read, lecturer/admin write
CREATE POLICY "Materials read authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'materials');
CREATE POLICY "Lecturers upload materials" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'materials' AND (public.has_role(auth.uid(),'lecturer') OR public.has_role(auth.uid(),'admin'))
);
CREATE POLICY "Lecturers delete materials" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'materials' AND (public.has_role(auth.uid(),'lecturer') OR public.has_role(auth.uid(),'admin'))
);

-- Trigger: create profile + student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at on profiles
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
