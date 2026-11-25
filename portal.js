import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (id) => document.getElementById(id);
const state = {
  user: null, profile: null, role: null, teacher: null, parent: null,
  students: [], enrollments: [], courses: [], schedules: [], attendance: [],
  assessments: [], materials: [], assignments: [], submissions: [], payments: []
};

$('year').textContent = new Date().getFullYear();
const esc = (value = '') => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateText = value => value ? new Date(value).toLocaleDateString() : '—';
const dateTimeText = value => value ? new Date(value).toLocaleString() : '—';
const timeText = value => value ? String(value).slice(0, 5) : '—';
const showMessage = (id, message, color = 'var(--green)') => { const el = $(id); if (el) { el.textContent = message; el.style.color = color; } };
const showEmpty = (id, message) => { const el = $(id); if (el) el.innerHTML = `<div class="empty">${esc(message)}</div>`; };
const unique = values => [...new Set(values.filter(Boolean))];
const courseName = id => state.courses.find(c => c.id === id)?.name || state.courses.find(c => c.id === id)?.title || 'Course';
const studentName = id => state.students.find(s => s.id === id)?.student_name || 'Student';
const enrollmentLabel = e => `${studentName(e.student_id)} — ${courseName(e.course_id)}`;

async function getProfile(user) {
  const { data, error } = await supabase.from('profiles').select('id, full_name, role').eq('id', user.id).single();
  if (error || !data) throw new Error('Your portal profile is not set up. Please contact Nuur Elites administration.');
  return data;
}

async function startPortal() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('Please sign in again.');
  const profile = await getProfile(user);
  const role = String(profile.role || '').toLowerCase();
  if (!['student', 'parent', 'teacher'].includes(role)) {
    throw new Error('This portal is for student, parent and teacher accounts. Administrators should use the administrator dashboard.');
  }
  Object.assign(state, { user, profile, role });
  $('loginView').classList.add('hidden');
  $('portalView').classList.remove('hidden');
  $('welcomeName').textContent = profile.full_name || user.email;
  $('roleLabel').textContent = `${role.charAt(0).toUpperCase()}${role.slice(1)} account`;
  $('accountRole').textContent = role;
  $('pageHeading').textContent = `Welcome, ${profile.full_name || 'Learner'}`;
  $('homeIntro').textContent = role === 'parent' ? 'View your linked children’s learning activity.' : role === 'teacher' ? 'Manage your assigned learners and teaching activity.' : 'Your learning activity at a glance.';
  if (role === 'teacher') {
    $('attendanceForm').classList.remove('hidden');
    $('assessmentForm').classList.remove('hidden');
    $('addMaterialButton').classList.remove('hidden');
    $('addAssignmentButton').classList.remove('hidden');
    $('paymentForm').classList.add('hidden');
  }
  await loadPortalData();
}

async function loadPortalData() {
  try {
    let studentIds = [];
    if (state.role === 'teacher') {
      const { data: teacher, error } = await supabase.from('teachers').select('id, full_name, profile_id').eq('profile_id', state.user.id).single();
      if (error || !teacher) throw new Error('No teacher record is linked to this login. Ask the administrator to link teachers.profile_id to your account.');
      state.teacher = teacher;
      const { data: enrolments, error: enrolmentError } = await supabase.from('enrollments')
        .select('id, student_id, course_id, teacher_id, start_date, status, tuition_fee, currency')
        .eq('teacher_id', teacher.id).order('start_date', { ascending: false });
      if (enrolmentError) throw enrolmentError;
      state.enrollments = enrolments || [];
      studentIds = unique(state.enrollments.map(e => e.student_id));
    } else if (state.role === 'student') {
      const { data: students, error } = await supabase.from('students')
        .select('id, student_name, profile_id, status').eq('profile_id', state.user.id);
      if (error) throw error;
      state.students = students || [];
      studentIds = state.students.map(s => s.id);
      if (studentIds.length) {
        const { data: enrolments, error: enrolmentError } = await supabase.from('enrollments')
          .select('id, student_id, course_id, teacher_id, start_date, status, tuition_fee, currency')
          .in('student_id', studentIds).order('start_date', { ascending: false });
        if (enrolmentError) throw enrolmentError;
        state.enrollments = enrolments || [];
      }
    } else {
      const { data: parent, error: parentError } = await supabase.from('parents').select('id, full_name, profile_id').eq('profile_id', state.user.id).single();
      if (parentError || !parent) throw new Error('No parent record is linked to this login. Ask the administrator to link your parents.profile_id.');
      state.parent = parent;
      const { data: links, error: linkError } = await supabase.from('student_guardians').select('student_id').eq('parent_id', parent.id);
      if (linkError) throw linkError;
      studentIds = unique((links || []).map(link => link.student_id));
      if (studentIds.length) {
        const { data: students, error } = await supabase.from('students').select('id, student_name, status').in('id', studentIds);
        if (error) throw error;
        state.students = students || [];
        const { data: enrolments, error: enrolmentError } = await supabase.from('enrollments')
          .select('id, student_id, course_id, teacher_id, start_date, status, tuition_fee, currency')
          .in('student_id', studentIds).order('start_date', { ascending: false });
        if (enrolmentError) throw enrolmentError;
        state.enrollments = enrolments || [];
      }
    }

    if (state.role === 'teacher' && studentIds.length) {
      const { data: students, error } = await supabase.from('students').select('id, student_name, status').in('id', studentIds);
      if (error) throw error;
      state.students = students || [];
    }

    const courseIds = unique(state.enrollments.map(e => e.course_id));
    if (courseIds.length) {
      const { data: courses, error } = await supabase.from('courses').select('id, name, title, category, description, fee, status').in('id', courseIds);
      if (error) throw error;
      state.courses = courses || [];
    } else state.courses = [];

    const enrollmentIds = state.enrollments.map(e => e.id);
    if (enrollmentIds.length) {
      const { data: schedules, error } = await supabase.from('lesson_schedules')
        .select('id, enrollment_id, weekday, start_time, duration_minutes, timezone, meeting_url, created_at')
        .in('enrollment_id', enrollmentIds).order('weekday').order('start_time');
      if (error) throw error;
      state.schedules = schedules || [];
    } else state.schedules = [];

    if (studentIds.length) {
      const { data: attendance, error } = await supabase.from('attendance')
        .select('id, schedule_id, student_id, lesson_date, status, notes, marked_by, created_at')
        .in('student_id', studentIds).order('lesson_date', { ascending: false });
      if (error) throw error;
      state.attendance = attendance || [];
      const { data: assessments, error: assessmentError } = await supabase.from('assessments')
        .select('id, enrollment_id, student_id, teacher_id, title, score, maximum_score, feedback, assessed_at')
        .in('student_id', studentIds).order('assessed_at', { ascending: false });
      if (assessmentError) throw assessmentError;
      state.assessments = assessments || [];
      const { data: payments, error: paymentError } = await supabase.from('payments')
        .select('id, enrollment_id, student_id, amount, currency, payment_date, payment_method, reference, status, transfer_sender_name, receipt_url, submitted_at, reviewed_at, review_note')
        .in('student_id', studentIds).order('payment_date', { ascending: false });
      if (paymentError) throw paymentError;
      state.payments = payments || [];
    } else {
      state.attendance = [];
      state.assessments = [];
      state.payments = [];
    }

    if (courseIds.length) {
      const { data: materials, error: materialError } = await supabase.from('course_materials')
        .select('id, course_id, teacher_id, title, description, resource_type, resource_url, created_at')
        .in('course_id', courseIds).order('created_at', { ascending: false });
      if (materialError) throw materialError;
      state.materials = materials || [];
      const { data: assignments, error: assignmentError } = await supabase.from('assignments')
        .select('id, course_id, teacher_id, title, instructions, due_at, created_at')
        .in('course_id', courseIds).order('created_at', { ascending: false });
      if (assignmentError) throw assignmentError;
      state.assignments = assignments || [];
      const assignmentIds = state.assignments.map(a => a.id);
      if (assignmentIds.length && state.role !== 'teacher' && studentIds.length) {
        const { data: submissions, error: submissionError } = await supabase.from('assignment_submissions')
          .select('id, assignment_id, student_id, submission_text, submission_url, submitted_at, grade, teacher_feedback, graded_at')
          .in('assignment_id', assignmentIds).in('student_id', studentIds);
        if (submissionError) throw submissionError;
        state.submissions = submissions || [];
      } else if (assignmentIds.length && state.role === 'teacher') {
        const { data: submissions, error: submissionError } = await supabase.from('assignment_submissions')
          .select('id, assignment_id, student_id, submission_text, submission_url, submitted_at, grade, teacher_feedback, graded_at')
          .in('assignment_id', assignmentIds);
        if (submissionError) throw submissionError;
        state.submissions = submissions || [];
      } else state.submissions = [];
    } else {
      state.materials = [];
      state.assignments = [];
      state.submissions = [];
    }

    renderAll();
  } catch (error) {
    console.error('Portal data error:', error);
    showMessage('loginMessage', error.message || 'Some portal information could not be loaded.', 'var(--red)');
    showEmpty('coursesList', 'Unable to load courses. Contact administration.');
    showEmpty('lessonsList', 'Unable to load the timetable. Contact administration.');
    showEmpty('attendanceList', 'Unable to load attendance records.');
    showEmpty('assessmentsList', 'Unable to load assessments.');
    showEmpty('materialsList', 'Unable to load learning materials.');
    showEmpty('assignmentsList', 'Unable to load assignments.');
    showEmpty('paymentsList', 'Unable to load payment history.');
  }
}

function renderAll() {
  $('courseCount').textContent = state.courses.length;
  $('lessonCount').textContent = state.schedules.length;
  $('attendanceCount').textContent = state.attendance.length;
  $('assessmentCount').textContent = state.assessments.length;
  renderCourses(); renderLessons(); renderAttendance(); renderAssessments(); renderMaterials(); renderAssignments(); renderPayments();
  populateTeacherControls(); populateMaterialAndAssignmentCourses(); populatePaymentEnrollments();
}

function renderCourses() {
  if (!state.enrollments.length) return showEmpty('coursesList', 'No course enrolments are linked to this account yet.');
  $('coursesList').innerHTML = state.enrollments.map(e => {
    const c = state.courses.find(item => item.id === e.course_id) || {};
    return `<article class="item"><h3>${esc(c.name || c.title || 'Course')}</h3><p>${esc(c.category || '')}</p><p><strong>Enrolment:</strong> ${esc(e.status || 'active')} · <strong>Start:</strong> ${esc(dateText(e.start_date))}</p><p><strong>Fee:</strong> ${esc(e.currency || 'NGN')} ${Number(e.tuition_fee ?? c.fee ?? 0).toLocaleString()}</p></article>`;
  }).join('');
}

function renderLessons() {
  if (!state.schedules.length) return showEmpty('lessonsList', 'No lesson timetable has been published for your enrolments yet.');
  $('lessonsList').innerHTML = state.schedules.map(s => {
    const e = state.enrollments.find(item => item.id === s.enrollment_id) || {};
    const meeting = s.meeting_url && /^https:\/\//i.test(s.meeting_url) ? `<p><a href="${esc(s.meeting_url)}" target="_blank" rel="noopener">Join online lesson</a></p>` : '';
    return `<article class="item"><h3>${esc(courseName(e.course_id))}</h3><p><strong>Learner:</strong> ${esc(studentName(e.student_id))}</p><p><strong>Day:</strong> ${esc(s.weekday)} · <strong>Time:</strong> ${esc(timeText(s.start_time))}</p><p><strong>Duration:</strong> ${esc(s.duration_minutes || 60)} minutes · <strong>Timezone:</strong> ${esc(s.timezone || 'Africa/Lagos')}</p>${meeting}</article>`;
  }).join('');
}

function renderAttendance() {
  if (!state.attendance.length) return showEmpty('attendanceList', 'No attendance records have been recorded yet.');
  $('attendanceList').innerHTML = state.attendance.map(a => `<article class="item"><h3>${esc(studentName(a.student_id))}</h3><p><strong>Date:</strong> ${esc(dateText(a.lesson_date))} · <span class="pill">${esc(a.status || 'not recorded')}</span></p><p>${esc(a.notes || '')}</p></article>`).join('');
}

function renderAssessments() {
  if (!state.assessments.length) return showEmpty('assessmentsList', 'No assessment results have been published yet.');
  $('assessmentsList').innerHTML = state.assessments.map(a => `<article class="item"><h3>${esc(a.title)}</h3><p><strong>Learner:</strong> ${esc(studentName(a.student_id))}</p><p><strong>Score:</strong> ${esc(a.score)} / ${esc(a.maximum_score)} · <strong>Date:</strong> ${esc(dateText(a.assessed_at))}</p><p>${esc(a.feedback || '')}</p></article>`).join('');
}

function renderMaterials() {
  if (!state.materials.length) return showEmpty('materialsList', 'No learning materials have been published yet.');
  $('materialsList').innerHTML = state.materials.map(m => {
    const safeUrl = /^https:\/\//i.test(m.resource_url || '') ? m.resource_url : '';
    return `<article class="item"><h3>${esc(m.title)}</h3><p>${esc(courseName(m.course_id))}</p><p>${esc(m.description || '')}</p><p><span class="pill">${esc(m.resource_type || 'resource')}</span></p>${safeUrl ? `<a href="${esc(safeUrl)}" target="_blank" rel="noopener">Open learning resource</a>` : '<span class="muted">Resource link unavailable</span>'}</article>`;
  }).join('');
}

function renderAssignments() {
  if (!state.assignments.length) return showEmpty('assignmentsList', 'There are no assignments at the moment.');
  $('assignmentsList').innerHTML = state.assignments.map(a => {
    const submissions = state.submissions.filter(s => s.assignment_id === a.id);
    let action = '';
    if (state.role === 'student') {
      const own = submissions.find(s => s.student_id === state.students[0]?.id);
      action = own
        ? `<p><strong>Submitted:</strong> ${esc(dateTimeText(own.submitted_at))} · <strong>Grade:</strong> ${esc(own.grade ?? 'Pending')}</p><p>${esc(own.teacher_feedback || '')}</p>`
        : `<form class="submission-form" data-assignment-id="${esc(a.id)}"><label>Written response</label><textarea name="submission_text" placeholder="Enter your response"></textarea><label>Optional link to your work</label><input name="submission_url" type="url" placeholder="https://..."><button class="primary" type="submit">Submit assignment</button><p class="message"></p></form>`;
    } else if (state.role === 'teacher' && submissions.length) {
      action = `<div class="stack">${submissions.map(s => `<form class="grade-form item" data-submission-id="${esc(s.id)}"><p><strong>${esc(studentName(s.student_id))}</strong> · Submitted ${esc(dateText(s.submitted_at))}</p><p>${esc(s.submission_text || '')}</p>${s.submission_url ? `<a href="${esc(s.submission_url)}" target="_blank" rel="noopener">Open submitted work</a>` : ''}<div class="form-grid"><div><label>Grade</label><input name="grade" type="number" min="0" step="any" value="${esc(s.grade ?? '')}" required></div><div><label>Feedback</label><input name="teacher_feedback" value="${esc(s.teacher_feedback || '')}"></div></div><button class="secondary" type="submit">Save grade</button></form>`).join('')}</div>`;
    } else if (state.role === 'parent' && submissions.length) {
      action = `<div class="stack">${submissions.map(s => `<div class="item"><p><strong>${esc(studentName(s.student_id))}</strong> · ${esc(s.grade == null ? 'Submitted — awaiting grade' : `Grade: ${s.grade}`)}</p><p>${esc(s.teacher_feedback || '')}</p></div>`).join('')}</div>`;
    }
    return `<article class="item"><h3>${esc(a.title)}</h3><p><strong>Course:</strong> ${esc(courseName(a.course_id))}</p><p>${esc(a.instructions || '')}</p><p><strong>Due:</strong> ${esc(dateTimeText(a.due_at))}</p>${action}</article>`;
  }).join('');
}

function renderPayments() {
  if (state.role === 'teacher') return showEmpty('paymentsList', 'Teacher remuneration and payment statements are managed by Nuur Elites administration.');
  if (!state.payments.length) return showEmpty('paymentsList', 'No payment records are available yet.');
  $('paymentsList').innerHTML = state.payments.map(p => `<article class="item"><h3>${esc(p.currency || 'NGN')} ${Number(p.amount || 0).toLocaleString()}</h3><p>${esc(dateText(p.submitted_at || p.payment_date))} · ${esc(p.payment_method || 'Payment')}</p><p>Reference: ${esc(p.reference || '—')} · <span class="pill">${esc(p.status || 'pending')}</span></p>${p.review_note ? `<p>Admin note: ${esc(p.review_note)}</p>` : ''}</article>`).join('');
}

function populateTeacherControls() {
  if (state.role !== 'teacher') return;
  const scheduleSelect = $('attendanceSchedule');
  scheduleSelect.replaceChildren();
  state.schedules.forEach(s => {
    const e = state.enrollments.find(item => item.id === s.enrollment_id) || {};
    const opt = document.createElement('option'); opt.value = s.id;
    opt.textContent = `${studentName(e.student_id)} — ${courseName(e.course_id)} — ${s.weekday} ${timeText(s.start_time)}`;
    scheduleSelect.appendChild(opt);
  });
  const studentSelect = $('attendanceStudent');
  studentSelect.replaceChildren();
  state.students.forEach(s => { const opt = document.createElement('option'); opt.value = s.id; opt.textContent = s.student_name || 'Student'; studentSelect.appendChild(opt); });
  const enrollmentSelect = $('assessmentEnrollment');
  enrollmentSelect.replaceChildren();
  state.enrollments.forEach(e => { const opt = document.createElement('option'); opt.value = e.id; opt.textContent = enrollmentLabel(e); enrollmentSelect.appendChild(opt); });
}

function populateMaterialAndAssignmentCourses() {
  if (state.role !== 'teacher') return;
  for (const id of ['materialCourse', 'assignmentCourse']) {
    const select = $(id); select.replaceChildren();
    unique(state.enrollments.map(e => e.course_id)).forEach(courseId => {
      const opt = document.createElement('option'); opt.value = courseId; opt.textContent = courseName(courseId); select.appendChild(opt);
    });
  }
}

async function populatePaymentEnrollments() {
  if (state.role === 'teacher') { $('paymentForm').classList.add('hidden'); return; }
  const instructionBox = $('bankTransferInstructions');
  const { data: instructions, error } = await supabase.from('payment_instructions')
    .select('bank_name, account_name, account_number, account_type, instructions, is_active')
    .eq('id', true).eq('is_active', true).maybeSingle();
  if (error) {
    instructionBox.textContent = 'Payment instructions could not be loaded. Please contact administration.';
    $('paymentForm').classList.add('hidden');
    return;
  }
  if (!instructions) {
    instructionBox.textContent = 'Bank transfer is not yet available. Please contact Nuur Elites administration.';
    $('paymentForm').classList.add('hidden');
    return;
  }
  instructionBox.innerHTML = `<h3>Bank transfer details</h3><p><strong>Bank:</strong> ${esc(instructions.bank_name)}</p><p><strong>Account name:</strong> ${esc(instructions.account_name)}</p><p><strong>Account number:</strong> <strong>${esc(instructions.account_number)}</strong></p><p><strong>Account type:</strong> ${esc(instructions.account_type || '—')}</p><p>${esc(instructions.instructions || '')}</p>`;
  const select = $('paymentEnrollment'); select.replaceChildren();
  const payable = state.enrollments.filter(e => (e.status || 'active') === 'active' && String(e.currency || 'NGN').toUpperCase() === 'NGN' && Number(e.tuition_fee) > 0);
  payable.forEach(e => { const opt = document.createElement('option'); opt.value = e.id; opt.textContent = enrollmentLabel(e); select.appendChild(opt); });
  if (!payable.length) {
    $('paymentForm').classList.add('hidden');
    $('paymentAmountLabel').textContent = 'No active NGN enrolment with a payable fee is linked to this account. Please contact administration.';
  } else { $('paymentForm').classList.remove('hidden'); updatePaymentAmount(); }
}

function updatePaymentAmount() {
  const e = state.enrollments.find(item => item.id === $('paymentEnrollment').value);
  $('paymentAmountLabel').textContent = e ? `Amount to transfer: ₦${Number(e.tuition_fee).toLocaleString()}` : 'Select an enrolment to see the payable fee.';
}

$('forgotPasswordButton').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) { showMessage('loginMessage', 'Enter your email address first, then choose Forgot password.', 'var(--red)'); return; }
  const button = $('forgotPasswordButton'); button.disabled = true;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password.html` });
    if (error) throw error;
    showMessage('loginMessage', 'If this email belongs to an account, a password reset link has been sent. Check your inbox.');
  } catch (error) { showMessage('loginMessage', error.message || 'Password reset could not be requested.', 'var(--red)'); }
  finally { button.disabled = false; }
});

$('loginForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('loginButton'); button.disabled = true; button.textContent = 'Signing in…';
  showMessage('loginMessage', 'Verifying your account…');
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: $('email').value.trim(), password: $('password').value });
    if (error) throw error;
    await startPortal();
  } catch (error) {
    console.error(error); showMessage('loginMessage', error.message || 'Unable to sign in.', 'var(--red)');
    await supabase.auth.signOut();
  } finally { button.disabled = false; button.textContent = 'Sign in'; }
});

$('attendanceForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('saveAttendanceButton'); button.disabled = true;
  try {
    const scheduleId = $('attendanceSchedule').value;
    const studentId = $('attendanceStudent').value;
    const lessonDate = $('attendanceDate').value;
    if (!scheduleId || !studentId || !lessonDate) throw new Error('Select a schedule, student and lesson date.');
    const { data: existing, error: lookupError } = await supabase.from('attendance').select('id')
      .eq('schedule_id', scheduleId).eq('student_id', studentId).eq('lesson_date', lessonDate).limit(1).maybeSingle();
    if (lookupError) throw lookupError;
    const record = { schedule_id: scheduleId, student_id: studentId, lesson_date: lessonDate, status: $('attendanceStatus').value, notes: $('attendanceNotes').value.trim(), marked_by: state.user.id };
    const result = existing?.id
      ? await supabase.from('attendance').update(record).eq('id', existing.id)
      : await supabase.from('attendance').insert(record);
    if (result.error) throw result.error;
    showMessage('attendanceMessage', 'Attendance saved successfully.');
    $('attendanceNotes').value = '';
    await loadPortalData();
  } catch (error) { showMessage('attendanceMessage', error.message, 'var(--red)'); }
  finally { button.disabled = false; }
});

$('assessmentForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('saveAssessmentButton'); button.disabled = true;
  try {
    const enrollment = state.enrollments.find(e => e.id === $('assessmentEnrollment').value);
    if (!enrollment) throw new Error('Select a valid student enrolment.');
    const score = Number($('assessmentScore').value);
    const maximum = Number($('assessmentMaximum').value);
    if (score < 0 || maximum <= 0 || score > maximum) throw new Error('Enter a valid score not greater than the maximum score.');
    const { error } = await supabase.from('assessments').insert({
      enrollment_id: enrollment.id, student_id: enrollment.student_id, teacher_id: state.teacher.id,
      title: $('assessmentTitle').value.trim(), score, maximum_score: maximum,
      feedback: $('assessmentFeedback').value.trim(), assessed_at: new Date().toISOString()
    });
    if (error) throw error;
    showMessage('assessmentMessage', 'Assessment saved successfully.');
    $('assessmentForm').reset(); $('assessmentMaximum').value = '100';
    await loadPortalData();
  } catch (error) { showMessage('assessmentMessage', error.message, 'var(--red)'); }
  finally { button.disabled = false; }
});

$('addMaterialButton').addEventListener('click', () => $('materialDialog').showModal());
$('addAssignmentButton').addEventListener('click', () => $('assignmentDialog').showModal());
document.querySelectorAll('[data-dialog-close]').forEach(button => button.addEventListener('click', () => $(button.dataset.dialogClose).close()));

$('materialForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const url = $('materialUrl').value.trim(); if (!/^https:\/\//i.test(url)) throw new Error('Please use a secure https:// resource link.');
    const { error } = await supabase.from('course_materials').insert({ title: $('materialTitle').value.trim(), course_id: $('materialCourse').value, resource_type: $('materialType').value, resource_url: url, description: $('materialDescription').value.trim(), teacher_id: state.teacher.id });
    if (error) throw error;
    $('materialForm').reset(); $('materialDialog').close(); await loadPortalData();
  } catch (error) { showMessage('materialMessage', error.message, 'var(--red)'); }
  finally { button.disabled = false; }
});

$('assignmentForm').addEventListener('submit', async event => {
  event.preventDefault(); const button = event.submitter; button.disabled = true;
  try {
    const due = $('assignmentDue').value;
    const { error } = await supabase.from('assignments').insert({ title: $('assignmentTitle').value.trim(), course_id: $('assignmentCourse').value, instructions: $('assignmentInstructions').value.trim(), due_at: due ? new Date(due).toISOString() : null, teacher_id: state.teacher.id });
    if (error) throw error;
    $('assignmentForm').reset(); $('assignmentDialog').close(); await loadPortalData();
  } catch (error) { showMessage('assignmentMessage', error.message, 'var(--red)'); }
  finally { button.disabled = false; }
});

$('assignmentsList').addEventListener('submit', async event => {
  const form = event.target.closest('.submission-form, .grade-form');
  if (!form) return;
  event.preventDefault(); const button = form.querySelector('button[type="submit"]'); button.disabled = true;
  try {
    const data = new FormData(form);
    if (form.classList.contains('submission-form')) {
      const submissionText = String(data.get('submission_text') || '').trim();
      const submissionUrl = String(data.get('submission_url') || '').trim();
      if (!submissionText && !submissionUrl) throw new Error('Enter a written response or provide a link to your work.');
      if (submissionUrl && !/^https:\/\//i.test(submissionUrl)) throw new Error('Submission links must begin with https://');
      if (state.students.length !== 1) throw new Error('Please contact administration to clarify the student account linked to this login.');
      const { error } = await supabase.from('assignment_submissions').insert({ assignment_id: form.dataset.assignmentId, student_id: state.students[0].id, submission_text: submissionText || null, submission_url: submissionUrl || null });
      if (error) throw error;
    } else {
      const grade = Number(data.get('grade'));
      if (!Number.isFinite(grade) || grade < 0) throw new Error('Enter a valid grade.');
      const { error } = await supabase.from('assignment_submissions').update({ grade, teacher_feedback: String(data.get('teacher_feedback') || '').trim(), graded_at: new Date().toISOString() }).eq('id', form.dataset.submissionId);
      if (error) throw error;
    }
    await loadPortalData();
  } catch (error) { const msg = form.querySelector('.message'); if (msg) showMessage(msg.id, error.message, 'var(--red)'); else alert(error.message); }
  finally { button.disabled = false; }
});

$('paymentEnrollment').addEventListener('change', updatePaymentAmount);
$('paymentForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = $('payNowButton'); button.disabled = true; button.textContent = 'Submitting…';
  showMessage('paymentMessage', 'Submitting transfer details for administrator verification…');
  try {
    const enrollment = state.enrollments.find(e => e.id === $('paymentEnrollment').value);
    if (!enrollment) throw new Error('Select a valid course enrolment.');
    const reference = $('transferReference').value.trim();
    const sender = $('transferSenderName').value.trim();
    const receiptUrl = $('transferReceiptUrl').value.trim();
    if (!reference || !sender) throw new Error('Enter the sender name and bank transfer reference.');
    if (receiptUrl && !/^https:\/\//i.test(receiptUrl)) throw new Error('The receipt link must begin with https://.');
    const { error } = await supabase.from('payments').insert({
      enrollment_id: enrollment.id, student_id: enrollment.student_id,
      student_name: studentName(enrollment.student_id), amount: Number(enrollment.tuition_fee),
      currency: enrollment.currency || 'NGN', status: 'pending', payment_method: 'Bank Transfer',
      reference, transfer_sender_name: sender, receipt_url: receiptUrl || null,
      submitted_at: new Date().toISOString(), gateway: null, gateway_reference: null,
      recorded_by: null, paid_at: null
    });
    if (error) throw error;
    $('paymentForm').reset();
    showMessage('paymentMessage', 'Transfer submitted. Your payment is pending verification; you will see the updated status here after review.');
    await loadPortalData();
  } catch (error) {
    console.error(error);
    showMessage('paymentMessage', error.message || 'Transfer submission failed. Please contact administration.', 'var(--red)');
  } finally { button.disabled = false; button.textContent = 'Submit transfer for verification'; }
});

document.querySelectorAll('.nav button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.nav button').forEach(item => item.classList.remove('active'));
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  button.classList.add('active'); $(button.dataset.section).classList.add('active');
}));

$('logoutButton').addEventListener('click', async () => {
  $('logoutButton').disabled = true;
  const { error } = await supabase.auth.signOut();
  if (error) { alert(error.message); $('logoutButton').disabled = false; return; }
  $('portalView').classList.add('hidden'); $('loginView').classList.remove('hidden'); $('loginForm').reset();
});

const { data: { session }, error: sessionError } = await supabase.auth.getSession();
if (sessionError) showMessage('loginMessage', 'Unable to verify your session. Please sign in again.', 'var(--red)');
if (session) {
  try { await startPortal(); }
  catch (error) { console.error(error); showMessage('loginMessage', error.message, 'var(--red)'); await supabase.auth.signOut(); }
}
