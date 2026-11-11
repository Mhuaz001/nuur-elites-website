
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const accessMessage = document.getElementById('accessMessage');
const dashboard = document.getElementById('dashboard');
const logoutButton = document.getElementById('logoutButton');

async function verifyAdminAccess() {
  try {
    // Check whether a user is signed in.
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    const session = sessionData.session;

    if (!session) {
      window.location.replace('admin.html');
      return;
    }

    // Confirm the signed-in user's identity.
    const { data: userData, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    if (!userData.user) {
      window.location.replace('admin.html');
      return;
    }

    // Check the user's role in the profiles table.
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

    // Show the dashboard only after admin verification.
    accessMessage.hidden = true;
    dashboard.hidden = false;

  } catch (error) {
    console.error('Dashboard access error:', error);

    accessMessage.textContent =
      'Access could not be verified. Please sign in again.';

    await supabase.auth.signOut();
    window.location.replace('admin.html');
  }
}

// Sidebar navigation.
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

// Administrator sign out.
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

// Run the security check.
verifyAdminAccess();
