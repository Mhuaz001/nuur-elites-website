import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const respond = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  try {
    const { application_id } = await req.json();
    if (typeof application_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(application_id)) {
      return respond({ error: "A valid application_id is required" }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoKey = Deno.env.get("BREVO_API_KEY");
    if (!url || !serviceKey || !brevoKey) return respond({ error: "Notification service is not configured" }, 500);

    const db = createClient(url, serviceKey);
    const { data: app, error } = await db.from("student_applications")
      .select("id,student_name,date_of_birth,student_email,location,guardian_name,relationship,guardian_phone,guardian_email,course_interest,delivery_mode,preferred_schedule,additional_notes,status,admin_notification_sent_at")
      .eq("id", application_id).maybeSingle();
    if (error) return respond({ error: "Could not retrieve application" }, 500);
    if (!app) return respond({ error: "Application not found" }, 404);
    if (app.status !== "pending") return respond({ error: "Only pending applications can trigger notifications" }, 409);
    if (app.admin_notification_sent_at) return respond({ success: true, already_notified: true });

    const fields: [string, unknown][] = [
      ["Applicant", app.student_name], ["Date of birth", app.date_of_birth],
      ["Student email", app.student_email], ["Location", app.location],
      ["Parent/guardian", app.guardian_name], ["Relationship", app.relationship],
      ["Phone", app.guardian_phone], ["Parent/guardian email", app.guardian_email],
      ["Programme(s)", app.course_interest], ["Learning mode", app.delivery_mode],
      ["Preferred schedule", app.preferred_schedule], ["Additional notes", app.additional_notes],
    ];
    const rows = fields.map(([label, value]) =>
      `<tr><th align="left" style="padding:8px;border:1px solid #ddd;background:#f6f7f5">${escapeHtml(label)}</th><td style="padding:8px;border:1px solid #ddd">${escapeHtml(value || "—")}</td></tr>`
    ).join("");
    const to = Deno.env.get("BREVO_NOTIFICATION_TO") || "nuurelites@gmail.com";
    const sender = Deno.env.get("BREVO_SENDER_EMAIL") || "nuurelites@gmail.com";
    const mail = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": brevoKey, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        sender: { name: "Nuur Elites Learning and Consultancy", email: sender },
        to: [{ email: to }],
        subject: `New learner application: ${app.student_name || "New applicant"}`,
        htmlContent: `<div style="font-family:Arial,sans-serif;color:#24352b"><h2 style="color:#155b37">New learner application received</h2><p>A new application has been submitted through the Nuur Elites website.</p><table style="border-collapse:collapse;width:100%">${rows}</table><p>Please sign in to the admin portal to review this application.</p></div>`,
      }),
    });
    if (!mail.ok) {
      console.error("Brevo send failed:", mail.status, await mail.text());
      return respond({ error: "Email delivery failed" }, 502);
    }
    const { error: stampError } = await db.from("student_applications")
      .update({ admin_notification_sent_at: new Date().toISOString() })
      .eq("id", application_id).is("admin_notification_sent_at", null);
    if (stampError) console.error("Notification timestamp update failed:", stampError.message);
    return respond({ success: true, recorded: !stampError });
  } catch (e) {
    console.error("Notification handler failed:", e);
    return respond({ error: "Notification could not be processed" }, 500);
  }
});