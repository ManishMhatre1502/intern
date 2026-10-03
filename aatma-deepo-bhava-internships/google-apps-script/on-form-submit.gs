/**
 * Installable Google Forms "On form submit" trigger.
 * Form fields expected: Enrollment ID, Week, Submission URL, Student email (unless respondent email collection is on), Notes (optional).
 * Store WEBHOOK_URL and WEBHOOK_SECRET in Apps Script Project Settings > Script Properties.
 */
function onFormSubmit(e) {
  if (!e || !e.response) throw new Error('This handler must run from an installable Google Forms submit trigger.');
  var props = PropertiesService.getScriptProperties();
  var webhookUrl = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('WEBHOOK_SECRET');
  if (!webhookUrl || !secret) throw new Error('Set WEBHOOK_URL and WEBHOOK_SECRET in Script Properties.');

  var answers = {};
  e.response.getItemResponses().forEach(function(itemResponse) {
    answers[itemResponse.getItem().getTitle().trim().toLowerCase()] = String(itemResponse.getResponse() || '').trim();
  });
  var email = String(e.response.getRespondentEmail() || answers['student email'] || answers['email address'] || '').trim();
  var payload = {
    responseId: String(e.response.getId()),
    studentEmail: email,
    enrollmentId: answers['enrollment id'] || '',
    week: Number(answers['week'] || answers['week number']),
    submissionUrl: answers['submission url'] || answers['project link'] || '',
    notes: answers['notes'] || '',
    submittedAt: e.response.getTimestamp().toISOString(),
    formId: e.source ? e.source.getId() : ''
  };
  if (!payload.studentEmail || !payload.enrollmentId || !payload.week || !payload.submissionUrl) {
    throw new Error('The response must include email, enrollment ID, week, and submission URL.');
  }

  var response = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    headers: { Authorization: 'Bearer ' + secret },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Task webhook returned HTTP ' + response.getResponseCode() + ': ' + response.getContentText());
  }
}
