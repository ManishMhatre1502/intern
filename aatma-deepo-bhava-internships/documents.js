'use strict';

const PDFDocument = require('pdfkit');

function issuerDetails() {
  return {
    name: process.env.ORGANIZATION_NAME || 'Aatma Deepo Bhava',
    website: process.env.ORGANIZATION_WEBSITE || '',
    email: process.env.ORGANIZATION_CONTACT_EMAIL || '',
    signatory: process.env.SIGNATORY_NAME || 'Program Administration',
    title: process.env.SIGNATORY_TITLE || 'Internship Program'
  };
}

function printable(value) {
  return String(value ?? '').replace(/₹/g, 'INR ').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
}

async function createPdf({ title, studentName, enrollment, paragraphs, issuedAt = new Date() }) {
  const issuer = issuerDetails();
  const pdf = new PDFDocument({ size: 'A4', margin: 58, info: { Title: printable(title), Author: printable(issuer.name) } });
  const chunks = [];
  const finished = new Promise((resolve, reject) => {
    pdf.on('data', chunk => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
  });

  pdf.rect(0, 0, 595.28, 14).fill('#235dcc');
  pdf.moveDown(1.4);
  pdf.fillColor('#18335f').font('Helvetica-Bold').fontSize(13).text(printable(issuer.name), { align: 'center' });
  if (issuer.website) pdf.fillColor('#61728d').font('Helvetica').fontSize(9).text(printable(issuer.website), { align: 'center' });
  pdf.moveDown(2.2);
  pdf.fillColor('#1d3155').font('Helvetica-Bold').fontSize(25).text(printable(title), { align: 'center' });
  pdf.moveDown(.65);
  pdf.fillColor('#285fc0').font('Helvetica-Bold').fontSize(10).text('AATMA DEEPO BHAVA  |  BE YOUR OWN LIGHT', { align: 'center', characterSpacing: 1.1 });
  pdf.moveDown(2);
  pdf.fillColor('#25344d').font('Helvetica').fontSize(12).text('This document is issued to', { align: 'center' });
  pdf.moveDown(.45);
  pdf.fillColor('#18335f').font('Helvetica-Bold').fontSize(23).text(printable(studentName), { align: 'center' });
  pdf.moveDown(1.4);
  pdf.fillColor('#25344d').font('Helvetica').fontSize(11.5);
  for (const paragraph of paragraphs) {
    pdf.text(printable(paragraph), { align: 'left', lineGap: 5 });
    pdf.moveDown(.8);
  }
  pdf.moveDown(.8);
  pdf.fontSize(10).fillColor('#53647d').text(`Enrollment ID: ${printable(enrollment.id)}`);
  pdf.text(`Internship domain: ${printable(enrollment.title)}`);
  if (enrollment.startDate) pdf.text(`Program dates: ${printable(enrollment.startDate)} to ${printable(enrollment.endDate)}`);
  pdf.text(`Issued: ${issuedAt.toISOString().slice(0, 10)}`);
  pdf.moveDown(2);
  pdf.fillColor('#25344d').font('Helvetica-Bold').fontSize(11).text(printable(issuer.signatory));
  pdf.font('Helvetica').fontSize(9).fillColor('#61728d').text(printable(issuer.title));
  if (issuer.email) pdf.text(printable(issuer.email));
  pdf.moveDown(1.1);
  pdf.fillColor('#8491a5').fontSize(8).text('This document is generated for the named student and enrollment shown above.', { align: 'center' });
  pdf.end();
  return finished;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

async function sendEmail({ to, subject, text, html, attachments }) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('Email delivery is not configured. Set RESEND_API_KEY and EMAIL_FROM.');
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [to],
      subject,
      text,
      html,
      attachments: attachments.map(attachment => ({
        filename: attachment.filename,
        content: attachment.content.toString('base64')
      }))
    })
  });
  if (!response.ok) {
    const status = response.status;
    throw new Error(`Email service rejected the message (HTTP ${status}). Check the Resend key and verified sender.`);
  }
}

async function sendOfferLetter({ enrollment, student }) {
  const formUrl = process.env.TASK_SUBMISSION_FORM_URL;
  if (!formUrl) throw new Error('Set TASK_SUBMISSION_FORM_URL before sending the offer letter.');
  let parsedUrl;
  try { parsedUrl = new URL(formUrl); } catch { throw new Error('TASK_SUBMISSION_FORM_URL must be a valid HTTPS link.'); }
  if (parsedUrl.protocol !== 'https:') throw new Error('TASK_SUBMISSION_FORM_URL must be a valid HTTPS link.');

  const issuedAt = new Date();
  const pdf = await createPdf({
    title: 'Internship Offer Letter',
    studentName: student.name,
    enrollment,
    issuedAt,
    paragraphs: [
      `Dear ${student.name},`,
      `We are pleased to confirm your enrollment in the ${enrollment.title} internship program. Your enrollment fee has been verified and your student reference is ${enrollment.id}.`,
      `The program is planned to run from ${enrollment.startDate} through ${enrollment.endDate}. Your weekly work should be submitted using the task submission form and enrollment reference in the accompanying email.`,
      'Please submit one task each week. Include your enrollment ID, week number, a link to your work that reviewers can access, and any notes requested in the form. The program team will review submissions and share feedback.'
    ]
  });
  const taskGuidance = [
    'Weekly task submission guidelines:',
    '1. Submit one task for each program week (Weeks 1 to 4).',
    `2. Use the form: ${formUrl}`,
    `3. Enter enrollment ID: ${enrollment.id}`,
    '4. Include the week number and a link reviewers can open.',
    '5. Keep the shared work available until review is complete.'
  ].join('\n');
  await sendEmail({
    to: student.email,
    subject: `Internship Offer Letter — ${enrollment.title}`,
    text: `Dear ${student.name},\n\nYour paid internship enrollment is confirmed. Your offer letter is attached.\n\n${taskGuidance}\n\nRegards,\n${issuerDetails().name}`,
    html: `<p>Dear ${escapeHtml(student.name)},</p><p>Your paid internship enrollment is confirmed. Your offer letter is attached.</p><h3>Weekly task submission guidelines</h3><ol><li>Submit one task for each program week (Weeks 1 to 4).</li><li>Use the <a href="${escapeHtml(formUrl)}">task submission form</a>.</li><li>Enter enrollment ID <strong>${escapeHtml(enrollment.id)}</strong>.</li><li>Include the week number and a link reviewers can open.</li><li>Keep the shared work available until review is complete.</li></ol><p>Regards,<br>${escapeHtml(issuerDetails().name)}</p>`,
    attachments: [{ filename: `Offer-Letter-${enrollment.id}.pdf`, content: pdf }]
  });
}

async function sendCompletionDocuments({ enrollment, student, includeCompletion = true, includeAppreciation }) {
  const issuedAt = new Date();
  const attachments = [];
  const paragraphs = [
    `This certifies that ${student.name} has successfully completed the ${enrollment.title} internship program.`,
    'The student completed and received approval for all four weekly task submissions.'
  ];
  if (includeCompletion) {
    attachments.push({
      filename: `Internship-Completion-Certificate-${enrollment.id}.pdf`,
      content: await createPdf({
        title: 'Internship Completion Certificate',
        studentName: student.name,
        enrollment,
        paragraphs,
        issuedAt
      })
    });
  }
  if (includeAppreciation) {
    attachments.push({
      filename: `Appreciation-Letter-${enrollment.id}.pdf`,
      content: await createPdf({
        title: 'Appreciation Letter',
        studentName: student.name,
        enrollment,
        paragraphs: [
          `The program team recognizes ${student.name} for exceptional effort, consistency, and commitment during the ${enrollment.title} internship.`,
          'This recognition is granted by the program administrator.'
        ],
        issuedAt
      })
    });
  }
  const documentNames = includeCompletion && includeAppreciation
    ? 'your Internship Completion Certificate and Appreciation Letter'
    : includeAppreciation ? 'your Appreciation Letter' : 'your Internship Completion Certificate';
  await sendEmail({
    to: student.email,
    subject: `${includeCompletion && includeAppreciation ? 'Appreciation and completion documents' : includeAppreciation ? 'Appreciation Letter' : 'Internship Completion Certificate'} — ${enrollment.title}`,
    text: `Dear ${student.name},\n\nPlease find attached ${documentNames}.\n\nRegards,\n${issuerDetails().name}`,
    html: `<p>Dear ${escapeHtml(student.name)},</p><p>Please find attached ${escapeHtml(documentNames)}.</p><p>Regards,<br>${escapeHtml(issuerDetails().name)}</p>`,
    attachments
  });
}

module.exports = { sendOfferLetter, sendCompletionDocuments };
