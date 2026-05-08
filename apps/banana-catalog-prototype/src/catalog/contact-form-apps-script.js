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

// ---- HANDLER ----

function doPost(e) {
  try {
    const data = e.parameter

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

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON)

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON)
  }
}

// Allow GET for testing (just returns a status message)
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Contact form endpoint is live.' }))
    .setMimeType(ContentService.MimeType.JSON)
}
