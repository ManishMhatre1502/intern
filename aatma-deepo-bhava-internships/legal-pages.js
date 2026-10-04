'use strict';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

const pages = {
  '/return-policy': {
    title: 'Cancellation & Return Policy',
    description: 'Cancellation and service return policy for Aatma Deepo Bhava internships.',
    heading: 'Cancellation & Return Policy',
    intro: 'This policy explains how to cancel an internship enrollment or request a return of the digital internship service.',
    sections: [
      ['Eligibility', '<p>You may request cancellation within <strong>7 calendar days</strong> of successful payment, provided the internship has not started and no internship service has been used. A cancellation request after an offer letter has been issued, tasks have been submitted, or the program has started is generally not eligible for a return.</p><p>These conditions do not limit any non-waivable rights available under applicable law.</p>'],
      ['How to request a cancellation', '<ol><li>Email the contact address below from the email used for enrollment.</li><li>Include your full name, enrollment ID, registered email address, payment ID, and the reason for the request.</li><li>We will confirm eligibility and the next steps by email.</li></ol>'],
      ['Processing and fees', '<p>Approved cancellations are sent to the original payment method. Payment gateway or other third-party processing charges may be withheld where permitted by law and the applicable payment provider rules. We do not charge shipping because the program and documents are digital.</p>'],
      ['Service changes', '<p>If we materially change or cannot provide the enrolled program, we will contact the affected student and explain the available rescheduling or refund options.</p>']
    ]
  },
  '/refund-policy': {
    title: 'Refund Policy',
    description: 'Refund eligibility, timelines, and payment method for Aatma Deepo Bhava internships.',
    heading: 'Refund Policy',
    intro: 'We aim to handle every refund request clearly and fairly for this digital internship program.',
    sections: [
      ['When a refund may be approved', '<p>A refund may be approved when a cancellation meets the eligibility rules in the Cancellation &amp; Return Policy, when a duplicate payment is confirmed, or when we cannot provide the enrolled service. Requests are reviewed against the enrollment and payment records.</p>'],
      ['Timeline and payment method', '<p>After approval, we initiate the refund within <strong>2 business days</strong>. Your bank or payment provider may take an additional <strong>5–7 business days</strong> to show the amount. Refunds are made to the original payment method used through Razorpay.</p>'],
      ['Non-refundable amounts', '<p>Payments for services already started, tasks already submitted, or documents already issued are generally non-refundable. Third-party payment processing charges may also be non-refundable where permitted by law.</p>'],
      ['Request support', '<p>Send your request with the enrollment ID and payment ID to the contact address below. We will acknowledge the request and tell you if any further information is needed.</p>']
    ]
  },
  '/privacy': {
    title: 'Privacy Policy',
    description: 'How Aatma Deepo Bhava collects, uses, and protects student information.',
    heading: 'Privacy Policy',
    intro: 'This policy describes the information we collect to operate the internship platform, process payments, review work, and deliver documents.',
    sections: [
      ['Information we collect', '<p>We may collect your name, email address, mobile number, account credentials in protected form, enrollment details, payment references, task submission links, review feedback, and communication preferences. We do not store full card, UPI, or bank credentials.</p>'],
      ['How we use information', '<p>We use information to create accounts, create and verify Razorpay orders, provide the internship, match weekly submissions to an enrollment, issue offer letters and certificates, prevent abuse, respond to support requests, and meet legal or accounting obligations.</p>'],
      ['Service providers and sharing', '<p>We share only the information needed with service providers that help us operate the program, including MongoDB Atlas for application records, Razorpay for payment processing, Resend for transactional email, and Google Forms/Apps Script when you submit weekly work. Providers process data under their own policies and applicable agreements. We do not sell student information.</p>'],
      ['Storage and security', '<p>Account and enrollment data is stored in access-controlled MongoDB collections. Passwords are stored as one-way hashes, and sessions use an HTTP-only cookie. No online system can guarantee absolute security, so please use a unique password and contact us promptly about suspected misuse.</p>'],
      ['Cookies and choices', '<p>The site uses an essential session cookie when you sign in. Optional analytics cookies are not enabled by default. You can accept or reject optional cookies using the consent banner. You can also clear cookies in your browser; this may sign you out.</p>'],
      ['Your rights and contact', '<p>Subject to applicable law, you may ask to access, correct, or delete your personal information, or ask about how it is used. Contact the address below and include your registered email so we can verify the request.</p>']
    ]
  },
  '/disclaimer': {
    title: 'Disclaimer',
    description: 'Important service, content, and third-party disclaimers for Aatma Deepo Bhava.',
    heading: 'Disclaimer',
    intro: 'Please read this information before enrolling in an internship.',
    sections: [
      ['Educational service', '<p>The platform provides educational internship activities, guided tasks, feedback, and program documents. Participation does not guarantee employment, placement, income, academic credit, or a particular result.</p>'],
      ['Content accuracy', '<p>We work to keep program descriptions, schedules, and documents accurate, but details may change as the program is updated. Please rely on the confirmation provided for your enrollment and contact us when something appears incorrect.</p>'],
      ['Third-party services and links', '<p>Razorpay, Google Forms, email providers, and other linked services are operated by third parties. Their availability, terms, privacy practices, and content are outside our control. A link or payment option does not mean we endorse every third-party service.</p>'],
      ['Availability and liability', '<p>We may pause or limit the platform for maintenance, security, or circumstances outside our reasonable control. To the extent permitted by law, we are not responsible for indirect losses arising from a temporary outage, third-party service failure, or a student’s use of submitted materials.</p>']
    ]
  },
  '/terms': {
    title: 'Terms & Conditions',
    description: 'Terms governing use of the Aatma Deepo Bhava internship platform.',
    heading: 'Terms & Conditions',
    intro: 'By creating an account or enrolling, you agree to these terms and the policies linked below.',
    sections: [
      ['Eligibility and accounts', '<p>You must provide accurate information, keep your password confidential, and use only your own account. Tell us promptly if you believe someone has accessed your account.</p>'],
      ['Enrollment and payment', '<p>The displayed program fee is due through the Razorpay checkout. An enrollment is confirmed only after the payment is successfully captured and verified by the server. A pending or failed payment does not activate the internship or issue an offer letter.</p>'],
      ['Program participation', '<p>Students must submit original work, follow the task instructions, and avoid unlawful, harmful, plagiarized, or misleading material. We may pause or close an account for abuse, fraud, or serious violations.</p>'],
      ['Documents and recognition', '<p>An offer letter is sent after verified enrollment. A completion certificate is available only after the required weekly submissions have been reviewed and approved. Appreciation recognition is discretionary and based on exceptional work.</p>'],
      ['Intellectual property', '<p>You retain ownership of your original work, while giving us permission to review it for the program. Do not submit confidential material belonging to another person or organization without authorization.</p>'],
      ['Policies and changes', '<p>The Cancellation &amp; Return Policy, Refund Policy, Privacy Policy, and Disclaimer form part of these terms. We may update the platform or these terms; the current version will be posted on this website.</p>']
    ]
  }
};

function footer() {
  return '<footer class="legal-footer"><a href="/">Home</a><a href="/privacy">Privacy Policy</a><a href="/return-policy">Return Policy</a><a href="/refund-policy">Refund Policy</a><a href="/disclaimer">Disclaimer</a><a href="/terms">Terms &amp; Conditions</a></footer>';
}

function renderLegalPage(pathname, { organization, contactEmail, website } = {}) {
  const page = pages[pathname] || pages['/privacy'];
  const brand = escapeHtml(organization || 'Aatma Deepo Bhava');
  const contact = escapeHtml(contactEmail || 'support@example.com');
  const site = escapeHtml(website || '');
  const sections = page.sections.map(([heading, body]) => '<section><h2>' + heading + '</h2>' + body + '</section>').join('');
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' +
    escapeHtml(page.title) + ' | ' + brand + '</title><meta name="description" content="' + escapeHtml(page.description) +
    '"><link rel="canonical" href="' + escapeHtml(pathname) + '"><link rel="icon" href="/assets/aatma-deepo-bhava-logo.png"><link rel="stylesheet" href="/css/style.css?v=razorpay-compliance-20261004"></head><body class="legal-page"><main class="legal-shell"><a class="legal-brand" href="/"><img src="/assets/aatma-deepo-bhava-logo.png" alt="" aria-hidden="true"><span>' + brand + '</span></a><article class="legal-card"><p class="legal-eyebrow">POLICIES &amp; TERMS</p><h1>' + escapeHtml(page.heading) + '</h1><p class="legal-intro">' + page.intro + '</p>' + sections + '<div class="legal-contact"><strong>Questions or requests?</strong><p>Email <a href="mailto:' + contact + '">' + contact + '</a>' + (site ? ' or visit <a href="' + site + '">' + site + '</a>.' : '.') + '</p></div></article>' + footer() + '</main></body></html>';
}

module.exports = { renderLegalPage, pages };
