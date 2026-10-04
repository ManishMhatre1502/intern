# Internship Workflow Setup

## Required services and secrets

Configure these server-only environment variables in Vercel (Production and Preview as needed):

- `MONGODB_URI`, `MONGODB_DB`: MongoDB Atlas connection.
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`: Razorpay API credentials. Start with test credentials, then switch to live keys after your account and checkout are ready.
- `RAZORPAY_WEBHOOK_SECRET`: a long secret configured identically in the Razorpay webhook settings.
- `RESEND_API_KEY`, `EMAIL_FROM`: Resend API key and a sender address verified with Resend.
- `TASK_SUBMISSION_FORM_URL`: public HTTPS Google Form link included in the offer email.
- `GOOGLE_FORMS_WEBHOOK_SECRET`: long random token copied to Apps Script Project Properties.
- `ORGANIZATION_NAME`, `ORGANIZATION_WEBSITE`, `ORGANIZATION_CONTACT_EMAIL`, `SIGNATORY_NAME`, `SIGNATORY_TITLE`: issuer details printed on generated documents. Use the client-approved legal/brand details.

Never commit live values or put server secrets in frontend variables. Vercel environment changes require a new deployment.

## Razorpay checkout

The internship fee is currently INR 1,000, matching the existing site. The server creates each Razorpay order and records an enrollment as Pending. The browser checkout result is verified server-side using the Razorpay key secret. Only verified payments become Paid and trigger the offer letter email. The Razorpay webhook is a second, idempotent fulfillment path for captured payments when a browser closes before returning. Enable automatic payment capture in Razorpay; this implementation does not provide a manual capture step and only captured payments activate an enrollment.

In Razorpay, configure a webhook at:

`https://YOUR-PRODUCTION-DOMAIN/api/webhooks/razorpay`

Set the webhook secret to the same `RAZORPAY_WEBHOOK_SECRET`. Subscribe to `payment.captured`, `payment.failed`, and `order.paid`. Configure and test the endpoint with Razorpay test mode before enabling live payments.

## Google Forms weekly submissions

Create a form with these fields and exact labels:

1. Enrollment ID (short answer)
2. Week (1, 2, 3, or 4)
3. Submission URL (short answer)
4. Student email (short answer, unless the form is set to collect verified respondent emails)
5. Notes (optional paragraph)

In Apps Script, add `google-apps-script/on-form-submit.gs`, create an installable trigger for `onFormSubmit` with event source **From form** and event type **On form submit**. Add Script Properties:

- `WEBHOOK_URL`: `https://YOUR-PRODUCTION-DOMAIN/api/webhooks/google-forms`
- `WEBHOOK_SECRET`: exactly the value of `GOOGLE_FORMS_WEBHOOK_SECRET`

The webhook verifies the shared bearer token, matches the email and paid enrollment, validates the week and HTTPS work link, and stores one current submission per enrollment/week in MongoDB. A later submission for the same week replaces that week’s pending review item. Admin review feedback and status are stored with it.

## Admin review and documents

Sign in with the configured admin account. The Weekly task review tab lists submissions by student, enrollment, and week; admins can approve a task or request changes with feedback. The documents tab only enables completion documents when all four weeks are approved and payment is confirmed. Granting appreciation sends the appreciation letter and, if not already sent, the completion certificate in the same email. Offer-letter delivery is flagged only after Resend accepts the email; if email setup is missing or fails, payment remains recorded and the admin can retry the offer letter from the documents tab.


## Razorpay approval pages and route names

The public site exposes these policy routes for payment review:

- `/privacy`
- `/return-policy`
- `/refund-policy`
- `/disclaimer`
- `/terms`

The footer links to each page. The payment implementation accepts these server routes:

- `POST /api/razorpay/create-order` (also used internally as `/api/internships/enroll`)
- `POST /api/razorpay/verify` (also available at `/api/payments/verify`)
- `POST /api/razorpay/webhook` (also available at `/api/webhooks/razorpay`)

Before submitting the site for approval, replace the fallback support email by configuring `ORGANIZATION_CONTACT_EMAIL`, confirm the cancellation/refund wording with the client, and make sure the live Razorpay account, website URL, support contact, and refund process match the business that will receive payments.
