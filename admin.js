
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==========================================
// NUUR ELITES - ADMINISTRATOR AUTHENTICATION
// ==========================================

const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// ==========================================
// PAGE ELEMENTS
// ==========================================

const loginForm = document.getElementById('adminLoginForm');
const loginMessage = document.getElementById('loginMessage');
const loginButton = document.getElementById('loginButton');

const emailInput = document.getElementById('adminEmail');
const passwordInput = document.getElementById('adminPassword');

// ==========================================
// DISPLAY MESSAGE
// ==========================================

function showLoginMessage(message, color = '#155b37') {
  if (!loginMessage) return;

  loginMessage.textContent = message;
  loginMessage.style.color = color;
}

// ==========================================
// VERIFY ADMINISTRATOR ACCOUNT
// ==========================================

async function verifyAdministrator() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error('Please sign in to continue.');
  }

  const { data: profile, error: profileError } =
    await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .maybeSingle();

  if (profileError) {
    throw new Error(
      'Unable to verify your administrator profile. Please try again.'
    );
  }

  if (!profile || String(profile.role).toLowerCase() !== 'admin') {
    await supabase.auth.signOut();

    throw new Error(
      'Access denied. This account is not authorised to access the administrator dashboard.'
    );
  }

  return { user, profile };
}

// ==========================================
// OPEN ADMIN DASHBOARD
// ==========================================

async function openAdminDashboard() {
  await verifyAdministrator();

  showLoginMessage(
    'Administrator verified. Opening dashboard...',
    'green'
  );

  window.location.assign('./admin-dashboard.html');
}

// ==========================================
// LOGIN FORM
// ==========================================

const forgotAdminPassword = document.getElementById('forgotAdminPassword');
if (forgotAdminPassword) {
  forgotAdminPassword.addEventListener('click', async () => {
    const email = emailInput?.value.trim();
    if (!email) { showLoginMessage('Enter your administrator email address first.', 'red'); return; }
    forgotAdminPassword.disabled = true;
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password.html`
      });
      if (error) throw error;
      showLoginMessage('If this email belongs to an administrator account, a password reset link has been sent.');
    } catch (error) {
      showLoginMessage(error.message || 'Password reset could not be requested.', 'red');
    } finally { forgotAdminPassword.disabled = false; }
  });
}

if (!loginForm || !loginButton || !emailInput || !passwordInput) {
  console.error(
    'Administrator login elements are missing from the HTML page.'
  );
  showLoginMessage(
    'Login page configuration error. Contact the website administrator.',
    'red'
  );
} else {

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showLoginMessage(
        'Please enter your email address and password.',
        'red'
      );
      return;
    }

    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';

    showLoginMessage('Verifying administrator details...');

    try {

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      await openAdminDashboard();

    } catch (error) {

      console.error('Administrator login error:', error);

      showLoginMessage(
        error.message || 'Login failed. Please try again.',
        'red'
      );

      // Clear an authenticated session if verification fails.
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (user) {
        await supabase.auth.signOut();
      }

    } finally {

      loginButton.disabled = false;
      loginButton.textContent = 'Sign In';

    }
  });

  // ========================================
  // CHECK EXISTING SESSION
  // ========================================

  async function checkExistingSession() {

    const {
      data: { session },
      error
    } = await supabase.auth.getSession();

    if (error) {
      console.error('Session verification error:', error);
      return;
    }

    if (session) {
      try {
        await openAdminDashboard();
      } catch (error) {
        console.error(error);
        showLoginMessage(
          error.message,
          'red'
        );
      }
    }
  }

  checkExistingSession();
}
