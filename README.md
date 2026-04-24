# Qardan Hasana — Cash Management Accounting System

A comprehensive, bank-grade cash management system for Qardan Hasana (interest-free community lending).

## Features

- **Role-Based Access Control (RBAC)** — Admin, Accountant, Member, Creditor, Debtor, Viewer roles with granular permissions
- **User Profiles** — Personal, Debtor, Creditor, and Guarantor tabs per user
- **Loan Applications** — With guarantors (Name, ITS, Phone, Address, Email), security, installment scheduling
- **Document Management** — PDF/JPG/PNG uploads with accountant approval workflow
- **Ledger Tracking** — Full double-entry ledger for every user
- **Transaction Management** — Create/Approve/Delete with admin workflow
- **Approval Workflow** — All critical actions require admin/accountant approval
- **Reports** — Cash status, recent collections, overdue accounts, dues this cycle
- **Audit Logs** — Full trail of every system action
- **Email Notifications** — For all key events
- **Google Drive Backup** — Encrypted data backup
- **Password Reset** — Secure token-based reset

## Tech Stack

- **Frontend:** React 18, Vite, Tailwind CSS, Redux Toolkit, Recharts
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL (UUID-based)
- **Auth:** JWT with refresh tokens, bcrypt password hashing

## Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+

### Environment Setup
```bash
cd backend
cp .env.example .env
# Edit .env with your database and SMTP credentials
```

### Database Setup
```bash
# Create database
createdb qardan_hasana

# Run migrations
cd backend && npm run db:migrate

# Seed demo data
cd backend && npm run db:seed
```

### Install & Run
```bash
# Install all dependencies
npm run install:all

# Start backend (port 5000)
npm run dev:backend

# Start frontend (port 3000)
npm run dev:frontend
```

## Demo Credentials

| Role       | ITS Number | Password      |
|------------|------------|---------------|
| Admin      | 10000001   | Password@123  |
| Accountant | 10000002   | Password@123  |
| Creditor   | 10000003   | Password@123  |
| Debtor     | 10000004   | Password@123  |
| Debtor     | 10000005   | Password@123  |
| Member     | 10000007   | Password@123  |

## Architecture

```
qardan-hasana/
├── backend/              # Node.js/Express API
│   ├── src/
│   │   ├── config/       # DB, migrations, seed
│   │   ├── controllers/  # Business logic
│   │   ├── middleware/   # Auth, RBAC, upload, error
│   │   ├── routes/       # API routes
│   │   └── utils/        # Logger, email, audit
│   └── uploads/          # Uploaded files
├── frontend/             # React SPA
│   └── src/
│       ├── components/   # Shared components
│       ├── pages/        # All page components
│       ├── store/        # Redux state
│       └── utils/        # API client, helpers
└── database/
    ├── schema.sql        # Full DB schema
    └── seed.sql          # Demo data
```
