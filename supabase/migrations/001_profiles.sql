-- Run this in the Supabase SQL editor AFTER creating the auth.users entries.
-- Step 1: Create profiles table
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  subscription_active boolean default false,
  subscription_tier text default 'founding',
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using (auth.uid() = id);

-- Step 2: Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
