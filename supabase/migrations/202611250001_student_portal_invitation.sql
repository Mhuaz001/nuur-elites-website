ALTER TABLE public.student_applications ADD COLUMN IF NOT EXISTS student_email text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_email text;
CREATE INDEX IF NOT EXISTS students_student_email_idx ON public.students (lower(student_email)) WHERE student_email IS NOT NULL;

CREATE OR REPLACE FUNCTION public.approve_student_application(application_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
DECLARE app public.student_applications%ROWTYPE; new_student_id uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT * INTO app FROM public.student_applications WHERE id = $1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Application not found'; END IF;
  IF app.status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION 'Only pending applications can be approved'; END IF;
  IF EXISTS (SELECT 1 FROM public.students s WHERE s.application_id = app.id) THEN RAISE EXCEPTION 'This application already has a student record'; END IF;
  INSERT INTO public.students (student_name,date_of_birth,student_email,location,guardian_name,guardian_email,guardian_phone,relationship,course_interest,delivery_mode,preferred_schedule,additional_notes,application_id,status)
  VALUES (app.student_name,app.date_of_birth,app.student_email,app.location,app.guardian_name,app.guardian_email,app.guardian_phone,app.relationship,app.course_interest,app.delivery_mode,app.preferred_schedule,app.additional_notes,app.id,'active')
  RETURNING id INTO new_student_id;
  UPDATE public.student_applications SET status='approved' WHERE id=app.id;
  RETURN json_build_object('success',true,'student_id',new_student_id,'message','Application approved. Create or link the learner portal account next.');
END;
$function$;
REVOKE ALL ON FUNCTION public.approve_student_application(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_student_application(uuid) TO authenticated;
