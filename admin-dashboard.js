
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

// LOAD STUDENT APPLICATIONS
async function loadApplications() {
  const tableBody = document.getElementById('applicationTableBody');
  const message = document.getElementById('applicationMessage');
  const applicationCount = document.getElementById('applicationCount');

  tableBody.innerHTML = '';

  message.textContent = 'Loading applications...';
  message.style.color = '#155b37';

  const { data: applications, error } = await supabase
    .from('student_applications')
    .select(`
      student_name,
      guardian_name,
      guardian_phone,
      course_interest,
      delivery_mode,
      status
    `)
    .order('student_name', { ascending: true });

  if (error) {
    console.error('Applications loading error:', error);

    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:20px;text-align:center;">
          Unable to load applications.
        </td>
      </tr>
    `;

    message.textContent =
      'Unable to load applications. Please check your database permissions.';
    message.style.color = 'red';

    return;
  }

  applicationCount.textContent = applications.length;

  if (applications.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:20px;text-align:center;">
          No applications have been submitted yet.
        </td>
      </tr>
    `;

    message.textContent = 'No applications available.';
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
      cell.style.padding = '12px';
      cell.style.borderBottom = '1px solid #ddd';
      cell.style.fontSize = '13px';

      row.appendChild(cell);
    });

    tableBody.appendChild(row);
  });

  message.textContent =
    `${applications.length} application(s) loaded successfully.`;

  message.style.color = 'green';
}

// VERIFY ADMINISTRATOR ACCESS
async function verifyAdminAccess() {
  try {
    // Check signed-in session.
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      window.location.replace('admin.html');
      return;
    }

    // Verify user identity.
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    if (!userData.user) {
      window.location.replace('admin.html');
      return;
    }

    // Check administrator role.
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

    // Display dashboard after successful verification.
    accessMessage.hidden = true;
    dashboard.hidden = false;

    // Load real student applications.
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
