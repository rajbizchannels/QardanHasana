const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const audit = require('../utils/audit');

const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

exports.getAuthUrl = async (req, res) => {
  try {
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
    });
    res.json({ success: true, data: { url } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.oauth2Callback = async (req, res) => {
  try {
    const { code } = req.query;
    const oauth2Client = getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    // In production, store tokens securely in DB
    res.redirect(`${process.env.FRONTEND_URL}/settings?backup=connected`);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBackup = async (req, res) => {
  try {
    const { googleTokens } = req.body;
    const client = await pool.connect();

    // Export key tables as JSON
    const tables = ['users', 'loans', 'transactions', 'ledger_entries', 'creditor_profiles', 'debtor_profiles'];
    const backupData = {};

    for (const table of tables) {
      const result = await client.query(`SELECT * FROM ${table}`);
      backupData[table] = result.rows;
    }
    client.release();

    const backupJson = JSON.stringify(backupData, null, 2);
    const backupFileName = `qardan_hasana_backup_${new Date().toISOString().split('T')[0]}.json`;
    const backupPath = path.join('/tmp', backupFileName);
    fs.writeFileSync(backupPath, backupJson);

    if (googleTokens) {
      const oauth2Client = getOAuth2Client();
      oauth2Client.setCredentials(googleTokens);
      const drive = google.drive({ version: 'v3', auth: oauth2Client });

      const fileMetadata = {
        name: backupFileName,
        parents: process.env.GOOGLE_DRIVE_FOLDER_ID ? [process.env.GOOGLE_DRIVE_FOLDER_ID] : undefined,
      };
      const media = { mimeType: 'application/json', body: fs.createReadStream(backupPath) };

      const driveFile = await drive.files.create({ resource: fileMetadata, media, fields: 'id,name,webViewLink' });
      fs.unlinkSync(backupPath);

      await audit({ userId: req.user.id, action: 'BACKUP_CREATED', entityType: 'backup', newValues: { destination: 'google_drive', fileId: driveFile.data.id }, ipAddress: req.ip });
      return res.json({ success: true, data: { fileId: driveFile.data.id, fileName: driveFile.data.name, link: driveFile.data.webViewLink } });
    }

    // Return local backup if no Google tokens
    res.setHeader('Content-Disposition', `attachment; filename="${backupFileName}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(backupJson);
    fs.unlinkSync(backupPath);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
