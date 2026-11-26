-- NUUR ELITES: additive LMS alignment based on verified live schema.
-- Applied to Supabase production as migration 20261125180031_nuur_elites_lms_alignment.
BEGIN;

ALTER TABLE public.student_applications
  ADD COLUMN IF NOT EXISTS privacy_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_consent_at timestamptz DEFAULT now();

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS gateway text,
  ADD COLUMN IF NOT EXISTS gateway_reference text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS payments_gateway_reference_idx
  ON public.payments(gateway_reference)
  WHERE gateway_reference IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.course_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  resource_type text NOT NULL DEFAULT 'link'
    CHECK (resource_type IN ('link','document','video')),
  resource_url text NOT NULL CHECK (resource_url ~ '^https://'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS course_materials_course_id_idx
  ON public.course_materials(course_id);

CREATE TABLE IF NOT EXISTS public.assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES public.teachers(id) ON DELETE SET NULL,
  title text NOT NULL,
  instructions text NOT NULL,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assignments_course_id_idx
  ON public.assignments(course_id);

CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  submission_text text,
  submission_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  grade numeric(6,2),
  teacher_feedback text,
  graded_at timestamptz,
  UNIQUE (assignment_id, student_id),
  CHECK (submission_text IS NOT NULL OR submission_url IS NOT NULL)
);

DROP POLICY IF EXISTS "Public submit applications" ON public.student_applications;
CREATE POLICY "Public submit applications"
  ON public.student_applications FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND privacy_consent IS TRUE);

ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Nuur materials read access" ON public.course_materials;
CREATE POLICY "Nuur materials read access"
  ON public.course_materials FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = public.current_teacher_id()
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_materials.course_id
        AND e.status = 'active'
        AND public.can_access_student(e.student_id)
    )
  );

DROP POLICY IF EXISTS "Nuur teachers manage materials" ON public.course_materials;
CREATE POLICY "Nuur teachers manage materials"
  ON public.course_materials FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (teacher_id = public.current_teacher_id() AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_materials.course_id
        AND e.teacher_id = public.current_teacher_id()
    ))
  )
  WITH CHECK (
    public.is_admin()
    OR (teacher_id = public.current_teacher_id() AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = course_materials.course_id
        AND e.teacher_id = public.current_teacher_id()
    ))
  );

DROP POLICY IF EXISTS "Nuur assignments read access" ON public.assignments;
CREATE POLICY "Nuur assignments read access"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR teacher_id = public.current_teacher_id()
    OR EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = assignments.course_id
        AND e.status = 'active'
        AND public.can_access_student(e.student_id)
    )
  );

DROP POLICY IF EXISTS "Nuur teachers manage assignments" ON public.assignments;
CREATE POLICY "Nuur teachers manage assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (
    public.is_admin()
    OR (teacher_id = public.current_teacher_id() AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = assignments.course_id
        AND e.teacher_id = public.current_teacher_id()
    ))
  )
  WITH CHECK (
    public.is_admin()
    OR (teacher_id = public.current_teacher_id() AND EXISTS (
      SELECT 1 FROM public.enrollments e
      WHERE e.course_id = assignments.course_id
        AND e.teacher_id = public.current_teacher_id()
    ))
  );

DROP POLICY IF EXISTS "Nuur submissions read access" ON public.assignment_submissions;
CREATE POLICY "Nuur submissions read access"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.can_access_student(student_id)
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND a.teacher_id = public.current_teacher_id()
    )
  );

DROP POLICY IF EXISTS "Nuur students submit own work" ON public.assignment_submissions;
CREATE POLICY "Nuur students submit own work"
  ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = assignment_submissions.student_id
        AND s.profile_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.enrollments e ON e.course_id = a.course_id
      WHERE a.id = assignment_submissions.assignment_id
        AND e.student_id = assignment_submissions.student_id
        AND e.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Nuur teachers grade submissions" ON public.assignment_submissions;
CREATE POLICY "Nuur teachers grade submissions"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_submissions.assignment_id
        AND a.teacher_id = public.current_teacher_id()
    )
  )
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = public.assignment_submissions.assignment_id
        AND a.teacher_id = public.current_teacher_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.course_materials, public.assignments, public.assignment_submissions
  TO authenticated;
REVOKE ALL
  ON public.course_materials, public.assignments, public.assignment_submissions
  FROM anon;

CREATE OR REPLACE FUNCTION public.approve_student_application(application_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  app public.student_applications%ROWTYPE;
  new_student_id uuid;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required';
  END IF;

  SELECT * INTO app
  FROM public.student_applications
  WHERE id = $1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF app.status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'Only pending applications can be approved';
  END IF;
  IF EXISTS (SELECT 1 FROM public.students s WHERE s.application_id = app.id) THEN
    RAISE EXCEPTION 'This application already has a student record';
  END IF;

  INSERT INTO public.students (
    student_name, date_of_birth, location, guardian_name, guardian_email,
    guardian_phone, relationship, course_interest, delivery_mode,
    preferred_schedule, additional_notes, application_id, status
  ) VALUES (
    app.student_name, app.date_of_birth, app.location, app.guardian_name,
    app.guardian_email, app.guardian_phone, app.relationship,
    app.course_interest, app.delivery_mode, app.preferred_schedule,
    app.additional_notes, app.id, 'active'
  ) RETURNING id INTO new_student_id;

  UPDATE public.student_applications
  SET status = 'approved'
  WHERE id = app.id;

  RETURN json_build_object(
    'success', true,
    'student_id', new_student_id,
    'message', 'Application approved. Assign the learner to a course next.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.approve_student_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_student_application(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

COMMIT;
