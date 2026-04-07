<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# FUTAConnect

**A campus social and matching platform for students of the Federal University of Technology Akure (FUTA).**

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)

</div>

## Overview

FUTAConnect helps FUTA students discover each other, express interest, and connect through real-time chat. Students create a profile with their department, academic level, interests, and a short bio. They can then browse other students, like the ones they find interesting, and chat with mutual matches — all in one place.

## Features

- 🔍 **Discovery** — Browse student profiles filtered by department, level, and shared interests
- ❤️ **Interest System** — Express interest in other students; see who has shown interest in you
- 🤝 **Mutual Matching** — A match is only created when both students show interest in each other
- 💬 **Real-time Chat** — Message your matches instantly with live updates powered by Supabase Realtime
- 🤖 **AI-Powered Bios** — Generate a profile bio with Google Gemini AI
- 🖼️ **Avatar Uploads** — Upload a profile picture stored securely in Supabase Storage
- 🔒 **Authentication** — Email/password sign-up and login via Supabase Auth
- 📱 **Responsive Design** — Mobile-first UI built with Tailwind CSS

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS v4, Motion (Framer Motion) |
| Routing | React Router v7 |
| Backend / BaaS | Supabase (Auth, PostgreSQL, Realtime, Storage) |
| AI | Google Gemini API (`@google/genai`) |
| Server | Express (API proxy, served via `server.ts`) |
| Deployment | Vercel |

## Prerequisites

- [Node.js](https://nodejs.org) v18 or later
- A [Supabase](https://supabase.com) project
- A [Google Gemini API key](https://ai.google.dev/gemini-api/docs/api-key)

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous (public) API key |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `APP_URL` | The URL where the app is hosted (optional for local dev) |

### 3. Set up the database

Run the SQL in [`supabase_schema.sql`](supabase_schema.sql) in your Supabase project's **SQL Editor**. This creates all required tables, indexes, Row-Level Security policies, database functions, and the `avatars` storage bucket.

### 4. Run the development server

```bash
npm run dev
```

The app will be available at `http://localhost:3000` (or the port printed in your terminal).

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the app for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run the TypeScript type-checker |
| `npm run clean` | Remove the `dist` build output |

## Project Structure

```
FUTAConnect/
├── src/
│   ├── pages/
│   │   ├── Landing.tsx       # Public landing page
│   │   ├── Auth.tsx          # Sign-up / Login
│   │   ├── ProfileSetup.tsx  # New-user onboarding
│   │   ├── Discovery.tsx     # Browse other students
│   │   ├── Likes.tsx         # Students who expressed interest in you
│   │   ├── Matches.tsx       # Your mutual matches
│   │   ├── Chat.tsx          # Real-time messaging
│   │   └── Profile.tsx       # Edit your own profile
│   ├── lib/
│   │   ├── supabase.ts       # Supabase client
│   │   ├── unread.ts         # Unread message helpers
│   │   └── utils.ts          # Shared utilities (cn, etc.)
│   ├── App.tsx               # Root component & routing
│   ├── constants.ts          # Departments, levels, interests
│   └── types.ts              # Shared TypeScript types
├── server.ts                 # Express API server (Gemini proxy)
├── supabase_schema.sql       # Full database schema & RLS policies
├── .env.example              # Environment variable template
└── vite.config.ts            # Vite configuration
```

## Contributing

Contributions are welcome! Please open an issue to discuss your idea before submitting a pull request.

## License

This project is licensed under the [Apache 2.0 License](https://spdx.org/licenses/Apache-2.0.html).
