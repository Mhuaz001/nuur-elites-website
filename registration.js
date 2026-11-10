
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Replace these two values with your own Supabase details.
const SUPABASE_URL = 'https://lrcnworfhrrntdltzgpe.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yBLxiC7z_ZymMMveeQN9Ug_Bok2ubsZ';

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const form = document.getElementById('applicationForm');
const message = document.getElementById('formMessage');
const submitButton = document.getElementById('submitButton');

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';
  message.textContent = 'Please wait while we submit your application.';
  message.style.color = '#155b37';

  const application = {
    student_name: document.getElementById('studentName').value.trim(),
    date_of_birth: document.getElementById('dob').value || null,
    location: document.getElementById('location').value.trim(),
    guardian_name: document.getElementById('guardianName').value.trim(),
    relationship: document.getElementById('relationship').value,
    guardian_phone: document.getElementById('guardianPhone').value.trim(),
    guardian_email: document.getElementById('guardianEmail').value.trim() || null,
    course_interest: document.getElementById('courseInterest').value,
    delivery_mode: document.getElementById('deliveryMode').value,
    preferred_schedule: document.getElementById('preferredSchedule').value.trim() || null,
    additional_notes: document.getElementById('notes').value.trim() || null,
    status: 'pending'
  };

  try {
    const { error } = await supabase
      .from('student_applications')
      .insert([application]);

    if (error) {
      throw error;
    }

    message.textContent =
      'Thank you! Your registration has been submitted successfully. Our team will contact you.';
    message.style.color = 'green';

    form.reset();

  } catch (error) {
    console.error('Registration error:', error);

    message.textContent =
      'We could not submit your application. Please try again or contact our office.';
    message.style.color = 'red';

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Registration';
  }
});
