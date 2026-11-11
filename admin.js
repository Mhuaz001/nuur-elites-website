
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase connection
const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

// Login form elements
const loginForm = document.getElementById('adminLoginForm');
const loginMessage = document.getElementById('loginMessage');
const loginButton = document.getElementById('loginButton');

// Administrator login
loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;

  loginButton.disabled = true;
  loginButton.textContent = 'Signing in...';

  loginMessage.textContent = 'Verifying administrator details...';
  loginMessage.style.color = '#155b37';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Administrator account could not be verified.');
    }

    loginMessage.textContent = 'Login successful. Opening dashboard...';
    loginMessage.style.color = 'green';

    // Dashboard page will be created in the next stage
    window.location.href = 'admin-dashboard.html';

  } catch (error) {
    console.error('Admin login error:', error);

    loginMessage.textContent =
      'Login failed. Please check your email and password.';

    loginMessage.style.color = 'red';

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Sign In';
  }
});
