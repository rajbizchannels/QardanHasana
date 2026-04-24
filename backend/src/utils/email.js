const nodemailer = require('nodemailer');
const logger = require('./logger');

let transporter;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return transporter;
};

const emailTemplates = {
  welcome: (data) => ({
    subject: 'Welcome to Qardan Hasana',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
          <p style="color:#fff;margin:5px 0;">Cash Management System</p>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2>Welcome, ${data.name}!</h2>
          <p>Your account has been created successfully.</p>
          <p><strong>ITS Number:</strong> ${data.itsNumber}</p>
          <p><strong>Email:</strong> ${data.email}</p>
          ${data.verificationLink ? `<p><a href="${data.verificationLink}" style="background:#1B4332;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Verify Email</a></p>` : ''}
        </div>
        <div style="background:#1B4332;padding:15px;text-align:center;">
          <p style="color:#fff;margin:0;font-size:12px;">© ${new Date().getFullYear()} Qardan Hasana. All rights reserved.</p>
        </div>
      </div>`,
  }),

  passwordReset: (data) => ({
    subject: 'Password Reset Request - Qardan Hasana',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2>Password Reset</h2>
          <p>You requested a password reset. Click the link below (valid for 1 hour):</p>
          <p><a href="${data.resetLink}" style="background:#1B4332;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Reset Password</a></p>
          <p style="color:#888;font-size:12px;">If you did not request this, ignore this email.</p>
        </div>
      </div>`,
  }),

  approvalRequired: (data) => ({
    subject: `Action Required: ${data.title} - Qardan Hasana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2>Approval Required</h2>
          <p><strong>${data.title}</strong></p>
          <p>${data.description}</p>
          <p><strong>Requested by:</strong> ${data.requestedBy}</p>
          <p><strong>Priority:</strong> ${data.priority || 'Normal'}</p>
          <p><a href="${data.approvalLink}" style="background:#D4AF37;color:#1B4332;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">Review & Approve</a></p>
        </div>
      </div>`,
  }),

  approvalStatus: (data) => ({
    subject: `${data.status === 'approved' ? '✓ Approved' : '✗ Rejected'}: ${data.title} - Qardan Hasana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2 style="color:${data.status === 'approved' ? '#1B4332' : '#dc2626'}">
            ${data.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
          </h2>
          <p><strong>${data.title}</strong></p>
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
          <p><strong>Reviewed by:</strong> ${data.reviewedBy}</p>
        </div>
      </div>`,
  }),

  transactionNotification: (data) => ({
    subject: `Transaction ${data.type}: ${data.amount} - Qardan Hasana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2>Transaction Notification</h2>
          <p><strong>Type:</strong> ${data.type}</p>
          <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
          <p><strong>Description:</strong> ${data.description}</p>
          <p><strong>Date:</strong> ${data.date}</p>
          <p><strong>Reference:</strong> ${data.reference}</p>
        </div>
      </div>`,
  }),

  loanUpdate: (data) => ({
    subject: `Loan ${data.status}: ${data.loanNumber} - Qardan Hasana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2>Loan Application Update</h2>
          <p><strong>Loan Number:</strong> ${data.loanNumber}</p>
          <p><strong>Status:</strong> <span style="color:${data.status === 'approved' ? '#1B4332' : '#dc2626'}">${data.status.toUpperCase()}</span></p>
          <p><strong>Amount:</strong> ${data.currency} ${data.amount}</p>
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
        </div>
      </div>`,
  }),

  documentUploaded: (data) => ({
    subject: `Document Uploaded for Review - Qardan Hasana`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#1B4332;padding:20px;text-align:center;">
          <h1 style="color:#D4AF37;margin:0;">Qardan Hasana</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;">
          <h2>Document Uploaded</h2>
          <p><strong>User:</strong> ${data.userName}</p>
          <p><strong>Document Type:</strong> ${data.documentType}</p>
          <p><strong>File:</strong> ${data.fileName}</p>
          <p>Please review and approve or reject this document.</p>
          <p><a href="${data.reviewLink}" style="background:#D4AF37;color:#1B4332;padding:10px 20px;text-decoration:none;border-radius:5px;font-weight:bold;">Review Document</a></p>
        </div>
      </div>`,
  }),
};

const sendEmail = async ({ to, templateName, data, subject, html }) => {
  try {
    if (process.env.NODE_ENV === 'development' && !process.env.SMTP_PASS) {
      logger.info(`[Email Mock] To: ${to}, Subject: ${subject || templateName}`);
      return { success: true, mock: true };
    }

    const t = getTransporter();
    const template = templateName ? emailTemplates[templateName]?.(data) : null;

    await t.sendMail({
      from: `"${process.env.EMAIL_FROM_NAME || 'Qardan Hasana'}" <${process.env.EMAIL_FROM || 'noreply@qardanhasana.com'}>`,
      to,
      subject: template?.subject || subject,
      html: template?.html || html,
    });

    logger.info(`Email sent to ${to}`);
    return { success: true };
  } catch (err) {
    logger.error(`Email failed to ${to}: ${err.message}`);
    return { success: false, error: err.message };
  }
};

module.exports = { sendEmail, emailTemplates };
