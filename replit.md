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
- Activity log tracking
- CSV/JSON file upload for bulk data
- AI-powered performance report generation
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
