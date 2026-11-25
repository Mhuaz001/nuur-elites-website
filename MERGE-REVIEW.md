# Nuur Elites merged website — merge notes

## Source packages
This release combines the two ZIP uploads:
- `nuur_elites_completed_package(1).zip`
- `NUUR_ELITES_DEPLOYMENT_CANDIDATE_2026-11-15(1).zip`

## Merge decision
The deployment-candidate package was used as the primary source because it contains the newer and more complete coordinated implementation of:
- the public homepage and privacy notice;
- administrator login and dashboard;
- the shared student/parent/teacher portal;
- the schema-aligned production migration;
- Paystack initialization and webhook functions;
- email and WhatsApp server functions;
- deployment headers, 404 page and setup documentation.

Where both packages contained the same path, the newer deployment-candidate version was retained. All matching brand image assets were preserved.

## Intentionally excluded
The older package contains `sql/complete-platform-migration.sql`. It was not included as an executable migration because it belongs to an older database design and risks introducing duplicate or incompatible LMS tables. The merged package retains only `sql/production-alignment-migration.sql`, which is additive and designed around the previously confirmed existing schema (`enrollments`, `lesson_schedules`, `profiles`, `students`, `teachers`, `attendance`, and `assessments`).

## Static checks performed
- JavaScript syntax checks passed for all four browser JavaScript files.
- HTML-to-JavaScript static element-ID references checked; no missing statically referenced IDs found.
- Local HTML asset/script/link references checked; no missing local references found.
- ZIP archive integrity checked after packaging.

## Important production limitation
Static checks do not prove live operation. The package has not been authenticated against the user's live Supabase database, tested with real student/parent/teacher accounts, deployed to a hosting provider, or verified with Paystack/Resend/WhatsApp credentials. Apply the documented migration only after a database backup, configure provider secrets, and complete the end-to-end checklist in `README-SETUP.md` before launch.
