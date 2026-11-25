
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
    student_email: document.getElementById('studentEmail').value.trim() || null,
    location: document.getElementById('location').value.trim(),
    guardian_name: document.getElementById('guardianName').value.trim(),
    relationship: document.getElementById('relationship').value,
    guardian_phone: document.getElementById('guardianPhone').value.trim(),
    guardian_email: document.getElementById('guardianEmail').value.trim() || null,
    course_interest: Array.from(
  document.querySelectorAll('input[name="courseInterest"]:checked')
).map(input => input.value).join(', '),
    delivery_mode: document.getElementById('deliveryMode').value,
    preferred_schedule: document.getElementById('preferredSchedule').value.trim() || null,
    additional_notes: document.getElementById('notes').value.trim() || null,
    privacy_consent: document.getElementById('privacyConsent').checked,
    status: 'pending'
  };
if (!application.course_interest) {
  message.textContent = 'Please select at least one programme.';
  message.style.color = 'red';
  submitButton.disabled = false;
  submitButton.textContent = 'Submit Registration';
  return;
}

const ageOnToday = (dob) => {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age--;
  return age;
};
const applicantAge = ageOnToday(application.date_of_birth);
if (applicantAge !== null && applicantAge >= 18 && !application.student_email) {
  message.textContent = 'Please provide the adult student’s email address for their portal invitation.';
  message.style.color = 'red';
  submitButton.disabled = false;
  submitButton.textContent = 'Submit Registration';
  return;
}
if ((applicantAge === null || applicantAge < 18) && !application.guardian_email) {
  message.textContent = 'Please provide the parent or guardian’s email address for the portal invitation.';
  message.style.color = 'red';
  submitButton.disabled = false;
  submitButton.textContent = 'Submit Registration';
  return;
}
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
