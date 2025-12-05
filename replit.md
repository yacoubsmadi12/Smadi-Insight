# Tracer Logs Zain - Employee Management System

## Overview
A full-stack employee management and monitoring system with AI-powered reporting capabilities. The application provides employee tracking, activity logging, and automated performance reports using Google's Gemini AI. The application features a dark, eagle-themed design with amber/gold accent colors representing vigilant observation ("Eyes That Never Sleep").

## Tech Stack
- **Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL (Neon)
- **ORM**: Drizzle ORM
- **AI**: Google Gemini AI
- **Authentication**: JWT with bcrypt password hashing

## Project Structure
- `/client` - React frontend application
- `/server` - Express backend server
- `/shared` - Shared TypeScript types and schemas
- `/attached_assets` - Static assets

## Database Schema
- **users** - User authentication and roles
- **employees** - Employee records with job details
- **logs** - Activity logs for employees
- **reports** - AI-generated performance reports

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (configured)
- `GEMINI_API_KEY` - Google Gemini API key (optional, required for AI reports)
- `PORT` - Server port (default: 5000)

## Features
- User authentication (login/register)
- Employee management (CRUD operations)
  - Add/Edit employee dialog with comprehensive form
  - Automatic AI report generation on employee create/update
  - Job description and rules tracking
- Activity log tracking
- CSV/JSON file upload for bulk data
- AI-powered performance report generation (automatic & manual)
- Multi-language support (English/Arabic)
- Dark mode support

## Running the Application
The application runs on port 5000 with both frontend and backend served together.

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run start
```

### Database Migrations
```bash
npm run db:push
```

## Key Routes
- `/` - Login page
- `/register` - User registration
- `/dashboard` - Main dashboard
- `/employees` - Employee list
- `/employees/:id` - Employee details
- `/logs` - Activity logs
- `/reports` - Performance reports
- `/settings` - Application settings

## Notes
- The Vite dev server is configured with `allowedHosts: true` for Replit proxy compatibility
- Server binds to `0.0.0.0:5000` for proper external access
- Database schema is managed via Drizzle ORM, no manual migrations needed
- AI report generation requires GEMINI_API_KEY to be set
- Dashboard automatically refreshes every 10 seconds to show updated statistics
- After uploading logs, the dashboard cache is automatically invalidated to show new data immediately
- Employee dialog automatically triggers AI report generation when job description is added/updated
- All mutations properly invalidate employees, stats, and reports caches for instant UI updates
- Backend validates all employee data with Zod schemas before database operations

## Recent Changes (October 1, 2025)
- ✅ Employee template/form feature implemented with EmployeeDialog component
- ✅ Add/Edit functionality for employees with comprehensive form fields
- ✅ Automatic AI report generation on employee create/update
- ✅ Backend Zod validation for all employee mutations
- ✅ Proper cache invalidation for employees, stats, and reports
- ✅ GEMINI_API_KEY validation with clear error messages

## Replit Setup Complete (October 2, 2025)
- ✅ GitHub repository imported successfully
- ✅ Node.js dependencies installed (npm install)
- ✅ PostgreSQL database provisioned and schema migrated via Drizzle
- ✅ Workflow configured for port 5000 with webview output type
- ✅ Deployment configured for autoscale with build and start commands
- ✅ Application tested and verified running on port 5000
- ✅ Frontend loads correctly with login page
- ✅ Vite dev server configured with allowedHosts for Replit proxy
- ✅ Server binds to 0.0.0.0:5000 for external access

## UI Redesign (November 30, 2025)
- ✅ Rebranded from "Smadi Insight" to "Tracer Logs Zain"
- ✅ New dark/black color scheme with amber/gold and cyan accent colors
- ✅ Eagle-themed design with custom SVG eagle icon component
- ✅ Glassmorphism card design with subtle glow effects
- ✅ Background eagle silhouettes with slow pulse animation
- ✅ Redesigned login page (registration removed)
- ✅ Updated translations for both English and Arabic
- ✅ New tagline: "Eyes That Never Sleep" (عيون لا تنام)
- ✅ Single admin login: username "admin", password "admin123"
- ✅ Database connected for storing API data and file uploads

## Migration to Replit (December 2, 2025)
- ✅ Project migrated from MySQL to PostgreSQL (Replit only supports PostgreSQL)
- ✅ Database schema converted using Drizzle ORM with pg-core
- ✅ Neon serverless driver configured for PostgreSQL connection
- ✅ All database tables recreated and admin user seeded
- ✅ Application verified working with login functionality
- ✅ Fixed ISO-8601 timestamp parsing in Huawei log parser (supports formats like '2025-12-01T00:15:32.000Z')
- ✅ Added NMS system name to analysis reports (HTML/JSON) with security sanitization
- ✅ Security: HTML escaping for XSS prevention, filename sanitization for header injection prevention

## Default Login Credentials
- **Username:** admin
- **Password:** admin123

## MySQL Compatibility Fix (December 2, 2025)
- ✅ Added timestamp format helper for MySQL compatibility
- ✅ Updated Huawei log parser to filter non-timestamp strings (PORT=, HOLDTIME=, etc.)
- ✅ MySQL now accepts timestamps in YYYY-MM-DD HH:MM:SS format
- ✅ PostgreSQL continues to work with native Date objects

### For Ubuntu/MySQL Server Users:
To use MySQL instead of PostgreSQL, set the environment variable:
```bash
export DB_DIALECT=mysql
```

Or configure your db.ts file for MySQL:
```typescript
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
const pool = mysql.createPool(process.env.DATABASE_URL!);
export const db = drizzle(pool, { schema });
```

## NMS Log Monitoring Features (December 2, 2025)
- ✅ Enhanced Dashboard with real-time KPIs and analytics
  - Operations activity chart (24-hour view)
  - Success/failure pie chart distribution
  - NMS systems status overview
  - Top operations with success rates
  - Recent activity log viewer
- ✅ Syslog server (UDP port 514) auto-creates NMS systems per source IP
- ✅ NMS Systems management with connection type badges (Manual/Syslog)
- ✅ Analysis Reports accessible from NMS system cards
- ✅ Database management in Settings page
  - View database statistics (NMS data, legacy data)
  - Clear all NMS data with confirmation dialog
  - Clear all legacy data with confirmation dialog
  - System information (CPU, memory, uptime)
- ✅ Back navigation arrows for improved UX

## Email Settings & Scheduled Reports (December 3, 2025)
- ✅ Email server configuration with SMTP settings (nodemailer)
- ✅ Real SMTP connection testing using nodemailer.createTransport().verify()
- ✅ TLS/SSL support with authentication
- ✅ Scheduled reports CRUD (weekly/monthly/quarterly frequencies)
- ✅ Report types: violations, operations, summary, full
- ✅ Field mapping: frontend `recipients` → backend `recipientEmails`
- ✅ Admin email recipients management
- ✅ Test data: 500 logs from 10 NMS sources, 184 violations, 75 failed operations

## Advanced Telecom Log Parser (December 3, 2025)
- Multi-source parsing from 20+ NMS systems
- Supports Huawei, Cisco, Linux, Windows, and generic syslog formats
- Automatic violation detection:
  - Deletion Operations (DEL-ONT, DEL-ONTPORT, etc.)
  - Failed Operations (DENY responses)
  - User Management (ADD-USER, DEL-USER, MOD-USER)
  - System Critical Operations (SYS-UPGRADE, SYS-REBOOT)
  - Configuration Restore operations
  - High Risk operations (DEACT-ONT, MOD-ONTPROFILE)
- Operator tracking with terminal IP addresses
- Realistic log simulation for testing

## NMS Source Configurations (December 5, 2025)
The system now supports source-based parsing with per-source configurations:

### Configured Sources:
1. **NCE IP+T Huawei** - IPs: 10.119.19.70, 10.119.19.71, 10.119.19.72
   - Blocked operators: kazema, IntegTeamAPIUser
   - 147 users with role definitions
   
2. **NCE FAN Huawei** - IPs: 10.119.19.89, 10.119.19.87, 10.119.19.90
   - Blocked operators: kazema, IntegTeamAPIUser
   - Role-based violation detection
   
3. **Radio U2020 Huawei** - IP: 10.119.10.4
   - MML commands treated as normal (except for read-only roles)
   - Read-only roles: Guests, Performance, Monitoring Group, etc.
   
4. **Core U2020 Huawei** - IP: 10.253.124.169
   - MML commands treated as normal (except for read-only roles)
   - Same role structure as Radio U2020
   
5. **PRS Huawei** - IP: 10.119.10.104
   - Statistics machine - all logs treated as normal
   - No violation detection
   
6. **NetEco Huawei** - Manual upload source
   - Role-based parsing for manual log uploads
   - Read-only roles: Read only, TascTowers, Tasc-Towers-ObjectOriented

### Violation Detection Logic:
- Blocked operators are always flagged regardless of operation
- Read-only roles performing write/MML operations trigger violations
- User management operations require canManageUsers permission
- Unknown roles are flagged as violations

### Configuration Files:
- `/server/source-configs/types.ts` - Shared type definitions
- `/server/source-configs/index.ts` - Source config registry and violation detection
- `/server/source-configs/*.ts` - Individual source configurations

## API Endpoints
- `GET /api/dashboard/stats` - Enhanced dashboard statistics with hourly/daily activity
- `GET /api/dashboard/violations` - List of violations with operator details
- `GET /api/dashboard/operator-stats` - Operator statistics with violation counts
- `GET /api/admin/db-stats` - Database record counts for all tables
- `DELETE /api/admin/clear-nms-data` - Clear all NMS-related data
- `DELETE /api/admin/clear-legacy-data` - Clear all legacy employee data
- `GET /api/system/info` - Server resource monitoring
- `POST /api/telecom/simulate` - Simulate telecom logs from multiple sources
- `GET/POST /api/email-settings` - Email server configuration
- `GET/POST/DELETE /api/scheduled-reports` - Scheduled reports management
