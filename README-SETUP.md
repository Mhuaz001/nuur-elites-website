# Nuur Elites Learning and Consultancy — Deployment Candidate

This is the corrected static website and portal package for the existing Nuur Elites Supabase project.

**Important:** the files have been aligned to the database schema confirmed during the project work. This package is not live merely because it has been built. The database migration must be reviewed and applied, portal accounts must be linked, Edge Functions and provider credentials must be configured, and end-to-end tests must pass before public launch.

## 1. Package contents

- `index.html` — public homepage and service information.
- `registration.html`, `registration.js` — public student application form with privacy acknowledgement.
- `privacy.html` — website privacy notice for applicants and portal users.
- `404.html` — simple not-found page for static hosting.
- `admin.html`, `admin.js` — administrator sign-in and password reset request.
- `admin-dashboard.html`, `admin-dashboard.js` — admin management dashboard, including applications, students, courses, teachers, lesson schedules, enrolments and payments.
- `portal.html`, `portal.js` — shared role-based student, parent and teacher portal.
- `reset-password.html` — Supabase password recovery page.
- `payment-callback.html` — Paystack return information page; the signed webhook, not this page, confirms payment.
- `sql/production-alignment-migration.sql` — additive migration for the existing schema.
- `supabase/functions/` — Paystack initialisation/webhook, email and WhatsApp server functions.
- `images/` — existing Nuur Elites artwork and the supplied official logo.

This is a plain HTML/CSS/JavaScript site. It does not require `npm install` or a build command. Serve the folder from a local web server while testing; do not open the pages as `file://` URLs.

## 2. Database compatibility and safety

The existing database uses these tables and relationships:

- `profiles`, `students`, `parents`, `student_guardians`, `teachers`
- `student_applications`, `courses`, `enrollments`, `lesson_schedules`
- `attendance`, `assessments`, `payments`

The portal now uses `teachers.profile_id`, the parent-to-child relationship in `parents` and `student_guardians`, and the existing `enrollments` and `lesson_schedules` tables. It does **not** use `teachers.auth_user_id`, `lessons`, or a duplicate `student_enrollments` table.

### Apply the migration

1. Back up the Supabase database first.
2. Open Supabase Dashboard → SQL Editor.
3. Open `sql/production-alignment-migration.sql`.
4. Review the script and confirm that the existing helper functions it uses are present: `is_admin()`, `current_teacher_id()` and `can_access_student(uuid)`.
5. Run the migration once.
6. If any SQL error occurs, stop and share the complete error. Do not try the old migration or repeatedly rerun partial SQL.
7. Verify that `course_materials`, `assignments` and `assignment_submissions` exist, and that RLS is enabled on all three.

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

The enrolment fee is the amount used by the online Paystack flow. Check it carefully before enabling payments.

## 5. Create and link portal accounts

Do not create public self-registration for portal roles. Create/invite accounts through Supabase Authentication, then link the Auth user to the appropriate database record. Use the actual UUIDs from your project.

### Student

1. Supabase Dashboard → Authentication → Users → Add user / Invite user.
2. Copy the Auth user's UUID.
3. Create or update the profile:

```sql
insert into public.profiles (id, full_name, role)
values ('AUTH-USER-UUID', 'Student Full Name', 'student')
on conflict (id) do update
set full_name = excluded.full_name, role = excluded.role;
```

4. Link the existing student record:

```sql
update public.students
set profile_id = 'AUTH-USER-UUID'
where id = 'STUDENT-RECORD-UUID';
```

### Parent

1. Create/invite the parent's Auth user and copy the UUID.
2. Create/update the profile:

```sql
insert into public.profiles (id, full_name, role)
values ('PARENT-AUTH-UUID', 'Parent Full Name', 'parent')
on conflict (id) do update
set full_name = excluded.full_name, role = excluded.role;
```

3. Create the parent record:

```sql
insert into public.parents (profile_id, full_name, email, phone, relationship)
values ('PARENT-AUTH-UUID', 'Parent Full Name', 'parent@example.com', '08000000000', 'Mother')
returning id;
```

4. Use the returned parent UUID to link the correct child:

```sql
insert into public.student_guardians (student_id, parent_id, relationship, is_primary)
values ('STUDENT-RECORD-UUID', 'PARENT-RECORD-UUID', 'Mother', true);
```

Do not link a parent to a child solely by matching email text. The portal uses this explicit guardian relationship.

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

## 6. Paystack setup

The payment flow now takes the amount from the selected active enrolment's `tuition_fee` and `currency`. The payer cannot type an arbitrary amount into the portal. The webhook validates Paystack's signature and checks the stored transaction amount/currency before marking it paid.

1. Create/configure your Paystack merchant account.
2. Install the Supabase CLI and sign in.
3. From this project folder, link the Supabase project:

```bash
supabase login
supabase link --project-ref lrcnworfhrrntdltzgpe
```

4. Set the Paystack secrets locally in your terminal (do not share them):

```bash
supabase secrets set PAYSTACK_SECRET_KEY=YOUR_PAYSTACK_SECRET_KEY
supabase secrets set PAYSTACK_CALLBACK_URL=https://YOUR-PUBLISHED-DOMAIN/payment-callback.html
```

5. Deploy the two payment functions:

```bash
supabase functions deploy paystack-initialize
supabase functions deploy paystack-webhook
```

6. Set the Paystack webhook URL to:

`https://lrcnworfhrrntdltzgpe.supabase.co/functions/v1/paystack-webhook`

7. Test using Paystack test credentials first. Confirm that a successful test transaction updates the correct `payments` row to `paid`.
8. Only enable live credentials after test payments and reconciliation have been verified.

Paystack is not ready until your merchant credentials and published callback URL are configured. A browser redirect is not proof of payment; the webhook is authoritative.

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
- [ ] `production-alignment-migration.sql` reviewed and successfully applied.
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
- [ ] Paystack test payment is confirmed by the signed webhook.
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
3. Update `PAYSTACK_CALLBACK_URL` to the final domain, then redeploy `paystack-initialize` if you enabled Paystack.
4. Test all pages on a phone and desktop.

Supabase database and Edge Functions remain hosted in Supabase; publishing the static files does not deploy those backend components.

## Manual bank-transfer payment flow (current portal implementation)

The learner/parent portal now supports manual bank-transfer submissions. It reads the singleton `payment_instructions` row only when `is_active = true`, displays the configured account details, and lets an authenticated learner/parent submit the enrolment amount, sender name, bank reference and an optional HTTPS receipt link. New submissions are inserted as `pending`; the portal does not mark a transfer as paid.

Administrators can edit the bank instructions in **Admin Dashboard → Payments**. Keep **Make bank transfer available to learners** unticked until Nuur Elites explicitly decides to start accepting transfers. The admin payment list offers a review action for pending bank transfers. Before selecting **PAID**, the administrator must independently confirm the funds have arrived in the bank account. **REJECTED** is stored as `failed`; review time, reviewer and note are recorded.

Receipt proof is currently submitted as an optional HTTPS link, not uploaded into Supabase Storage. Do not ask learners to use a publicly accessible link for sensitive documents. A private receipt-upload bucket with ownership policies should be implemented before making mandatory file uploads available.

The older Paystack Edge Function source and callback page remain in this package as legacy files, but the portal no longer invokes Paystack. They are not part of the manual bank-transfer flow. Do not configure or activate Paystack unless the payment method is deliberately changed later.
