-- Qardan Hasana - Seed Data
-- Passwords are all: 'Password@123' (bcrypt hashed)

-- ============================================================
-- SETTINGS
-- ============================================================
INSERT INTO settings (key, value, label, description, category, is_public) VALUES
('currency', 'INR', 'Currency', 'Default currency for all transactions', 'financial', true),
('currency_symbol', '₹', 'Currency Symbol', 'Symbol for default currency', 'financial', true),
('org_name', 'Qardan Hasana', 'Organization Name', 'Name of the organization', 'general', true),
('org_email', 'info@qardanhasana.com', 'Organization Email', 'Primary contact email', 'general', true),
('org_phone', '+91 9000000000', 'Organization Phone', 'Primary contact phone', 'general', true),
('max_loan_amount', '500000', 'Maximum Loan Amount', 'Maximum allowed loan amount', 'financial', false),
('min_loan_amount', '5000', 'Minimum Loan Amount', 'Minimum allowed loan amount', 'financial', false),
('max_installments', '60', 'Maximum Installments', 'Maximum monthly installments allowed', 'financial', false),
('require_guarantor', 'true', 'Require Guarantor', 'Whether loans require a guarantor', 'financial', false),
('notification_email', 'true', 'Email Notifications', 'Send email notifications', 'notifications', false),
('backup_frequency', 'weekly', 'Backup Frequency', 'How often to backup data', 'system', false),
('session_timeout', '3600', 'Session Timeout (seconds)', 'User session timeout in seconds', 'security', false)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- PERMISSIONS
-- ============================================================
INSERT INTO permissions (name, display_name, module, action) VALUES
-- Users
('users.view', 'View Users', 'users', 'view'),
('users.create', 'Create Users', 'users', 'create'),
('users.edit', 'Edit Users', 'users', 'edit'),
('users.delete', 'Delete Users', 'users', 'delete'),
('users.assign_roles', 'Assign Roles', 'users', 'assign_roles'),
-- Profiles
('profiles.view', 'View Profiles', 'profiles', 'view'),
('profiles.create', 'Create Profiles', 'profiles', 'create'),
('profiles.edit', 'Edit Profiles', 'profiles', 'edit'),
-- Loans
('loans.view', 'View Loans', 'loans', 'view'),
('loans.create', 'Create Loans', 'loans', 'create'),
('loans.approve', 'Approve Loans', 'loans', 'approve'),
('loans.edit', 'Edit Loans', 'loans', 'edit'),
-- Transactions
('transactions.view', 'View Transactions', 'transactions', 'view'),
('transactions.create', 'Create Transactions', 'transactions', 'create'),
('transactions.approve', 'Approve Transactions', 'transactions', 'approve'),
('transactions.delete', 'Delete Transactions', 'transactions', 'delete'),
-- Ledger
('ledger.view', 'View Ledger', 'ledger', 'view'),
('ledger.view_all', 'View All Ledgers', 'ledger', 'view_all'),
-- Documents
('documents.view', 'View Documents', 'documents', 'view'),
('documents.upload', 'Upload Documents', 'documents', 'upload'),
('documents.approve', 'Approve Documents', 'documents', 'approve'),
-- Reports
('reports.view', 'View Reports', 'reports', 'view'),
('reports.audit', 'View Audit Logs', 'reports', 'audit'),
-- Approvals
('approvals.view', 'View Approvals', 'approvals', 'view'),
('approvals.process', 'Process Approvals', 'approvals', 'process'),
-- Settings
('settings.view', 'View Settings', 'settings', 'view'),
('settings.edit', 'Edit Settings', 'settings', 'edit'),
-- RBAC
('rbac.manage', 'Manage RBAC', 'rbac', 'manage'),
-- Backup
('backup.create', 'Create Backup', 'backup', 'create')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ROLES
-- ============================================================
INSERT INTO roles (name, display_name, description, is_system) VALUES
('admin', 'Administrator', 'Full system access with all permissions', true),
('accountant', 'Accountant', 'Can manage accounts, transactions, and approvals', true),
('member', 'Member', 'Regular member with basic access', true),
('creditor', 'Creditor', 'Can view creditor dashboard and ledger', true),
('debtor', 'Debtor', 'Can view loan status and make repayments', true),
('viewer', 'Viewer', 'Read-only access to basic information', true)
ON CONFLICT (name) DO NOTHING;

-- Assign all permissions to admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Assign accountant permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'accountant'
  AND p.name IN (
    'users.view', 'profiles.view', 'profiles.create', 'profiles.edit',
    'loans.view', 'loans.approve', 'loans.edit',
    'transactions.view', 'transactions.create', 'transactions.approve', 'transactions.delete',
    'ledger.view', 'ledger.view_all',
    'documents.view', 'documents.approve',
    'reports.view', 'reports.audit',
    'approvals.view', 'approvals.process',
    'settings.view'
  )
ON CONFLICT DO NOTHING;

-- Assign member permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'member'
  AND p.name IN (
    'loans.view', 'loans.create',
    'transactions.view', 'transactions.create',
    'ledger.view',
    'documents.upload', 'documents.view',
    'profiles.view'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- USERS (password: Password@123)
-- ============================================================
INSERT INTO users (id, its_number, email, password_hash, first_name, last_name, phone, gender, city, country, is_active, is_email_verified)
VALUES
  ('11111111-1111-1111-1111-111111111111', '10000001', 'admin@qardanhasana.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Admin', 'User', '+91 9000000001', 'male', 'Mumbai', 'India', true, true),
  ('22222222-2222-2222-2222-222222222222', '10000002', 'accountant@qardanhasana.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Yusuf', 'Bhaisaheb', '+91 9000000002', 'male', 'Mumbai', 'India', true, true),
  ('33333333-3333-3333-3333-333333333333', '10000003', 'creditor1@example.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Ibrahim', 'Rangwala', '+91 9000000003', 'male', 'Mumbai', 'India', true, true),
  ('44444444-4444-4444-4444-444444444444', '10000004', 'debtor1@example.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Murtaza', 'Kapasi', '+91 9000000004', 'male', 'Pune', 'India', true, true),
  ('55555555-5555-5555-5555-555555555555', '10000005', 'debtor2@example.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Zainab', 'Noorani', '+91 9000000005', 'female', 'Surat', 'India', true, true),
  ('66666666-6666-6666-6666-666666666666', '10000006', 'creditor2@example.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Taher', 'Badri', '+91 9000000006', 'male', 'Hyderabad', 'India', true, true),
  ('77777777-7777-7777-7777-777777777777', '10000007', 'member1@example.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Fatema', 'Shergadwala', '+91 9000000007', 'female', 'Bangalore', 'India', true, true),
  ('88888888-8888-8888-8888-888888888888', '10000008', 'debtor3@example.com',
   '$2a$12$LXNFcM5aNYJaFSe1Gs0/ue3MsHBTlYFR7iN5bFUVhF9H8rLQPsmIC',
   'Hussain', 'Mandsaurwala', '+91 9000000008', 'male', 'Chennai', 'India', true, true)
ON CONFLICT (its_number) DO NOTHING;

-- ============================================================
-- USER ROLES
-- ============================================================
INSERT INTO user_roles (user_id, role_id)
SELECT '11111111-1111-1111-1111-111111111111', id FROM roles WHERE name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '22222222-2222-2222-2222-222222222222', id FROM roles WHERE name = 'accountant'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM roles WHERE name = 'creditor'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '33333333-3333-3333-3333-333333333333', id FROM roles WHERE name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM roles WHERE name = 'debtor'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '44444444-4444-4444-4444-444444444444', id FROM roles WHERE name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '55555555-5555-5555-5555-555555555555', id FROM roles WHERE name = 'debtor'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '55555555-5555-5555-5555-555555555555', id FROM roles WHERE name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '66666666-6666-6666-6666-666666666666', id FROM roles WHERE name = 'creditor'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '77777777-7777-7777-7777-777777777777', id FROM roles WHERE name = 'member'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT '88888888-8888-8888-8888-888888888888', id FROM roles WHERE name = 'debtor'
ON CONFLICT DO NOTHING;

-- ============================================================
-- CREDITOR PROFILES
-- ============================================================
INSERT INTO creditor_profiles (id, user_id, creditor_number, credit_limit, available_credit, total_given, total_recovered, outstanding_amount, status, created_by)
VALUES
  ('cc111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'CR00000001', 1000000, 600000, 400000, 200000, 200000, 'active', '11111111-1111-1111-1111-111111111111'),
  ('cc222222-2222-2222-2222-222222222222', '66666666-6666-6666-6666-666666666666', 'CR00000002', 500000, 350000, 150000, 75000, 75000, 'active', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DEBTOR PROFILES
-- ============================================================
INSERT INTO debtor_profiles (id, user_id, debtor_number, total_borrowed, total_repaid, outstanding_balance, overdue_amount, credit_score, status, created_by)
VALUES
  ('dd111111-1111-1111-1111-111111111111', '44444444-4444-4444-4444-444444444444', 'DB00000001', 150000, 50000, 100000, 0, 85, 'active', '11111111-1111-1111-1111-111111111111'),
  ('dd222222-2222-2222-2222-222222222222', '55555555-5555-5555-5555-555555555555', 'DB00000002', 200000, 120000, 80000, 15000, 72, 'active', '11111111-1111-1111-1111-111111111111'),
  ('dd333333-3333-3333-3333-333333333333', '88888888-8888-8888-8888-888888888888', 'DB00000003', 80000, 20000, 60000, 5000, 65, 'active', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ============================================================
-- GUARANTOR PROFILES
-- ============================================================
INSERT INTO guarantor_profiles (id, user_id, guarantor_number, total_guaranteed, active_guarantees, status, created_by)
VALUES
  ('a0111111-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777', 'GR00000001', 150000, 1, 'active', '11111111-1111-1111-1111-111111111111')
ON CONFLICT DO NOTHING;

-- ============================================================
-- LOANS
-- ============================================================
INSERT INTO loans (id, loan_number, debtor_id, creditor_id, principal_amount, outstanding_balance,
  first_installment_date, monthly_installment, total_installments, paid_installments,
  security_description, purpose, status, approved_by, approved_at, next_due_date,
  last_payment_date, is_overdue, created_by)
VALUES
  ('b0111111-1111-1111-1111-111111111111', 'LN00000001',
   'dd111111-1111-1111-1111-111111111111', 'cc111111-1111-1111-1111-111111111111',
   150000, 100000, '2024-01-01', 5000, 30, 10,
   'Gold jewelry worth INR 200,000', 'Medical expenses',
   'active', '11111111-1111-1111-1111-111111111111', '2024-01-01',
   '2025-05-01', '2025-04-01', false, '22222222-2222-2222-2222-222222222222'),
  ('b0222222-2222-2222-2222-222222222222', 'LN00000002',
   'dd222222-2222-2222-2222-222222222222', 'cc111111-1111-1111-1111-111111111111',
   200000, 80000, '2024-03-01', 8000, 25, 15,
   'Property documents', 'Business expansion',
   'active', '11111111-1111-1111-1111-111111111111', '2024-03-01',
   '2025-05-01', '2025-02-01', true, '22222222-2222-2222-2222-222222222222'),
  ('b0333333-3333-3333-3333-333333333333', 'LN00000003',
   'dd333333-3333-3333-3333-333333333333', 'cc222222-2222-2222-2222-222222222222',
   80000, 60000, '2024-06-01', 4000, 20, 5,
   'Vehicle RC', 'Education fees',
   'active', '11111111-1111-1111-1111-111111111111', '2024-06-01',
   '2025-05-01', '2025-04-01', false, '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ============================================================
-- LOAN GUARANTORS
-- ============================================================
INSERT INTO loan_guarantors (loan_id, guarantor_profile_id, name, its_number, phone, address, email, relationship)
VALUES
  ('b0111111-1111-1111-1111-111111111111', 'a0111111-1111-1111-1111-111111111111',
   'Fatema Shergadwala', '10000007', '+91 9000000007',
   '123 Main Street, Andheri, Mumbai 400053', 'member1@example.com', 'Friend'),
  ('b0222222-2222-2222-2222-222222222222', NULL,
   'Hussain Abdulkadar', '10000099', '+91 9000000099',
   '456 Park Road, Bandra, Mumbai 400050', 'hussain.ak@example.com', 'Brother'),
  ('b0333333-3333-3333-3333-333333333333', NULL,
   'Arwa Bhagat', '10000088', '+91 9000000088',
   '789 Lake View, Juhu, Mumbai 400049', 'arwa.b@example.com', 'Spouse')
ON CONFLICT DO NOTHING;

-- ============================================================
-- TRANSACTIONS
-- ============================================================
INSERT INTO transactions (id, transaction_number, type, amount, currency, description,
  from_account_id, to_account_id, loan_id, status, approved_by, approved_at,
  transaction_date, value_date, created_by)
VALUES
  ('c0111111-1111-1111-1111-111111111111', 'TXN00000001', 'loan_disbursement', 150000, 'INR',
   'Loan disbursement for LN00000001',
   '33333333-3333-3333-3333-333333333333', '44444444-4444-4444-4444-444444444444',
   'b0111111-1111-1111-1111-111111111111',
   'completed', '22222222-2222-2222-2222-222222222222', '2024-01-01 10:00:00',
   '2024-01-01 10:00:00', '2024-01-01', '22222222-2222-2222-2222-222222222222'),
  ('c0222222-2222-2222-2222-222222222222', 'TXN00000002', 'loan_repayment', 5000, 'INR',
   'Monthly repayment Jan 2024',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'b0111111-1111-1111-1111-111111111111',
   'completed', '22222222-2222-2222-2222-222222222222', '2024-01-31 10:00:00',
   '2024-01-31 10:00:00', '2024-01-31', '44444444-4444-4444-4444-444444444444'),
  ('c0333333-3333-3333-3333-333333333333', 'TXN00000003', 'loan_repayment', 5000, 'INR',
   'Monthly repayment Feb 2024',
   '44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333',
   'b0111111-1111-1111-1111-111111111111',
   'completed', '22222222-2222-2222-2222-222222222222', '2024-03-01 10:00:00',
   '2024-03-01 10:00:00', '2024-03-01', '44444444-4444-4444-4444-444444444444'),
  ('c0444444-4444-4444-4444-444444444444', 'TXN00000004', 'loan_disbursement', 200000, 'INR',
   'Loan disbursement for LN00000002',
   '33333333-3333-3333-3333-333333333333', '55555555-5555-5555-5555-555555555555',
   'b0222222-2222-2222-2222-222222222222',
   'completed', '22222222-2222-2222-2222-222222222222', '2024-03-05 10:00:00',
   '2024-03-05 10:00:00', '2024-03-05', '22222222-2222-2222-2222-222222222222'),
  ('c0555555-5555-5555-5555-555555555555', 'TXN00000005', 'loan_repayment', 8000, 'INR',
   'Monthly repayment - March 2025',
   '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
   'b0222222-2222-2222-2222-222222222222',
   'completed', '22222222-2222-2222-2222-222222222222', '2025-03-01 10:00:00',
   '2025-03-01 10:00:00', '2025-03-01', '55555555-5555-5555-5555-555555555555'),
  ('c0666666-6666-6666-6666-666666666666', 'TXN00000006', 'loan_repayment', 8000, 'INR',
   'Monthly repayment - April 2025',
   '55555555-5555-5555-5555-555555555555', '33333333-3333-3333-3333-333333333333',
   'b0222222-2222-2222-2222-222222222222',
   'pending', NULL, NULL,
   '2025-04-01 10:00:00', '2025-04-01', '55555555-5555-5555-5555-555555555555')
ON CONFLICT DO NOTHING;

-- ============================================================
-- LEDGER ENTRIES
-- ============================================================
INSERT INTO ledger_entries (user_id, transaction_id, loan_id, entry_type, amount, currency, balance_after, description, reference, created_by)
VALUES
  ('33333333-3333-3333-3333-333333333333', 'c0111111-1111-1111-1111-111111111111', 'b0111111-1111-1111-1111-111111111111',
   'debit', 150000, 'INR', -150000, 'Loan disbursement to Murtaza Kapasi', 'TXN00000001', '22222222-2222-2222-2222-222222222222'),
  ('44444444-4444-4444-4444-444444444444', 'c0111111-1111-1111-1111-111111111111', 'b0111111-1111-1111-1111-111111111111',
   'credit', 150000, 'INR', 150000, 'Loan received from Ibrahim Rangwala', 'TXN00000001', '22222222-2222-2222-2222-222222222222'),
  ('44444444-4444-4444-4444-444444444444', 'c0222222-2222-2222-2222-222222222222', 'b0111111-1111-1111-1111-111111111111',
   'debit', 5000, 'INR', 145000, 'Repayment Jan 2024', 'TXN00000002', '22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333', 'c0222222-2222-2222-2222-222222222222', 'b0111111-1111-1111-1111-111111111111',
   'credit', 5000, 'INR', -145000, 'Repayment received from Murtaza', 'TXN00000002', '22222222-2222-2222-2222-222222222222'),
  ('33333333-3333-3333-3333-333333333333', 'c0444444-4444-4444-4444-444444444444', 'b0222222-2222-2222-2222-222222222222',
   'debit', 200000, 'INR', -345000, 'Loan disbursement to Zainab Noorani', 'TXN00000004', '22222222-2222-2222-2222-222222222222'),
  ('55555555-5555-5555-5555-555555555555', 'c0444444-4444-4444-4444-444444444444', 'b0222222-2222-2222-2222-222222222222',
   'credit', 200000, 'INR', 200000, 'Loan received', 'TXN00000004', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

-- ============================================================
-- APPROVALS (pending ones for demo)
-- ============================================================
INSERT INTO approvals (reference_type, reference_id, title, description, requested_by, priority, status)
VALUES
  ('transaction', 'c0666666-6666-6666-6666-666666666666',
   'Transaction TXN00000006 Approval',
   'Monthly repayment of INR 8,000 by Zainab Noorani',
   '55555555-5555-5555-5555-555555555555', 'normal', 'pending'),
  ('user_profile', '77777777-7777-7777-7777-777777777777',
   'Profile Update Request - Fatema Shergadwala',
   'User 10000007 has requested profile changes',
   '77777777-7777-7777-7777-777777777777', 'normal', 'pending')
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUDIT LOGS
-- ============================================================
INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'LOGIN', 'user', '11111111-1111-1111-1111-111111111111', '127.0.0.1', 'success'),
  ('22222222-2222-2222-2222-222222222222', 'LOGIN', 'user', '22222222-2222-2222-2222-222222222222', '127.0.0.1', 'success'),
  ('22222222-2222-2222-2222-222222222222', 'LOAN_CREATED', 'loan', 'b0111111-1111-1111-1111-111111111111', '127.0.0.1', 'success'),
  ('22222222-2222-2222-2222-222222222222', 'TRANSACTION_CREATED', 'transaction', 'c0111111-1111-1111-1111-111111111111', '127.0.0.1', 'success'),
  ('44444444-4444-4444-4444-444444444444', 'LOGIN', 'user', '44444444-4444-4444-4444-444444444444', '192.168.1.1', 'success'),
  ('55555555-5555-5555-5555-555555555555', 'TRANSACTION_CREATED', 'transaction', 'c0666666-6666-6666-6666-666666666666', '192.168.1.2', 'success')
ON CONFLICT DO NOTHING;

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
INSERT INTO notifications (user_id, title, message, type, category, is_read)
VALUES
  ('44444444-4444-4444-4444-444444444444', 'Loan Approved', 'Your loan LN00000001 for INR 1,50,000 has been approved.', 'success', 'loan', true),
  ('55555555-5555-5555-5555-555555555555', 'Payment Due', 'Your installment of INR 8,000 is due on 2025-05-01.', 'warning', 'loan', false),
  ('55555555-5555-5555-5555-555555555555', 'Overdue Notice', 'Your loan LN00000002 has an overdue amount of INR 15,000.', 'error', 'loan', false),
  ('22222222-2222-2222-2222-222222222222', 'Pending Approval', 'You have 2 items pending approval.', 'info', 'approval', false),
  ('11111111-1111-1111-1111-111111111111', 'New User Registered', 'New user Fatema Shergadwala has joined the system.', 'info', 'user', true)
ON CONFLICT DO NOTHING;
