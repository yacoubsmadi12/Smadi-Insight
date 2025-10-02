# Smadi Insight - Employee Management System

## Overview
A full-stack employee management and monitoring system with AI-powered reporting capabilities. The application provides employee tracking, activity logging, and automated performance reports using Google's Gemini AI.

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
