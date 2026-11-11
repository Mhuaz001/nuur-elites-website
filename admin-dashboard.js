
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// SUPABASE CONNECTION
const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// PAGE ELEMENTS
const accessMessage = document.getElementById('accessMessage');
const dashboard = document.getElementById('dashboard');
const logoutButton = document.getElementById('logoutButton');

const tableBody = document.getElementById('applicationTableBody');
const applicationMessage = document.getElementById('applicationMessage');

// LOAD APPLICATIONS
async function loadApplications() {

  tableBody.innerHTML = `
    <tr>
      <td colspan="7" style="padding:20px;text-align:center;">
        Loading applications...
      </td>
    </tr>
  `;

  applicationMessage.textContent = 'Loading applications...';
  applicationMessage.style.color = '#155b37';

  const { data: applications, error } = await supabase
    .from('student_applications')
    .select('*')
    .order('submitted_at', { ascending: false });

  if (error) {
    console.error('Applications loading error:', error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:20px;text-align:center;">
          Unable to load applications.
        </td>
      </tr>
    `;

    applicationMessage.textContent =
      'Unable to load applications. Check database permissions.';

    applicationMessage.style.color = 'red';
    return;
  }

  document.getElementById('applicationCount').textContent =
    applications.length;

  tableBody.innerHTML = '';

  if (applications.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="7" style="padding:20px;text-align:center;">
          No applications submitted yet.
        </td>
      </tr>
    `;

    applicationMessage.textContent = 'No applications available.';
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
      application.status
    ];

    values.forEach(value => {

      const cell = document.createElement('td');

      cell.textContent = value || '—';

      row.appendChild(cell);

    });

    // ACTIONS CELL
    const actionCell = document.createElement('td');

    if (application.status === 'pending') {

      const approveButton = document.createElement('button');

      approveButton.textContent = 'Approve';
      approveButton.className = 'action-button approve-button';
      approveButton.dataset.action = 'approve';
      approveButton.dataset.id = application.id;

      const rejectButton = document.createElement('button');

      rejectButton.textContent = 'Reject';
      rejectButton.className = 'action-button reject-button';
      rejectButton.dataset.action = 'reject';
      rejectButton.dataset.id = application.id;

      actionCell.appendChild(approveButton);
      actionCell.appendChild(rejectButton);

    } else {

      actionCell.textContent = 'No action required';

    }

    row.appendChild(actionCell);

    tableBody.appendChild(row);

  });

  applicationMessage.textContent =
    `${applications.length} application(s) loaded successfully.`;

  applicationMessage.style.color = 'green';

  await loadStudentCount();
}

// LOAD STUDENT COUNT
async function loadStudentCount() {

  const { count, error } = await supabase
    .from('students')
    .select('id', { count: 'exact', head: true });

  if (error) {
    console.error('Student count error:', error);
    return;
  }

  document.getElementById('studentCount').textContent = count;
}

// APPROVE OR REJECT APPLICATION
tableBody.addEventListener('click', async (event) => {

  const button = event.target.closest('button[data-action]');

  if (!button) return;

  const applicationId = button.dataset.id;
  const action = button.dataset.action;

  if (!applicationId) return;

  const confirmed = confirm(
    action === 'approve'
      ? 'Are you sure you want to approve this application and register the student?'
      : 'Are you sure you want to reject this application?'
  );

  if (!confirmed) return;

  button.disabled = true;

  applicationMessage.textContent =
    action === 'approve'
      ? 'Approving application and creating student record...'
      : 'Rejecting application...';

  applicationMessage.style.color = '#155b37';

  let result;

  try {

    if (action === 'approve') {

      result = await supabase.rpc(
        'approve_student_application',
        {
          application_id: applicationId
        }
      );

    } else if (action === 'reject') {

      result = await supabase.rpc(
        'reject_student_application',
        {
          application_id: applicationId
        }
      );

    }

    if (result.error) {
      throw result.error;
    }

    applicationMessage.textContent =
      action === 'approve'
        ? 'Application approved. Student record created successfully.'
        : 'Application rejected successfully.';

    applicationMessage.style.color = 'green';

    // REFRESH APPLICATIONS AND STUDENT COUNT
    await loadApplications();

  } catch (error) {

    console.error('Application action error:', error);

    applicationMessage.textContent =
      error.message || 'Unable to process this application.';

    applicationMessage.style.color = 'red';

    button.disabled = false;

  }

});

// VERIFY ADMINISTRATOR ACCESS
async function verifyAdminAccess() {

  try {

    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
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

    // CHECK ADMIN ROLE
    const { data: profile, error: profileError } = await supabase
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

    // DISPLAY DASHBOARD
    accessMessage.hidden = true;
    dashboard.hidden = false;

    // LOAD DASHBOARD DATA
    await loadApplications();

  } catch (error) {

    console.error('Dashboard access error:', error);

    accessMessage.textContent =
      'Access could not be verified. Please sign in again.';

    await supabase.auth.signOut();

    window.location.replace('admin.html');

  }

}

// SIDEBAR NAVIGATION
const navigationButtons = document.querySelectorAll('.nav-button');
const sections = document.querySelectorAll('.section');

navigationButtons.forEach(button => {

  button.addEventListener('click', () => {

    const selectedSection = button.dataset.section;

    navigationButtons.forEach(item => {
      item.classList.remove('active');
    });

    sections.forEach(section => {
      section.classList.remove('active');
    });

    button.classList.add('active');

    document.getElementById(selectedSection).classList.add('active');

  });

});

// ADMINISTRATOR SIGN OUT
logoutButton.addEventListener('click', async () => {

  logoutButton.disabled = true;
  logoutButton.textContent = 'Signing out...';

  try {

    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    window.location.replace('admin.html');

  } catch (error) {

    console.error('Sign out error:', error);

    alert('Unable to sign out. Please try again.');

    logoutButton.disabled = false;
    logoutButton.textContent = 'Sign Out';

  }

});

// START DASHBOARD
verifyAdminAccess();
