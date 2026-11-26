# Nuur Elites Learning and Consultancy — Deployment Candidate

This is the corrected static website and portal package for the existing Nuur Elites Supabase project.

**Important:** this review branch contains the current website and portal source. The additive LMS alignment migration is already recorded as applied in the connected Supabase project on 25 November 2026. Do not rerun it against that project. Portal accounts still need to be linked and end-to-end role tests completed before public launch.

## 1. Package contents

- `index.html` — public homepage and service information.
- `registration.html`, `registration.js` — public student application form with privacy acknowledgement and age-appropriate login email collection.
- `privacy.html` — website privacy notice for applicants and portal users.
- `404.html` — simple not-found page for static hosting.
- `admin.html`, `admin.js` — administrator sign-in and password reset request.
- `admin-dashboard.html`, `admin-dashboard.js` — admin management dashboard, including applications, students, courses, teachers, lesson schedules, enrolments and payments.
- `portal.html`, `portal.js` — shared role-based student, parent and teacher portal.
- `reset-password.html` — secure password setup/recovery page for invited students, parents and administrators.
- `payment-callback.html` and the Paystack Edge Function sources — retained legacy files; they are not used by the current manual bank-transfer portal flow.
- `supabase/migrations/20261125180031_nuur_elites_lms_alignment.sql` — additive LMS alignment migration, already applied to the connected Supabase project on 25 November 2026.
- `supabase/functions/provision-student-login/index.ts` — protected admin-only function that invites or links the correct student/parent portal account.
- `supabase/functions/` — legacy Paystack functions are retained but not used by the current manual bank-transfer approach.
- `images/` — existing Nuur Elites artwork and the supplied official logo.

This is a plain HTML/CSS/JavaScript site. It does not require `npm install` or a build command. Serve the folder from a local web server while testing; do not open the pages as `file://` URLs.

## 2. Database compatibility and safety

The existing database uses these tables and relationships:

- `profiles`, `students`, `parents`, `student_guardians`, `teachers`
- `student_applications`, `courses`, `enrollments`, `lesson_schedules`
- `attendance`, `assessments`, `payments`

The portal now uses `teachers.profile_id`, the parent-to-child relationship in `parents` and `student_guardians`, and the existing `enrollments` and `lesson_schedules` tables. It does **not** use `teachers.auth_user_id`, `lessons`, or a duplicate `student_enrollments` table.

### Migration status

The additive migration `supabase/migrations/20261125180031_nuur_elites_lms_alignment.sql` is already recorded as applied in the connected Supabase project on 25 November 2026. The live project has the `course_materials`, `assignments` and `assignment_submissions` tables and the related privacy/payment columns. Do not run this migration again on that project. Keep the SQL file in GitHub as the audit/source record. If setting up a different Supabase project, review the migration and its dependencies first, take a backup, and apply it only once to that separate project.

The migration adds these LMS resource tables, payment metadata and application privacy-consent fields only. It does not drop existing tables, replace the established LMS access policies, create a second enrolment model, or delete existing records. It does tighten the existing public application-insert policy so new applications must include privacy consent.

## 3. Open and test locally

1. Keep a backup of your current website folder.
2. Extract this package into a new folder.
3. Open that folder in VS Code.
4. Use the VS Code Live Server extension.
5. Right-click `index.html` → **Open with Live Server**.
6. Test homepage navigation, images, WhatsApp/email links and mobile layout.
7. Open `registration.html` and submit a clearly labelled test application.
8. Open `admin.html`, sign in with the existing admin account, and test the dashboard.
9. Open `portal.html` and test each role with dedicated test accounts.

The public homepage's tutor-request and contact forms open a prepared WhatsApp or email message. They do not store those enquiries in Supabase. The separate Student Registration form does store applications in `student_applications`.

## 4. Administrator workflow

1. Review new applications in **Applications**.
2. Approve a pending application to create its student record, or reject it.
3. Create or confirm the course in **Courses**. Set its name, category, fee and active status.
4. Create or confirm the teacher record in **Teachers**. Link the teacher's Auth profile UUID in `Linked Auth Profile UUID` (or use the SQL instructions below).
5. In **Student Enrolments**, choose the learner and course, confirm the agreed tuition fee in NGN, and assign the course.
6. Copy the Enrolment UUID displayed in the enrolment table.
7. In **Lesson Schedules**, add a schedule using that enrolment UUID, weekday, start time, duration, timezone and optional HTTPS meeting link.
8. Teachers can then sign in to publish learning materials and assignments, mark attendance and record assessments.

The enrolment fee is the amount used by the current manual bank-transfer flow. Confirm the agreed fee and currency in the enrolment record before requesting payment.

## 5. Automated student and parent portal invitations

Portal accounts are provisioned from the Admin Dashboard after a student application is approved. Do not create public self-registration for portal roles.

- Under 18, or date of birth not supplied: the parent/guardian email receives the invitation. The function creates a `parent` profile, a `parents` record and an explicit `student_guardians` link.
- Age 18 or above: the student's own email receives the invitation. The function creates a `student` profile and links it through `students.profile_id`.
- The recipient opens the secure Supabase invitation email, sets a password on `reset-password.html`, then signs in at `portal.html`.
- If an email already has a matching portal account, the function links that account rather than creating a duplicate. The user should sign in with their existing password.
- If the required email is missing, the admin dashboard asks the administrator to add it and retries. A failed invitation can be retried from the Students list.

The `provision-student-login` Edge Function requires a valid JWT and independently checks that the caller's database profile has `role = 'admin'`. The Supabase service-role key is used only inside the Edge Function; never place it in browser code.

### Required Auth email delivery setup

Before sending invitations to real families, configure custom SMTP in Supabase. Supabase's built-in email service is limited to project-team addresses and has a very low sending limit; it is not suitable for live student onboarding. Configure a provider such as Brevo, Resend, Postmark or Amazon SES under Supabase Dashboard → Authentication → Emails → SMTP Settings.

Also add these allowed Redirect URLs under Authentication → URL Configuration:
- `https://nuurelites.netlify.app/reset-password.html`
- Your Netlify deploy-preview URL pattern (only if you intend to test invitation links from deploy previews).

Keep email confirmations enabled. Do not create shared/default passwords or send passwords in plain text.

### Teacher

1. Create/invite the teacher's Auth user and copy the UUID.
2. Create/update the profile:

```sql
insert into public.profiles (id, full_name, role)
values ('TEACHER-AUTH-UUID', 'Teacher Full Name', 'teacher')
on conflict (id) do update
set full_name = excluded.full_name, role = excluded.role;
```

3. Link the existing teacher record:

```sql
update public.teachers
set profile_id = 'TEACHER-AUTH-UUID', email = 'teacher@example.com'
where id = 'TEACHER-RECORD-UUID';
```

4. Assign the teacher to the learner's course by setting `enrollments.teacher_id` through the admin workflow or a reviewed SQL update. The teacher portal only shows enrolments assigned to that teacher.

Never put passwords, service-role keys, Paystack secrets or WhatsApp access tokens in SQL, browser JavaScript, GitHub or this README.

## 6. Current payment method — manual bank transfer

The selected payment method is bank transfer with manual administrator verification. Paystack is not the active payment route. The older Paystack callback page and Edge Function source remain in the repository for reference only; do not configure or deploy them for this release.

The portal reads the singleton `payment_instructions` row only when `is_active = true`. It displays the bank details and derives the amount from the learner's active NGN enrolment. The learner/parent supplies the transfer sender name and bank reference, with an optional HTTPS receipt link. The submission is stored as `pending`; the portal never marks it paid automatically.

An administrator must independently confirm that funds have arrived in the bank account before marking a submission paid. A rejected transfer is stored with status `failed`, with review time, reviewer and note recorded. The bank-instruction row is currently configured but inactive. Keep it inactive until Nuur Elites explicitly authorises activation.

Receipt proof currently uses an optional HTTPS link, not a private file upload. Do not request sensitive documents through public links. A private Supabase Storage bucket with ownership and access policies is a separate improvement required before introducing mandatory receipt uploads.

## 7. Email and WhatsApp functions

The package contains admin-authenticated Edge Function endpoints, but the admin dashboard does not yet have email or WhatsApp composer screens and admission notifications are not automatically triggered.

Optional email deployment (Resend):

```bash
supabase secrets set RESEND_API_KEY=YOUR_RESEND_API_KEY
supabase secrets set RESEND_FROM_EMAIL=YOUR_VERIFIED_SENDER_ADDRESS
supabase functions deploy send-email
```

Optional WhatsApp Cloud API deployment:

```bash
supabase secrets set WHATSAPP_ACCESS_TOKEN=YOUR_META_ACCESS_TOKEN
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=YOUR_PHONE_NUMBER_ID
supabase secrets set WHATSAPP_API_VERSION=v22.0
supabase functions deploy send-whatsapp
```

Verify the sender/domain and comply with WhatsApp opt-in and template rules. These endpoints are optional and are not connected to dashboard buttons in this release.

## 8. Supabase Auth URL settings

After choosing your final domain, open Supabase Dashboard → Authentication → URL Configuration:

- Set **Site URL** to the published website root.
- Add the published website root to Redirect URLs.
- Add `https://YOUR-PUBLISHED-DOMAIN/reset-password.html` to Redirect URLs.
- During local testing, add the Live Server origin and its `/reset-password.html` URL if Supabase requires them.

The admin and learning portal password reset buttons send recovery links to `reset-password.html`.

## 9. Production checklist

- [ ] Database backup completed.
- [x] LMS alignment migration recorded as applied to the connected Supabase project on 25 November 2026 (do not rerun).
- [ ] New LMS tables have RLS enabled and policies verified.
- [ ] Public registration creates a pending application.
- [ ] Admin can approve and reject applications.
- [ ] Admin can create courses, teachers, enrolments and lesson schedules.
- [ ] Student account sees only its own linked record and enrolments.
- [ ] Parent account sees only children linked through `student_guardians`.
- [ ] Teacher account sees only its assigned enrolments and can mark attendance and record assessments.
- [ ] Student/parent can see attendance, assessments, materials, assignments and payment history.
- [ ] Student can submit assignment work; assigned teacher can grade it.
- [ ] Password reset works on the published domain.
- [ ] Manual bank-transfer submission remains pending until administrator verification; test this with dedicated accounts before activation.
- [ ] Mobile layout, navigation, logo and all image paths have been checked.
- [ ] Supabase Auth Site URL and Redirect URLs match the final domain.
- [ ] No secret keys or tokens are present in public files or repository history.

## 10. Features still requiring separate implementation or account setup

- Automated email/WhatsApp notification triggers and dashboard composer screens.
- File uploads and private Supabase Storage buckets; the current materials feature accepts secure HTTPS resource links.
- Quiz creation and quiz-taking workflow.
- A full fee ledger/invoice and reconciliation system beyond enrolment-fee checkout and payment history.
- Live production verification with real student, parent and teacher test accounts.

Do not announce the platform as fully operational until the production checklist has been tested and signed off.

## 11. Publish the static website

The public pages are static files. Once local tests pass, publish the **contents of this project folder** to your chosen static host (for example, Cloudflare Pages or GitHub Pages). Use the project root as the output directory and leave the build command empty. Do not upload private keys or local secret files.

After publishing:

1. Open the final domain and test the homepage, registration, privacy notice, admin login, portal login and password reset.
2. Update Supabase Auth Site URL and Redirect URLs to that exact domain.
3. Confirm the manual bank-transfer option remains inactive until explicitly authorised. Paystack callback configuration is not part of this release.
4. Test all pages on a phone and desktop.

Supabase database and Edge Functions remain hosted in Supabase; publishing the static files does not deploy those backend components.

## 12. Current deployment review status

The connected Supabase project was checked on 25 November 2026. The project is active, the LMS resource tables and related columns exist, and the bank-transfer instructions are configured but inactive. This does not prove the complete website has passed authenticated end-to-end testing. See `SECURITY-REVIEW.md` for current advisor findings and remaining security work. Do not merge or announce production readiness until role-based tests and the production checklist are complete.


## Administrator portal account controls

The administrator dashboard provides account actions for linked student, parent/guardian and teacher logins:

- **Deactivate** suspends authentication access and marks the associated student/teacher record inactive. Learning, enrolment, attendance, assessment and payment history is retained.
- **Reactivate** restores the existing login and password and marks the associated student/teacher record active.
- **Delete Login** removes the authentication user and its profile association only. The student/teacher/parent records and historical academic and financial records are retained. A student or teacher record remains in the LMS so a new login can be linked later.
- For minors, the portal login belongs to the primary parent/guardian. Deleting or suspending that login can affect other children linked to the same guardian account.
- These actions are available only to authenticated administrators through the `manage-portal-account` Edge Function, which verifies the caller's JWT and admin role. The function requires JWT verification.
