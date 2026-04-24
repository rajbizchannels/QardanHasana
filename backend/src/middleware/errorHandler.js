const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ success: false, message: 'File too large. Maximum size is 10MB.' });
  }

  if (err.message?.includes('Only PDF, JPG, and PNG')) {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Record already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record not found' });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
};

const notFound = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
};

module.exports = { errorHandler, notFound };
