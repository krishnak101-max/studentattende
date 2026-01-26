# Deployment Guide for Wings Coaching Center App

## 1. Supabase Setup
The app is already configured with the provided Supabase project credentials.
Ensure the following SQL is run in your Supabase SQL Editor to create the necessary tables:

```sql
-- Create Students Table
create table public.students (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  batch text not null,
  sex text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Attendance Table
create table public.attendance (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.students(id) on delete cascade not null,
  date text not null,
  status text not null,
  unique(student_id, date)
);
```

## 2. Deploy to Vercel

### Option A: Via Git (Recommended)
1. Push this project code to a GitHub repository.
2. Log in to [Vercel](https://vercel.com).
3. Click "Add New" > "Project".
4. Import your GitHub repository.
5. Vercel will auto-detect the Vite framework.
6. Click **Deploy**.

### Option B: Drag and Drop
1. Install Vercel CLI: `npm i -g vercel`
2. Run `vercel` in the project root folder.
3. Follow the prompts to deploy.

## 3. Development
- Run `npm install` to install dependencies.
- Run `npm run dev` to start the local server.
