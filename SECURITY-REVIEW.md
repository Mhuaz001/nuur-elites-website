# Nuur Elites — Supabase security and readiness review

Review date: 25 November 2026  
Project: `lrcnworfhrrntdltzgpe`  
Scope: connected Supabase project, current LMS review branch

## Current verified state

- Supabase project status: active/healthy.
- RLS is enabled on the LMS tables inspected.
- The bank-transfer instruction row contains the configured Moniepoint details and remains `is_active = false`.
- The payment INSERT policy requires the authenticated learner/parent to have access to the student, a matching active enrolment, the exact stored fee and currency, pending status, payment method `Bank Transfer`, a non-empty reference, and null gateway/recorded_by/paid_at fields.
- The browser portal submits bank transfers as pending. The admin review path is intended to mark them paid only after funds are independently confirmed.

## Security advisor findings

### 1. SECURITY DEFINER functions exposed to authenticated RPC

Supabase reports 13 public-schema functions executable by the `authenticated` role:

- `approve_student_application(uuid)`
- `can_access_enrollment(uuid)`
- `can_access_student(uuid)`
- `can_student_or_parent_access_student(uuid)`
- `current_student_id()`
- `current_teacher_id()`
- `is_admin()`
- `is_parent_of_student(uuid)`
- `is_teacher_for_enrollment(uuid)`
- `is_teacher_for_schedule(uuid, uuid)`
- `is_teacher_for_student(uuid)`
- `reject_student_application(uuid)`
- `teacher_can_write_assessment(uuid, uuid, uuid)`

The inspection found that all 13 have an empty/pinned search_path setting (`search_path = ''`) and are owned by postgres. The two application mutation functions explicitly check `public.is_admin()` before changing application records. The inspected function grants show no execution for `anon`, while `authenticated` can execute them.

This is a genuine hardening review item, but not sufficient evidence to revoke all execution grants. The LMS RLS policies call several of these helpers; revoking authenticated execution indiscriminately could break legitimate portal queries and policy evaluation. Before changing grants, map every function dependency and browser RPC call, retain only required execution, and test all roles.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### 2. Leaked-password protection disabled

Supabase Auth reports leaked-password protection is disabled. Enable it in the Supabase Authentication password/security settings, then test signup and password changes with compliant test accounts.

Remediation reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 3. Multiple permissive RLS policies

The advisor reports 23 multiple-permissive-policy findings across existing LMS tables. Many pairs combine an administrator `ALL` policy with a role-specific SELECT/INSERT/UPDATE policy. PostgreSQL combines permissive policies with OR semantics. Some overlaps may be intentional (for example, admin access plus a learner/teacher-specific policy), so this is primarily a policy-efficiency and maintainability warning until each policy pair is checked for unintended broad access.

Do not delete policies solely to silence the warning. First capture the complete policy expressions, map intended access by role, and test student A vs student B, parent A vs unrelated child, teacher A vs unassigned course, and non-admin vs admin.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

## Performance findings

The performance advisor also reports 19 foreign keys without covering indexes and 3 indexes currently unused. These are optimization findings, not proof of an access-control vulnerability. Prioritize indexes after reviewing actual query patterns and table sizes; do not drop indexes merely because they are currently unused on a small/low-traffic system.

Remediation reference: https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys

## Changes deliberately not made

- No RLS policies or function grants were changed during this review.
- No existing records were deleted or rewritten.
- Bank transfer remains inactive.
- No Paystack credentials or live payment flow were enabled.
- The pull request remains a draft and is not merged.

## Required verification before merge / production release

- [ ] Enable leaked-password protection in Supabase Auth settings.
- [ ] Complete function-by-function RPC and grant review; preserve required RLS helper execution.
- [ ] Review all 23 multiple-permissive-policy findings against the intended admin/student/parent/teacher access matrix.
- [ ] Run authenticated negative-access tests for unrelated students, parents and teachers.
- [ ] Test application approval/rejection using admin and non-admin accounts.
- [ ] Test bank-transfer submission as a learner and parent; confirm it remains pending.
- [ ] Test payment review as admin; confirm non-admins cannot mark payments paid.
- [ ] Run the Supabase advisors again after approved hardening changes.

This document records an assessment, not a security certification. Production readiness requires successful authenticated tests.
