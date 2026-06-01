/**
 * BANANASUTRA Contact Form — Google Apps Script
 *
 * SETUP:
 * 1. Create a new Google Sheet (this will be your message log)
 * 2. Add headers in row 1: Timestamp | Name | Email | Subject | Message
 * 3. Go to Extensions → Apps Script
 * 4. Delete the default code and paste this entire file
 * 5. Click Deploy → New deployment
 *    - Type: Web app
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 6. Click Deploy, authorize when prompted
 * 7. Copy the web app URL → paste it as VITE_CONTACT_ENDPOINT in your .env file
 *
 * That's it. The script logs every submission to the sheet AND sends you an email.
 */

// ---- CONFIG ----
const NOTIFY_EMAIL = 'itsbananasutra@gmail.com'
const SHEET_NAME   = 'Sheet1'   // Name of the tab in your spreadsheet

// ---- HELPERS ----

function parseRequestData(e) {
  if (e.postData && e.postData.contents) {
    const type = (e.postData.type || '').toLowerCase()
    if (type.indexOf('application/json') !== -1) {
      try {
        return JSON.parse(e.postData.contents)
      } catch (err) {
        return null
      }
    }
  }
  return e.parameter || {}
}

function parseTruthy(value) {
  if (value === true || value === 'true' || value === '1' || value === 'on') return true
  return false
}

function jsonResponse(payload, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON)
  if (typeof statusCode === 'number') {
    // Apps Script web apps cannot set HTTP status codes directly.
    output.setMimeType(ContentService.MimeType.JSON)
  }
  return output
}

function sendSenderCopy(data) {
  const sendCopy = parseTruthy(data.sendCopy)
  const email = (data.email || '').substring(0, 300).trim()
  if (!sendCopy || !email) return

  const name = (data.name || '').substring(0, 200).trim()
  const subject = (data.subject || '').substring(0, 300).trim()
  const copyMessage = (data.userMessage || data.message || '').substring(0, 10000).trim()
  if (!copyMessage) return

  const greeting = name ? `Hi ${name},` : 'Hi there,'
  const subjectLine = subject
    ? `Copy of your message to BANANASUTRA (${subject})`
    : 'Copy of your message to BANANASUTRA'

  const body = [
    greeting,
    '',
    "Here's a copy of what you sent:",
    '',
    copyMessage,
    '',
    '---',
    'Bananasutra',
  ].join('\n')

  MailApp.sendEmail({
    to: email,
    subject: subjectLine,
    body: body,
  })
}

// ---- HANDLER ----

function doPost(e) {
  try {
    const data = parseRequestData(e)
    if (!data) {
      return jsonResponse({ ok: false, error: 'Invalid JSON body.' })
    }

    const name    = (data.name    || '').substring(0, 200)
    const email   = (data.email   || '').substring(0, 300)
    const subject = (data.subject || '').substring(0, 300)
    const message = (data.message || '').substring(0, 10000)
    const ts      = data._timestamp || new Date().toISOString()

    // ---- Log to spreadsheet ----
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
    sheet.appendRow([ts, name, email, subject, message])

    // ---- Send email notification ----
    const emailSubject = subject
      ? `[BANANASUTRA Contact] ${subject}`
      : '[BANANASUTRA Contact] New message'

    const emailBody = [
      `New contact form submission`,
      ``,
      `Name:    ${name}`,
      `Email:   ${email}`,
      `Subject: ${subject || '(none)'}`,
      ``,
      `Message:`,
      message,
      ``,
      `---`,
      `Sent at ${ts}`,
    ].join('\n')

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: emailSubject,
      body: emailBody,
      replyTo: email,
    })

    sendSenderCopy(data)

    return jsonResponse({ ok: true, status: 'ok' })

  } catch (err) {
    return jsonResponse({ ok: false, status: 'error', error: err.toString() })
  }
}

// Allow GET for testing (just returns a status message)
function doGet() {
  return jsonResponse({ ok: true, status: 'ok', message: 'Contact form endpoint is live.' })
}
