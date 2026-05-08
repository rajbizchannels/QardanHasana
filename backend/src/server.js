require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const logger = require('./utils/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting — relaxed in development to avoid blocking during testing
const isDev = process.env.NODE_ENV !== 'production';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 1000 : 100,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDev ? 100 : 10,
  message: { success: false, message: 'Too many authentication attempts.' },
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// Static files for uploads (authenticated via routes)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// API routes
app.use('/api', routes);

// Run migrations on startup
const { query: dbQuery } = require('./config/database');
(async () => {
  const migrations = [
    `ALTER TABLE creditor_profiles ADD COLUMN IF NOT EXISTS deposit_maturity_date DATE`,
    `CREATE TABLE IF NOT EXISTS creditor_deposits (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      creditor_id UUID NOT NULL REFERENCES creditor_profiles(id) ON DELETE CASCADE,
      amount NUMERIC(15,2) NOT NULL,
      deposit_date DATE NOT NULL DEFAULT CURRENT_DATE,
      maturity_date DATE NOT NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'matured', 'returned')),
      notes TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    `CREATE INDEX IF NOT EXISTS idx_creditor_deposits_creditor ON creditor_deposits(creditor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_creditor_deposits_maturity ON creditor_deposits(maturity_date) WHERE status = 'active'`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20)`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb`,
    `ALTER TABLE creditor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE debtor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE guarantor_profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `INSERT INTO roles (name, display_name, description, is_system) VALUES ('guarantor', 'Guarantor', 'Can act as guarantor for loans', true) ON CONFLICT (name) DO NOTHING`,
    `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS maturity_date DATE`,
    `ALTER TABLE creditor_deposits ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL`,
    `CREATE INDEX IF NOT EXISTS idx_creditor_deposits_transaction ON creditor_deposits(transaction_id) WHERE transaction_id IS NOT NULL`,
  ];
  for (const sql of migrations) {
    try { await dbQuery(sql); } catch (e) { console.warn('Migration warning:', e.message); }
  }
})();

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// 404 and error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Qardan Hasana API server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = app;
