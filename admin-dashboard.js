
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// =====================================================
// 1. SUPABASE CONNECTION
// =====================================================

const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// =====================================================
// 2. PAGE ELEMENTS
// =====================================================

const accessMessage = document.getElementById('accessMessage');
const dashboard = document.getElementById('dashboard');
const logoutButton = document.getElementById('logoutButton');

const applicationTableBody =
  document.getElementById('applicationTableBody');

const applicationMessage =
  document.getElementById('applicationMessage');

const studentTableBody =
  document.getElementById('studentTableBody');

const studentMessage =
  document.getElementById('studentMessage');

const studentSearch =
  document.getElementById('studentSearch');

const studentProfileModal =
  document.getElementById('studentProfileModal');

const recordModal = document.getElementById('recordModal');
const recordForm = document.getElementById('recordForm');
const recordFormFields = document.getElementById('recordFormFields');
const recordModalTitle = document.getElementById('recordModalTitle');
const recordFormMessage = document.getElementById('recordFormMessage');
const saveRecordButton = document.getElementById('saveRecordButton');

let allApplications = [];
let allStudents = [];
let editingRecordId = null;
let currentResource = null;
let adminUserId = null;

// =====================================================
// 3. MANAGEMENT SECTION CONFIGURATION
// =====================================================

const resources = {

  courses: {
    title: 'Course',
    table: 'courses',

    columns: [
      ['name', 'Course Name'],
      ['category', 'Category'],
      ['description', 'Description'],
      ['fee', 'Fee'],
      ['status', 'Status']
    ],

    fields: [
      { name: 'name', label: 'Course Name', required: true },
      { name: 'category', label: 'Category', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'fee', label: 'Fee', type: 'number' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['active', 'inactive']
      }
    ]
  },

  teachers: {
    title: 'Teacher',
    table: 'teachers',

    columns: [
      ['full_name', 'Teacher'],
      ['email', 'Email'],
      ['phone', 'Phone'],
      ['qualification', 'Qualification'],
      ['specialization', 'Specialisation'],
      ['status', 'Status']
    ],

    fields: [
      { name: 'full_name', label: 'Full Name', required: true },
      { name: 'profile_id', label: 'Linked Auth Profile UUID' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'phone', label: 'Phone Number' },
      { name: 'qualification', label: 'Qualification' },
      { name: 'specialization', label: 'Specialisation' },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['active', 'inactive']
      }
    ]
  },

  lessons: {
    title: 'Lesson Schedule',
    table: 'lesson_schedules',

    columns: [
      ['enrollment_id', 'Enrolment ID'],
      ['weekday', 'Weekday'],
      ['start_time', 'Start Time'],
      ['duration_minutes', 'Duration'],
      ['timezone', 'Timezone'],
      ['meeting_url', 'Meeting Link']
    ],

    fields: [
      { name: 'enrollment_id', label: 'Enrolment UUID', required: true },
      {
        name: 'weekday', label: 'Weekday', type: 'select', required: true,
        options: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      { name: 'start_time', label: 'Start Time', type: 'time', required: true },
      { name: 'duration_minutes', label: 'Duration (minutes)', type: 'number' },
      { name: 'timezone', label: 'Timezone', required: true },
      { name: 'meeting_url', label: 'Meeting URL', type: 'url' }
    ]
  },

  payments: {
    title: 'Payment',
    table: 'payments',

    columns: [
      ['student_name', 'Student'],
      ['amount', 'Amount'],
      ['currency', 'Currency'],
      ['payment_date', 'Payment Date'],
      ['payment_method', 'Method'],
      ['reference', 'Reference'],
      ['status', 'Status'],
      ['transfer_sender_name', 'Sender'],
      ['receipt_url', 'Proof'],
      ['reviewed_at', 'Reviewed']
    ],

    fields: [
      {
        name: 'student_name',
        label: 'Student Name',
        required: true
      },
      {
        name: 'amount',
        label: 'Amount',
        type: 'number',
        required: true
      },
      {
        name: 'currency',
        label: 'Currency',
        type: 'select',
        options: ['NGN', 'USD', 'GBP', 'EUR']
      },
      {
        name: 'payment_date',
        label: 'Payment Date',
        type: 'date'
      },
      {
        name: 'payment_method',
        label: 'Payment Method',
        type: 'select',
        options: ['Bank Transfer', 'Cash', 'Card', 'Other']
      },
      {
        name: 'reference',
        label: 'Payment Reference'
      },
      {
        name: 'status',
        label: 'Payment Status',
        type: 'select',
        options: ['pending', 'paid', 'failed', 'refunded']
      }
    ]
  }

};

// =====================================================
// 4. GENERAL HELPERS
// =====================================================

function showMessage(element, message, color = 'green') {
  if (!element) return;

  element.textContent = message;
  element.style.color = color;
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString();
}

function formatDateTimeInput(value) {
  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  );

  return localDate.toISOString().slice(0, 16);
}

// =====================================================
// 5. DASHBOARD STATISTICS
// =====================================================

async function loadOverviewCounts() {

  const tables = [
    ['student_applications', 'applicationCount'],
    ['students', 'studentCount'],
    ['teachers', 'teacherCount'],
    ['courses', 'courseCount']
  ];

  for (const [table, elementId] of tables) {

    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error(`Count error for ${table}:`, error);
      continue;
    }

    const element = document.getElementById(elementId);

    if (element) {
      element.textContent = count ?? 0;
    }
  }
}

// =====================================================
// 6. LOAD APPLICATIONS
// =====================================================

async function loadApplications() {

  applicationTableBody.innerHTML =
    '<tr><td colspan="8">Loading applications...</td></tr>';

  showMessage(applicationMessage, 'Loading applications...');

  const { data, error } = await supabase
    .from('student_applications')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {

    console.error('Application loading error:', error);

    applicationTableBody.innerHTML =
      '<tr><td colspan="8">Unable to load applications.</td></tr>';

    showMessage(applicationMessage, error.message, 'red');
    return;
  }

  allApplications = data || [];

  renderApplications(allApplications);

  showMessage(
    applicationMessage,
    `${allApplications.length} application(s) loaded successfully.`
  );

  document.getElementById('applicationCount').textContent =
    allApplications.length;
}

// =====================================================
// 7. DISPLAY APPLICATIONS
// =====================================================

function renderApplications(applications) {

  applicationTableBody.innerHTML = '';

  if (!applications.length) {

    applicationTableBody.innerHTML =
      '<tr><td colspan="8">No applications found.</td></tr>';

    return;
  }

  applications.forEach(application => {

    const row = document.createElement('tr');

    const values = [
      application.student_name,
      application.guardian_name,
      application.guardian_phone,
      application.course_interest,
      application.delivery_mode,
      application.status,
      formatDate(application.submitted_at)
    ];

    values.forEach(value => {

      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.appendChild(cell);

    });

    const actionCell = document.createElement('td');

    const viewButton = document.createElement('button');

    viewButton.className = 'action-button view-button';
    viewButton.textContent = 'View';
    viewButton.dataset.action = 'view-application';
    viewButton.dataset.id = application.id;

    actionCell.appendChild(viewButton);

    if (application.status === 'pending') {

      const approveButton = document.createElement('button');

      approveButton.className = 'action-button approve-button';
      approveButton.textContent = 'Approve';
      approveButton.dataset.action = 'approve';
      approveButton.dataset.id = application.id;

      const rejectButton = document.createElement('button');

      rejectButton.className = 'action-button reject-button';
      rejectButton.textContent = 'Reject';
      rejectButton.dataset.action = 'reject';
      rejectButton.dataset.id = application.id;

      actionCell.appendChild(approveButton);
      actionCell.appendChild(rejectButton);
    }

    row.appendChild(actionCell);
    applicationTableBody.appendChild(row);

  });
}

// =====================================================
// 8. APPLICATION SEARCH
// =====================================================

document.getElementById('applicationSearch')
  .addEventListener('input', event => {

    const term = event.target.value.toLowerCase().trim();

    const filtered = allApplications.filter(application => {

      const text = [
        application.student_name,
        application.guardian_name,
        application.guardian_phone,
        application.guardian_email,
        application.course_interest,
        application.status
      ].join(' ').toLowerCase();

      return text.includes(term);
    });

    renderApplications(filtered);
  });

// =====================================================
// 9. VIEW APPLICATION DETAILS
// =====================================================

function viewApplication(application) {

  const details = [
    ['Student', application.student_name],
    ['Date of Birth', application.date_of_birth],
    ['Guardian', application.guardian_name],
    ['Student Email', application.student_email],
    ['Guardian Email', application.guardian_email],
    ['Guardian Phone', application.guardian_phone],
    ['Relationship', application.relationship],
    ['Location', application.location],
    ['Programme', application.course_interest],
    ['Learning Mode', application.delivery_mode],
    ['Preferred Schedule', application.preferred_schedule],
    ['Additional Notes', application.additional_notes],
    ['Application Status', application.status]
  ];

  const content = details
    .map(([label, value]) => `${label}: ${value || '—'}`)
    .join('\n\n');

  alert(content);
}

// =====================================================
// 10. APPROVE OR REJECT APPLICATION
// =====================================================

applicationTableBody.addEventListener('click', async event => {

  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const action = button.dataset.action;
  const applicationId = button.dataset.id;

  const application = allApplications.find(
    item => item.id === applicationId
  );

  if (!application) return;

  if (action === 'view-application') {
    viewApplication(application);
    return;
  }

  const confirmation = confirm(
    action === 'approve'
      ? 'Approve this application and create a student record?'
      : 'Reject this application?'
  );

  if (!confirmation) return;

  button.disabled = true;

  showMessage(
    applicationMessage,
    action === 'approve'
      ? 'Approving application...'
      : 'Rejecting application...'
  );

  try {

    let error = null;
    let approvalStatusMessage = null;
    let approvalStatusColor = 'green';

    if (action === 'approve') {
      const result = await supabase.rpc('approve_student_application', {
        application_id: applicationId
      });
      error = result.error;
      if (!error && result.data?.student_id) {
        try {
          const invitation = await createOrLinkStudentPortal(result.data.student_id);
          approvalStatusMessage = `Application approved. ${invitation.message} Recipient: ${invitation.recipient_email || 'existing account'}.`;
        } catch (inviteError) {
          console.error('Student portal invitation error:', inviteError);
          approvalStatusMessage = `Application approved, but portal setup needs attention: ${inviteError.message}. Retry from the Students list.`;
          approvalStatusColor = '#a52b2b';
        }
      }
    } else {
      const result = await supabase
        .from('student_applications')
        .update({ status: 'rejected' })
        .eq('id', applicationId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();
      error = result.error;
      if (!error && !result.data) error = new Error('This application is no longer pending. Refresh the applications list.');
    }

    if (error) throw error;

    showMessage(
      applicationMessage,
      action === 'approve'
        ? 'Application approved and student record created.'
        : 'Application rejected successfully.'
    );

    await loadApplications();
    await loadStudents();
    await loadOverviewCounts();
    if (approvalStatusMessage) {
      showMessage(applicationMessage, approvalStatusMessage, approvalStatusColor);
    }

  } catch (error) {

    console.error('Application action error:', error);

    showMessage(applicationMessage, error.message, 'red');

    button.disabled = false;
  }
});

// =====================================================
// 11. LOAD STUDENTS
// =====================================================

async function loadStudents() {

  studentTableBody.innerHTML =
    '<tr><td colspan="8">Loading students...</td></tr>';

  showMessage(studentMessage, 'Loading student records...');

  const { data, error } = await supabase
    .from('students')
    .select(`
      id,
      student_name,
      date_of_birth,
      location,
      guardian_name,
      guardian_email,
      guardian_phone,
      relationship,
      course_interest,
      delivery_mode,
      preferred_schedule,
      additional_notes,
      status,
      student_email,
      profile_id,
      student_guardians(parent_id, is_primary, parents(id, profile_id, email)),
      created_at
    `)
    .order('created_at', { ascending: false });

  if (error) {

    console.error('Student loading error:', error);

    studentTableBody.innerHTML =
      '<tr><td colspan="8">Unable to load students.</td></tr>';

    showMessage(studentMessage, error.message, 'red');
    return;
  }

  allStudents = data || [];

  renderStudents(allStudents);

  const total = allStudents.length;

  const active = allStudents.filter(
    student => student.status === 'active'
  ).length;

  const inactive = allStudents.filter(
    student => student.status === 'inactive'
  ).length;

  document.getElementById('totalStudents').textContent = total;
  document.getElementById('activeStudents').textContent = active;
  document.getElementById('inactiveStudents').textContent = inactive;
  document.getElementById('studentCount').textContent = total;

  showMessage(
    studentMessage,
    `${total} student record(s) loaded successfully.`
  );
}

// =====================================================
// 12. DISPLAY STUDENTS
// =====================================================

function renderStudents(students) {

  studentTableBody.innerHTML = '';

  if (!students.length) {

    studentTableBody.innerHTML =
      '<tr><td colspan="8">No matching student records found.</td></tr>';

    return;
  }

  students.forEach(student => {

    const row = document.createElement('tr');

    const values = [
      student.student_name,
      student.guardian_name,
      student.guardian_phone,
      student.course_interest,
      student.delivery_mode,
      student.status,
      formatDate(student.created_at)
    ];

    values.forEach(value => {

      const cell = document.createElement('td');
      cell.textContent = value || '—';
      row.appendChild(cell);

    });

    const actionCell = document.createElement('td');

    const viewButton = document.createElement('button');

    viewButton.className = 'action-button view-button';
    viewButton.textContent = 'View Details';
    viewButton.dataset.action = 'view-student';
    viewButton.dataset.id = student.id;

    actionCell.appendChild(viewButton);

    const primaryGuardian = (student.student_guardians || []).find(link => link.is_primary) || (student.student_guardians || [])[0];
    const guardianProfileId = primaryGuardian?.parents?.profile_id || null;
    const hasPortalLogin = Boolean(student.profile_id || guardianProfileId);
    const loginButton = document.createElement('button');
    loginButton.className = 'action-button approve-button';
    loginButton.textContent = hasPortalLogin ? 'Link / Check Portal' : 'Create Portal Login';
    loginButton.dataset.action = 'send-login';
    loginButton.dataset.id = student.id;
    actionCell.appendChild(loginButton);

    const statusButton = document.createElement('button');
    statusButton.className = student.status === 'inactive'
      ? 'action-button approve-button'
      : 'action-button edit-button';
    statusButton.textContent = student.status === 'inactive' ? 'Reactivate Student' : 'Make Inactive';
    statusButton.dataset.action = student.status === 'inactive' ? 'student-reactivate' : 'student-deactivate';
    statusButton.dataset.id = student.id;
    actionCell.appendChild(statusButton);

    if (hasPortalLogin) {
      const deleteLoginButton = document.createElement('button');
      deleteLoginButton.className = 'action-button delete-button';
      deleteLoginButton.textContent = 'Delete Login';
      deleteLoginButton.dataset.action = 'account-delete-login';
      deleteLoginButton.dataset.id = student.id;
      actionCell.appendChild(deleteLoginButton);
    }

    const deleteStudentButton = document.createElement('button');
    deleteStudentButton.className = 'action-button delete-button';
    deleteStudentButton.textContent = 'Delete Student';
    deleteStudentButton.dataset.action = 'delete-student';
    deleteStudentButton.dataset.id = student.id;
    actionCell.appendChild(deleteStudentButton);

    row.appendChild(actionCell);
    studentTableBody.appendChild(row);

  });
}

// =====================================================
// 13. SEARCH STUDENTS
// =====================================================

studentSearch.addEventListener('input', event => {

  const term = event.target.value.toLowerCase().trim();

  const filtered = allStudents.filter(student => {

    const text = [
      student.student_name,
      student.guardian_name,
      student.guardian_phone,
      student.guardian_email,
      student.student_email,
      student.course_interest
    ].join(' ').toLowerCase();

    return text.includes(term);
  });

  renderStudents(filtered);

  showMessage(
    studentMessage,
    `${filtered.length} matching student(s) found.`
  );
});

// =====================================================
// 14. VIEW STUDENT PROFILE
// =====================================================

function openStudentProfile(student) {

  const fields = {
    profileStudentName: student.student_name,
    profileDateOfBirth: formatDate(student.date_of_birth),
    profileLocation: student.location,
    profileGuardianName: student.guardian_name,
    profileGuardianEmail: student.guardian_email,
    profileGuardianPhone: student.guardian_phone,
    profileRelationship: student.relationship,
    profileProgramme: student.course_interest,
    profileLearningMode: student.delivery_mode,
    profileSchedule: student.preferred_schedule,
    profileNotes: student.additional_notes,
    profileStatus: student.status,
    profileRegistrationDate: formatDate(student.created_at)
  };

  Object.entries(fields).forEach(([id, value]) => {

    const element = document.getElementById(id);

    if (element) {
      element.textContent = value || '—';
    }
  });

  studentProfileModal.style.display = 'block';
}

async function managePortalAccount(entityType, recordId, action) {
  const { data, error } = await supabase.functions.invoke('manage-portal-account', {
    body: { entity_type: entityType, record_id: recordId, action }
  });
  if (error) {
    let details = {};
    try { if (error.context?.json) details = await error.context.json(); } catch (_) {}
    throw new Error(details.error || error.message || 'Account action failed.');
  }
  if (!data?.success) throw new Error(data?.error || 'Account action was not confirmed.');
  return data;
}

async function manageStudentRecord(action, studentId = null) {
  const { data, error } = await supabase.functions.invoke('manage-student-records', {
    body: { action, student_id: studentId }
  });
  if (error) {
    let details = {};
    try { if (error.context?.json) details = await error.context.json(); } catch (_) {}
    throw new Error(details.error || error.message || 'Student management action failed.');
  }
  if (!data?.success) throw new Error(data?.error || 'Student management action was not confirmed.');
  return data;
}

async function createOrLinkStudentPortal(studentId) {
  const invoke = () => supabase.functions.invoke('provision-student-login', {
    body: { student_id: studentId }
  });

  let { data, error } = await invoke();
  if (error) {
    let details = {};
    try {
      if (error.context && typeof error.context.json === 'function') {
        details = await error.context.json();
      }
    } catch (_) {}
    if (details.needs_email) {
      const label = details.account_role === 'parent' ? 'parent/guardian email address' : 'adult student email address';
      const enteredEmail = prompt(`Enter the ${label}:`);
      if (!enteredEmail || !enteredEmail.trim()) throw new Error('No email address was entered. The student record was not changed.');
      const column = details.account_role === 'parent' ? 'guardian_email' : 'student_email';
      const { error: updateError } = await supabase.from('students')
        .update({ [column]: enteredEmail.trim() }).eq('id', studentId);
      if (updateError) throw updateError;
      ({ data, error } = await invoke());
      if (error) {
        let retryDetails = {};
        try { if (error.context?.json) retryDetails = await error.context.json(); } catch (_) {}
        throw new Error(retryDetails.error || error.message || 'Portal invitation failed.');
      }
    } else {
      throw new Error(details.error || error.message || 'Portal invitation failed.');
    }
  }
  if (!data?.success) throw new Error(data?.error || 'Portal account setup was not confirmed.');
  return data;
}

studentTableBody.addEventListener('click', async event => {

  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const student = allStudents.find(item => item.id === button.dataset.id);
  if (!student) return;

  if (button.dataset.action === 'view-student') {
    openStudentProfile(student);
    return;
  }

  if (button.dataset.action === 'student-deactivate' ||
      button.dataset.action === 'student-reactivate') {
    const action = button.dataset.action === 'student-deactivate' ? 'deactivate' : 'reactivate';
    const promptText = action === 'deactivate'
      ? 'Make ' + student.student_name + ' inactive? Their record and learning history will be kept.'
      : 'Reactivate ' + student.student_name + '?';
    if (!confirm(promptText)) return;
    button.disabled = true;
    showMessage(studentMessage, 'Updating student status...');
    try {
      const result = await manageStudentRecord(action, student.id);
      await loadStudents();
      await loadOverviewCounts();
      showMessage(studentMessage, result.message);
    } catch (error) {
      showMessage(studentMessage, error.message, 'red');
      button.disabled = false;
    }
    return;
  }

  if (button.dataset.action === 'delete-student') {
    const warning = 'Permanently delete the student record for ' + student.student_name +
      '? This cannot be undone. Any linked portal login must be removed first, and records with attendance, enrolments, assessments or payments will be protected.';
    if (!confirm(warning)) return;
    button.disabled = true;
    showMessage(studentMessage, 'Deleting student record...');
    try {
      const result = await manageStudentRecord('delete_student', student.id);
      await loadStudents();
      await loadOverviewCounts();
      showMessage(studentMessage, result.message);
    } catch (error) {
      showMessage(studentMessage, error.message, 'red');
      button.disabled = false;
    }
    return;
  }

  if (button.dataset.action === 'account-deactivate' ||
      button.dataset.action === 'account-reactivate' ||
      button.dataset.action === 'account-delete-login') {
    const action = button.dataset.action === 'account-deactivate' ? 'deactivate'
      : button.dataset.action === 'account-reactivate' ? 'reactivate' : 'delete_login';
    const warning = action === 'delete_login'
      ? 'Permanently delete this portal login and its profile link? The student record and learning/payment history will remain. If this is a parent login, other linked children may also lose access.'
      : action === 'deactivate'
        ? 'Deactivate this portal login? The person and all learning/history records will remain.'
        : 'Reactivate this portal login?';
    if (!confirm(warning)) return;
    button.disabled = true;
    showMessage(studentMessage, 'Updating portal account...');
    try {
      const result = await managePortalAccount('student', student.id, action);
      await loadStudents();
      showMessage(studentMessage, result.message + (result.email ? ' Email: ' + result.email : '') +
        (result.linked_children > 1 ? ' This parent login was linked to ' + result.linked_children + ' children.' : ''));
    } catch (error) {
      showMessage(studentMessage, error.message, 'red');
      button.disabled = false;
    }
    return;
  }

  if (button.dataset.action === 'send-login') {
    button.disabled = true;
    showMessage(studentMessage, 'Creating or linking the secure portal account...');
    try {
      const result = await createOrLinkStudentPortal(student.id);
      const portalStatus = `${result.message} Recipient: ${result.recipient_email || 'existing account'}.`;
      await loadStudents();
      showMessage(studentMessage, portalStatus);
    } catch (error) {
      console.error('Portal account setup error:', error);
      showMessage(studentMessage, error.message, 'red');
      button.disabled = false;
    }
  }
});

const refreshStudentsButton = document.getElementById('refreshStudentsButton');
const clearAllStudentsButton = document.getElementById('clearAllStudentsButton');

refreshStudentsButton?.addEventListener('click', async () => {
  refreshStudentsButton.disabled = true;
  try {
    await loadStudents();
    await loadOverviewCounts();
    showMessage(studentMessage, 'Student list refreshed from the database.');
  } finally {
    refreshStudentsButton.disabled = false;
  }
});

clearAllStudentsButton?.addEventListener('click', async () => {
  if (!allStudents.length) {
    showMessage(studentMessage, 'There are no student records to clear.');
    return;
  }
  const typed = prompt(
    'This will permanently delete all ' + allStudents.length +
    ' student records that have no linked portal login or academic/financial history. Type DELETE ALL STUDENTS to continue:'
  );
  if (typed !== 'DELETE ALL STUDENTS') {
    if (typed !== null) showMessage(studentMessage, 'Confirmation did not match. No records were deleted.', 'red');
    return;
  }
  if (!confirm('Final confirmation: permanently clear the eligible student records? This cannot be undone.')) return;

  clearAllStudentsButton.disabled = true;
  showMessage(studentMessage, 'Checking records and clearing eligible students...');
  try {
    const result = await manageStudentRecord('delete_all');
    studentSearch.value = '';
    await loadStudents();
    await loadOverviewCounts();
    showMessage(studentMessage, result.message);
  } catch (error) {
    showMessage(studentMessage, error.message, 'red');
  } finally {
    clearAllStudentsButton.disabled = false;
  }
});

// =====================================================
// 15. LOAD RESOURCE TABLES
// =====================================================

const resourceData = {};

async function loadResource(resourceName) {

  const config = resources[resourceName];

  const tbody = document.getElementById(
    `${resourceName}TableBody`
  );

  const message = document.getElementById(
    `${resourceName}Message`
  );

  if (!config || !tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="10">Loading records...</td></tr>';

  const { data, error } = await supabase
    .from(config.table)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {

    console.error(`${resourceName} loading error:`, error);

    tbody.innerHTML =
      '<tr><td colspan="10">Unable to load records.</td></tr>';

    showMessage(message, error.message, 'red');
    return;
  }

  resourceData[resourceName] = data || [];

  renderResource(resourceName, resourceData[resourceName]);

  showMessage(
    message,
    `${resourceData[resourceName].length} record(s) loaded successfully.`
  );

  if (resourceName === 'courses') {
    document.getElementById('courseCount').textContent = data.length;
  }

  if (resourceName === 'teachers') {
    document.getElementById('teacherCount').textContent = data.length;
  }

  if (resourceName === 'payments') {
    updatePaymentStatistics(data);
  }
}

// =====================================================
// 16. DISPLAY RESOURCE RECORDS
// =====================================================

function renderResource(resourceName, records) {

  const config = resources[resourceName];

  const tbody = document.getElementById(
    `${resourceName}TableBody`
  );

  tbody.innerHTML = '';

  if (!records.length) {

    const row = document.createElement('tr');
    const cell = document.createElement('td');

    cell.colSpan = config.columns.length + 1;
    cell.textContent = 'No records found.';

    row.appendChild(cell);
    tbody.appendChild(row);

    return;
  }

  records.forEach(record => {

    const row = document.createElement('tr');

    config.columns.forEach(([field]) => {

      const cell = document.createElement('td');

      let value = record[field];

      if (field === 'payment_date' || field === 'reviewed_at' || field === 'lesson_date') {
        value = value ? new Date(value).toLocaleString() : '—';
      }

      if (field === 'fee' || field === 'amount') {
        value = value == null
          ? '—'
          : Number(value).toLocaleString();
      }

      if (field === 'duration_minutes' && value != null) {
        value = `${value} minutes`;
      }

      if (field === 'receipt_url' && typeof value === 'string' && /^https:\/\//i.test(value)) {
        const link = document.createElement('a'); link.href = value; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'View proof'; cell.appendChild(link);
      } else { cell.textContent = value ?? '—'; }

      row.appendChild(cell);
    });

    const actionCell = document.createElement('td');

    const editButton = document.createElement('button');

    editButton.className = 'action-button edit-button';
    editButton.textContent = 'Edit';
    editButton.dataset.action = 'edit';
    editButton.dataset.id = record.id;
    editButton.dataset.resource = resourceName;

    const deleteButton = document.createElement('button');

    deleteButton.className = 'action-button delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.dataset.action = 'delete';
    deleteButton.dataset.id = record.id;
    deleteButton.dataset.resource = resourceName;

    actionCell.appendChild(editButton);
    if (resourceName === 'teachers' && record.profile_id) {
      const accessButton = document.createElement('button');
      accessButton.className = 'action-button edit-button';
      accessButton.textContent = record.status === 'inactive' ? 'Reactivate' : 'Deactivate';
      accessButton.dataset.action = record.status === 'inactive' ? 'account-reactivate' : 'account-deactivate';
      accessButton.dataset.id = record.id;
      accessButton.dataset.resource = resourceName;
      actionCell.appendChild(accessButton);

      const deleteLoginButton = document.createElement('button');
      deleteLoginButton.className = 'action-button delete-button';
      deleteLoginButton.textContent = 'Delete Login';
      deleteLoginButton.dataset.action = 'account-delete-login';
      deleteLoginButton.dataset.id = record.id;
      deleteLoginButton.dataset.resource = resourceName;
      actionCell.appendChild(deleteLoginButton);
    }
    if (resourceName === 'payments' && record.status === 'pending' && record.payment_method === 'Bank Transfer') {
      const reviewButton = document.createElement('button');
      reviewButton.className = 'action-button edit-button';
      reviewButton.textContent = 'Review';
      reviewButton.dataset.action = 'review-payment';
      reviewButton.dataset.id = record.id;
      reviewButton.dataset.resource = resourceName;
      actionCell.appendChild(reviewButton);
    }
    actionCell.appendChild(deleteButton);

    row.appendChild(actionCell);
    tbody.appendChild(row);
  });
}

// =====================================================
// 17. PAYMENT STATISTICS
// =====================================================

function updatePaymentStatistics(payments) {

  const successful = payments.filter(
    payment => payment.status === 'paid'
  );

  const nairaPayments = successful.filter(
    payment => payment.currency === 'NGN'
  );

  const total = nairaPayments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0
  );

  document.getElementById('paymentCount').textContent =
    payments.length;

  document.getElementById('successfulPaymentCount').textContent =
    successful.length;

  document.getElementById('paymentTotal').textContent =
    `₦${total.toLocaleString()}`;
}

// =====================================================
// 18. RESOURCE SEARCH
// =====================================================

Object.keys(resources).forEach(resourceName => {

  const search = document.getElementById(
    `${resourceName}Search`
  );

  if (!search) return;

  search.addEventListener('input', event => {

    const term = event.target.value.toLowerCase().trim();

    const records = resourceData[resourceName] || [];

    const filtered = records.filter(record => {

      const text = Object.values(record)
        .join(' ')
        .toLowerCase();

      return text.includes(term);
    });

    renderResource(resourceName, filtered);
  });
});

// =====================================================
// 19. OPEN ADD RECORD FORM
// =====================================================

document.querySelectorAll('.add-record').forEach(button => {

  button.addEventListener('click', () => {

    openRecordForm(button.dataset.resource);

  });
});

// =====================================================
// 20. BUILD RECORD FORM
// =====================================================

function openRecordForm(resourceName, record = null) {

  const config = resources[resourceName];

  if (!config) return;

  currentResource = resourceName;
  editingRecordId = record?.id || null;

  recordModalTitle.textContent =
    `${editingRecordId ? 'Edit' : 'Add'} ${config.title}`;

  recordFormFields.innerHTML = '';
  recordFormMessage.textContent = '';

  config.fields.forEach(field => {

    const wrapper = document.createElement('div');

    wrapper.className =
      `form-field ${field.type === 'textarea' ? 'full' : ''}`;

    const label = document.createElement('label');

    label.textContent = field.label;
    label.htmlFor = `field-${field.name}`;

    let input;

    if (field.type === 'textarea') {

      input = document.createElement('textarea');

    } else if (field.type === 'select') {

      input = document.createElement('select');

      field.options.forEach(optionValue => {

        const option = document.createElement('option');

        option.value = optionValue;
        option.textContent = optionValue;

        input.appendChild(option);

      });

    } else {

      input = document.createElement('input');
      input.type = field.type || 'text';

    }

    input.id = `field-${field.name}`;
    input.name = field.name;
    input.required = Boolean(field.required);

    let fieldValue = record?.[field.name] ?? '';

    if (field.type === 'datetime-local' && fieldValue) {
      fieldValue = formatDateTimeInput(fieldValue);
    }

    if (field.type === 'date' && fieldValue) {
      fieldValue = String(fieldValue).slice(0, 10);
    }

    input.value = fieldValue;

    if (field.type === 'number') {
      input.step = 'any';
      input.min = '0';
    }

    wrapper.appendChild(label);
    wrapper.appendChild(input);

    recordFormFields.appendChild(wrapper);

  });

  saveRecordButton.disabled = false;
  saveRecordButton.textContent = 'Save Record';

  recordModal.style.display = 'block';
}

// =====================================================
// 21. SAVE NEW OR EDITED RECORD
// =====================================================

recordForm.addEventListener('submit', async event => {

  event.preventDefault();

  const config = resources[currentResource];

  if (!config) return;

  const formData = new FormData(recordForm);

  const record = {};

  config.fields.forEach(field => {

    let value = formData.get(field.name);

    if (value === '') {
      value = null;
    }

    if (value !== null && field.type === 'number') {
      value = Number(value);
    }

    record[field.name] = value;
  });

  saveRecordButton.disabled = true;
  saveRecordButton.textContent = 'Saving...';

  try {

    let result;

    if (editingRecordId) {

      result = await supabase
        .from(config.table)
        .update(record)
        .eq('id', editingRecordId);

    } else {

      result = await supabase
        .from(config.table)
        .insert(record);

    }

    if (result.error) throw result.error;

    recordModal.style.display = 'none';
    recordForm.reset();

    await loadResource(currentResource);
    await loadOverviewCounts();

  } catch (error) {

    console.error('Record saving error:', error);

    showMessage(recordFormMessage, error.message, 'red');

    saveRecordButton.disabled = false;
    saveRecordButton.textContent = 'Save Record';
  }
});

// =====================================================
// 22. EDIT AND DELETE RESOURCE RECORDS
// =====================================================

document.addEventListener('click', async event => {

  const button = event.target.closest(
    'button[data-resource][data-action]'
  );

  if (!button) return;

  const resourceName = button.dataset.resource;
  const action = button.dataset.action;
  const recordId = button.dataset.id;

  const record = (resourceData[resourceName] || []).find(
    item => item.id === recordId
  );

  if (!record) return;

  if (resourceName === 'teachers' && action.startsWith('account-')) {
    const accountAction = action === 'account-deactivate' ? 'deactivate'
      : action === 'account-reactivate' ? 'reactivate' : 'delete_login';
    const warning = accountAction === 'delete_login'
      ? 'Permanently delete this teacher portal login? The teacher record and historical learning/payment records will remain.'
      : accountAction === 'deactivate'
        ? 'Deactivate this teacher portal login?'
        : 'Reactivate this teacher portal login?';
    if (!confirm(warning)) return;
    button.disabled = true;
    try {
      const result = await managePortalAccount('teacher', recordId, accountAction);
      await loadResource('teachers');
      showMessage(document.getElementById('teachersMessage'), result.message + (result.email ? ' Email: ' + result.email : ''));
    } catch (error) {
      showMessage(document.getElementById('teachersMessage'), error.message, 'red');
      button.disabled = false;
    }
    return;
  }

  if (action === 'review-payment') {
    const decision = prompt('Enter PAID to confirm funds received, or REJECTED to reject this transfer.');
    if (!decision) return;
    const normalized = decision.trim().toUpperCase();
    if (!['PAID', 'REJECTED'].includes(normalized)) { alert('Enter PAID or REJECTED only.'); return; }
    const note = prompt('Optional review note for the learner:') || '';
    button.disabled = true;
    const now = new Date().toISOString();
    const update = {
      status: normalized === 'PAID' ? 'paid' : 'failed',
      reviewed_at: now, reviewed_by: adminUserId, review_note: note.trim(),
      payment_date: normalized === 'PAID' ? now : record.payment_date,
      paid_at: normalized === 'PAID' ? now : null
    };
    const { error } = await supabase.from('payments').update(update).eq('id', recordId).eq('status', 'pending');
    if (error) { alert(`Unable to review payment: ${error.message}`); button.disabled = false; return; }
    await loadResource('payments');
    return;
  }

  if (action === 'edit') {
    openRecordForm(resourceName, record);
    return;
  }

  if (action === 'delete') {

    const confirmed = confirm(
      `Are you sure you want to delete this ${resources[resourceName].title.toLowerCase()} record?`
    );

    if (!confirmed) return;

    button.disabled = true;

    const { error } = await supabase
      .from(resources[resourceName].table)
      .delete()
      .eq('id', recordId);

    if (error) {

      console.error('Record deletion error:', error);

      alert(`Unable to delete record: ${error.message}`);

      button.disabled = false;
      return;
    }

    await loadResource(resourceName);
    await loadOverviewCounts();
  }
});

// =====================================================
// 23. CLOSE MODALS
// =====================================================

document.querySelectorAll('[data-close]').forEach(button => {

  button.addEventListener('click', () => {

    const modal = document.getElementById(
      button.dataset.close
    );

    if (modal) {
      modal.style.display = 'none';
    }
  });
});

document.querySelectorAll('.modal').forEach(modal => {

  modal.addEventListener('click', event => {

    if (event.target === modal) {
      modal.style.display = 'none';
    }
  });
});

// =====================================================
// 24. STUDENT ENROLMENTS
// =====================================================

async function loadEnrollments() {

  const tbody = document.getElementById('enrolmentTableBody');
  const message = document.getElementById('enrolmentMessage');

  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="8">Loading enrolments...</td></tr>';

  try {

    const [
      { data: students, error: studentError },
      { data: courses, error: courseError },
      { data: teachers, error: teacherError },
      { data: enrolments, error: enrolmentError }
    ] = await Promise.all([

      supabase
        .from('students')
        .select('id, student_name')
        .order('student_name'),

      supabase
        .from('courses')
        .select('id, name, status, fee')
        .eq('status', 'active')
        .order('name'),

      supabase
        .from('teachers')
        .select('id, full_name, status')
        .order('full_name'),

      supabase
        .from('enrollments')
        .select('id, student_id, course_id, teacher_id, start_date, status, tuition_fee, currency')
        .order('start_date', { ascending: false })

    ]);

    if (studentError) throw studentError;
    if (courseError) throw courseError;
    if (teacherError) throw teacherError;
    if (enrolmentError) throw enrolmentError;

    const studentSelect =
      document.getElementById('enrolmentStudent');

    const courseSelect =
      document.getElementById('enrolmentCourse');
    const teacherSelect =
      document.getElementById('enrolmentTeacher');
    const feeInput = document.getElementById('enrolmentFee');

    studentSelect.replaceChildren();
    courseSelect.replaceChildren();
    teacherSelect.replaceChildren();

    const studentPlaceholder = document.createElement('option');
    studentPlaceholder.value = '';
    studentPlaceholder.textContent = 'Select Student';
    studentPlaceholder.disabled = true;
    studentPlaceholder.selected = true;
    studentSelect.appendChild(studentPlaceholder);

    (students || []).forEach(student => {

      const option = document.createElement('option');

      option.value = student.id;
      option.textContent =
        student.student_name || 'Unnamed Student';

      studentSelect.appendChild(option);
    });

    const coursePlaceholder = document.createElement('option');
    coursePlaceholder.value = '';
    coursePlaceholder.textContent = 'Select Course';
    coursePlaceholder.disabled = true;
    coursePlaceholder.selected = true;
    courseSelect.appendChild(coursePlaceholder);

    const teacherPlaceholder = document.createElement('option');
    teacherPlaceholder.value = '';
    teacherPlaceholder.textContent = 'Select Teacher';
    teacherPlaceholder.disabled = true;
    teacherPlaceholder.selected = true;
    teacherSelect.appendChild(teacherPlaceholder);

    (teachers || []).filter(teacher => teacher.status === 'active').forEach(teacher => {
      const option = document.createElement('option');
      option.value = teacher.id;
      option.textContent = teacher.full_name || 'Unnamed Teacher';
      teacherSelect.appendChild(option);
    });

    (courses || []).forEach(course => {

      const option = document.createElement('option');

      option.value = course.id;
      option.textContent = course.name;
      option.dataset.fee = course.fee ?? '';

      courseSelect.appendChild(option);
    });

    const setDefaultEnrolmentFee = () => {
      const selected = courseSelect.options[courseSelect.selectedIndex];
      feeInput.value = selected && selected.value ? (selected.dataset.fee || '') : '';
    };
    courseSelect.onchange = setDefaultEnrolmentFee;
    setDefaultEnrolmentFee();

    const studentNames = new Map(
      (students || []).map(student => [
        student.id,
        student.student_name || 'Unnamed Student'
      ])
    );

    const courseNames = new Map(
      (courses || []).map(course => [course.id, course.name])
    );
    const teacherNames = new Map(
      (teachers || []).map(teacher => [teacher.id, teacher.full_name || 'Unnamed Teacher'])
    );

    tbody.replaceChildren();

    if (!enrolments || enrolments.length === 0) {

      const row = tbody.insertRow();
      const cell = row.insertCell();

      cell.colSpan = 8;
      cell.textContent = 'No course enrolments yet.';

    } else {

      enrolments.forEach(enrolment => {

        const row = tbody.insertRow();

        const values = [
          enrolment.id,
          studentNames.get(enrolment.student_id) ||
            'Student record unavailable',

          courseNames.get(enrolment.course_id) ||
            'Course record unavailable',

          teacherNames.get(enrolment.teacher_id) || 'Teacher not assigned',
          formatDate(enrolment.start_date),

          `${enrolment.currency || 'NGN'} ${Number(enrolment.tuition_fee || 0).toLocaleString()}`,
          enrolment.status
        ];

        values.forEach(value => {

          const cell = row.insertCell();
          cell.textContent = value || '—';

        });

        const actionCell = row.insertCell();

        const removeButton =
          document.createElement('button');

        removeButton.className =
          'action-button reject-button';

        removeButton.textContent = 'Remove';

        removeButton.addEventListener('click', async () => {

          if (!confirm('Remove this course enrolment?')) {
            return;
          }

          removeButton.disabled = true;

          const { error } = await supabase
            .from('enrollments')
            .delete()
            .eq('id', enrolment.id);

          if (error) {

            showMessage(message, error.message, 'red');
            removeButton.disabled = false;
            return;
          }

          showMessage(
            message,
            'Enrolment removed successfully.'
          );

          await loadEnrollments();
          await loadOverviewCounts();

        });

        actionCell.appendChild(removeButton);

      });
    }

    showMessage(
      message,
      `${enrolments.length} enrolment(s) loaded successfully.`
    );

  } catch (error) {

    console.error('Enrolment loading error:', error);

    tbody.innerHTML =
      '<tr><td colspan="8">Unable to load enrolments.</td></tr>';

    showMessage(message, error.message, 'red');

  }
}

// =====================================================
// ASSIGN STUDENT TO COURSE
// =====================================================

const enrolmentForm =
  document.getElementById('enrolmentForm');

if (enrolmentForm) {

  enrolmentForm.addEventListener('submit', async event => {

    event.preventDefault();

    const button =
      document.getElementById('saveEnrolmentButton');

    const message =
      document.getElementById('enrolmentMessage');

    button.disabled = true;
    button.textContent = 'Processing...';

    try {

      const studentId =
        document.getElementById('enrolmentStudent').value;

      const courseId =
        document.getElementById('enrolmentCourse').value;
      const teacherId =
        document.getElementById('enrolmentTeacher').value;

      const status =
        document.getElementById('enrolmentStatus').value;
      const tuitionFee = Number(document.getElementById('enrolmentFee').value);

      if (!studentId || !courseId || !teacherId) {
        throw new Error('Please select a student, course and assigned teacher.');
      }
      if (!Number.isFinite(tuitionFee) || tuitionFee < 0) {
        throw new Error('Enter a valid tuition fee in NGN.');
      }

      const { data: existing, error: lookupError } =
        await supabase
          .from('enrollments')
          .select('id')
          .eq('student_id', studentId)
          .eq('course_id', courseId)
          .limit(1);

      if (lookupError) throw lookupError;

      let result;

      if (existing && existing.length > 0) {

        result = await supabase
          .from('enrollments')
          .update({
            status: status,
            teacher_id: teacherId,
            tuition_fee: tuitionFee,
            currency: 'NGN'
          })
          .eq('id', existing[0].id);

      } else {

        const today = new Date();

        const startDate = [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, '0'),
          String(today.getDate()).padStart(2, '0')
        ].join('-');

        result = await supabase
          .from('enrollments')
          .insert({
            student_id: studentId,
            course_id: courseId,
            status: status,
            teacher_id: teacherId,
            start_date: startDate,
            tuition_fee: tuitionFee,
            currency: 'NGN'
          });
      }

      if (result.error) throw result.error;

      showMessage(
        message,
        'Student successfully assigned to the course.'
      );

      enrolmentForm.reset();

      await loadEnrollments();
      await loadOverviewCounts();

    } catch (error) {

      console.error('Enrolment submission error:', error);

      showMessage(message, error.message, 'red');

    } finally {

      button.disabled = false;
      button.textContent = 'Assign Course';

    }
  });
}

async function loadBankInstructions() {
  const message = document.getElementById('bankInstructionsMessage');
  const { data, error } = await supabase.from('payment_instructions').select('*').eq('id', true).maybeSingle();
  if (error) { showMessage(message, error.message, 'red'); return; }
  if (!data) return;
  document.getElementById('bankName').value = data.bank_name || '';
  document.getElementById('bankAccountName').value = data.account_name || '';
  document.getElementById('bankAccountNumber').value = data.account_number || '';
  document.getElementById('bankAccountType').value = data.account_type || '';
  document.getElementById('bankInstructionsText').value = data.instructions || '';
  document.getElementById('bankInstructionsActive').checked = data.is_active === true;
  showMessage(message, data.is_active ? 'Instructions are currently visible to learners.' : 'Instructions are saved but hidden from learners.');
}

document.getElementById('bankInstructionsForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const payload = {
      bank_name: document.getElementById('bankName').value.trim(),
      account_name: document.getElementById('bankAccountName').value.trim(),
      account_number: document.getElementById('bankAccountNumber').value.trim(),
      account_type: document.getElementById('bankAccountType').value.trim(),
      instructions: document.getElementById('bankInstructionsText').value.trim(),
      is_active: document.getElementById('bankInstructionsActive').checked,
      updated_at: new Date().toISOString(), updated_by: adminUserId
    };
    if (!payload.bank_name || !payload.account_name || !payload.account_number) throw new Error('Complete the bank name, account name and account number.');
    const { error } = await supabase.from('payment_instructions').upsert({ id: true, ...payload }, { onConflict: 'id' });
    if (error) throw error;
    showMessage(document.getElementById('bankInstructionsMessage'), payload.is_active ? 'Saved. Bank transfer is now visible to learners.' : 'Saved. Bank transfer remains hidden from learners.');
  } catch (error) { showMessage(document.getElementById('bankInstructionsMessage'), error.message, 'red'); }
  finally { button.disabled = false; }
});

// =====================================================
// ADMIN LEARNING RECORDS: ATTENDANCE AND ASSESSMENTS
// =====================================================

async function loadLearningRecords() {
  const attendanceBody = document.getElementById('attendanceAdminTableBody');
  const assessmentBody = document.getElementById('assessmentAdminTableBody');
  const message = document.getElementById('learningRecordsMessage');
  attendanceBody.innerHTML = '<tr><td colspan="5">Loading attendance...</td></tr>';
  assessmentBody.innerHTML = '<tr><td colspan="6">Loading assessments...</td></tr>';

  try {
    const [attendanceResult, assessmentResult, studentResult, teacherResult] = await Promise.all([
      supabase.from('attendance').select('id, schedule_id, student_id, lesson_date, status, notes').order('lesson_date', { ascending: false }),
      supabase.from('assessments').select('id, student_id, teacher_id, title, score, maximum_score, feedback, assessed_at').order('assessed_at', { ascending: false }),
      supabase.from('students').select('id, student_name'),
      supabase.from('teachers').select('id, full_name')
    ]);
    if (attendanceResult.error) throw attendanceResult.error;
    if (assessmentResult.error) throw assessmentResult.error;
    if (studentResult.error) throw studentResult.error;
    if (teacherResult.error) throw teacherResult.error;

    const students = new Map((studentResult.data || []).map(row => [row.id, row.student_name || 'Student']));
    const teachers = new Map((teacherResult.data || []).map(row => [row.id, row.full_name || 'Teacher']));

    attendanceBody.replaceChildren();
    if (!attendanceResult.data?.length) {
      const row = attendanceBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 5; cell.textContent = 'No attendance records yet.';
    } else attendanceResult.data.forEach(record => {
      const row = attendanceBody.insertRow();
      [students.get(record.student_id) || 'Student unavailable', formatDate(record.lesson_date), record.status || '—', record.schedule_id || '—', record.notes || '—'].forEach(value => { const cell = row.insertCell(); cell.textContent = value; });
    });

    assessmentBody.replaceChildren();
    if (!assessmentResult.data?.length) {
      const row = assessmentBody.insertRow(); const cell = row.insertCell(); cell.colSpan = 6; cell.textContent = 'No assessment records yet.';
    } else assessmentResult.data.forEach(record => {
      const row = assessmentBody.insertRow();
      [students.get(record.student_id) || 'Student unavailable', teachers.get(record.teacher_id) || 'Teacher unavailable', record.title || '—', `${record.score ?? '—'} / ${record.maximum_score ?? '—'}`, formatDate(record.assessed_at), record.feedback || '—'].forEach(value => { const cell = row.insertCell(); cell.textContent = value; });
    });
    showMessage(message, `${attendanceResult.data?.length || 0} attendance record(s) and ${assessmentResult.data?.length || 0} assessment(s) loaded.`);
  } catch (error) {
    console.error('Learning records error:', error);
    showMessage(message, error.message || 'Unable to load learning records.', 'red');
    attendanceBody.innerHTML = '<tr><td colspan="5">Unable to load attendance.</td></tr>';
    assessmentBody.innerHTML = '<tr><td colspan="6">Unable to load assessments.</td></tr>';
  }
}

// =====================================================
// 25. SIDEBAR NAVIGATION
// =====================================================

const navigationButtons =
  document.querySelectorAll('.nav-button');

const sections =
  document.querySelectorAll('.section');

navigationButtons.forEach(button => {

  button.addEventListener('click', async () => {

    const sectionId = button.dataset.section;

    navigationButtons.forEach(item => {
      item.classList.remove('active');
    });

    sections.forEach(section => {
      section.classList.remove('active');
    });

    button.classList.add('active');

    const targetSection = document.getElementById(sectionId);

    if (!targetSection) return;

    targetSection.classList.add('active');

    if (sectionId === 'applications') {
      await loadApplications();
    }

    if (sectionId === 'students') {
      await loadStudents();
    }

    if (resources[sectionId]) {
      await loadResource(sectionId);
      if (sectionId === 'payments') await loadBankInstructions();
    }

    if (sectionId === 'enrolments') {
      await loadEnrollments();
    }

    if (sectionId === 'learning-records') {
      await loadLearningRecords();
    }

  });
});

// =====================================================
// 26. VERIFY ADMINISTRATOR ACCESS
// =====================================================

async function verifyAdminAccess() {

  try {

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!sessionData.session) {
      window.location.replace('admin.html');
      return;
    }

    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    if (!userData.user) {
      window.location.replace('admin.html');
      return;
    }
    adminUserId = userData.user.id;

    const { data: profile, error: profileError } =
      await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();

    if (profileError) throw profileError;

    if (profile.role !== 'admin') {

      await supabase.auth.signOut();

      window.location.replace('admin.html');
      return;
    }

    accessMessage.hidden = true;
    dashboard.hidden = false;

    await loadOverviewCounts();
    await loadApplications();
    await loadStudents();

  } catch (error) {

    console.error('Administrator verification error:', error);

    accessMessage.textContent =
      'Administrator access could not be verified. Please sign in again.';

    await supabase.auth.signOut();

    window.location.replace('admin.html');

  }
}

// =====================================================
// 27. ADMINISTRATOR SIGN OUT
// =====================================================

logoutButton.addEventListener('click', async () => {

  logoutButton.disabled = true;
  logoutButton.textContent = 'Signing out...';

  const { error } = await supabase.auth.signOut();

  if (error) {

    console.error('Sign out error:', error);

    alert('Unable to sign out. Please try again.');

    logoutButton.disabled = false;
    logoutButton.textContent = 'Sign Out';

    return;
  }

  window.location.replace('admin.html');

});

// =====================================================
// 28. START DASHBOARD
// =====================================================

verifyAdminAccess();
