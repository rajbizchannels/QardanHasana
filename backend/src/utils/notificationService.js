const { query } = require('../config/database');
const { sendEmail } = require('./email');
const logger = require('./logger');

// Canonical notification types and their display info
const NOTIFICATION_TYPES = {
  loan_status:        { label: 'Loan Status Updates',       defaultEmail: true,  defaultInApp: true  },
  transaction_posted: { label: 'Transaction Notifications', defaultEmail: true,  defaultInApp: true  },
  document_reviewed:  { label: 'Document Review Results',   defaultEmail: true,  defaultInApp: true  },
  profile_reviewed:   { label: 'Profile Change Results',    defaultEmail: true,  defaultInApp: true  },
  payment_due:        { label: 'Payment Due Reminders',     defaultEmail: true,  defaultInApp: true  },
  deposit_maturity:   { label: 'Deposit Maturity Alerts',   defaultEmail: true,  defaultInApp: true  },
  account_activity:   { label: 'General Account Activity',  defaultEmail: false, defaultInApp: true  },
};

module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

/**
 * Send a notification to a user, respecting their preferences.
 * @param {object} opts
 * @param {string} opts.userId
 * @param {string} opts.type        - key from NOTIFICATION_TYPES
 * @param {string} opts.title
 * @param {string} opts.message
 * @param {string} [opts.notifType] - 'info'|'success'|'warning'|'error'
 * @param {string} [opts.category]
 * @param {string} [opts.referenceType]
 * @param {string} [opts.referenceId]
 * @param {string} [opts.emailTemplate]
 * @param {object} [opts.emailData]
 */
async function notify(opts) {
  const {
    userId, type, title, message,
    notifType = 'info', category, referenceType, referenceId,
    emailTemplate, emailData,
  } = opts;

  try {
    const userRes = await query(
      `SELECT email, notification_preferences FROM users WHERE id = $1 AND is_active = TRUE`,
      [userId]
    );
    if (!userRes.rows[0]) return;

    const { email, notification_preferences } = userRes.rows[0];
    const prefs = notification_preferences || {};
    const typeDef = NOTIFICATION_TYPES[type] || { defaultEmail: true, defaultInApp: true };

    const inAppEnabled = prefs[type]?.in_app ?? typeDef.defaultInApp;
    const emailEnabled = prefs[type]?.email ?? typeDef.defaultEmail;

    if (inAppEnabled) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type, category, reference_type, reference_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, title, message, notifType, category || type, referenceType || null, referenceId || null]
      );
    }

    if (emailEnabled && emailTemplate && email) {
      await sendEmail({ to: email, templateName: emailTemplate, data: emailData });
    } else if (emailEnabled && email && !emailTemplate) {
      await sendEmail({ to: email, subject: title, html: `<p>${message}</p>` });
    }
  } catch (err) {
    logger.error(`notificationService.notify failed for user ${userId}: ${err.message}`);
  }
}

module.exports.notify = notify;
