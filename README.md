# Grand Andouran Battery

A dark, high-contrast military hub site for the Grand Andouran Battery built with React, TypeScript, Vite, Tailwind CSS, and Supabase.

## Features
- Public pages for Home, Lore, Enlist, Personnel, Command, Battles, Schedule, and Medals
- Auth-oriented routes for Discord login, Roblox linking, enlistment application, and a simple admin panel
- Supabase migration and seed SQL covering profiles, battles, medals, lore, command slots, settings, and applications
- Cloudflare Pages deployment scaffolding with Wrangler config

## Local setup
1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase and OAuth placeholders
3. Start the app with `npm run dev`

## Supabase
- Apply the migration in [supabase/migrations/001_init.sql](supabase/migrations/001_init.sql)
- Seed data from [supabase/seed.sql](supabase/seed.sql)

## Cloudflare Pages
- Build command: `npm run build`
- Output directory: `dist`
- Configure the Pages project to use the build output and deploy from the repository
