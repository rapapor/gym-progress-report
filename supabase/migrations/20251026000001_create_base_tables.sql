-- Migration: Create base tables for users, trainers, and clients
-- Description: Sets up the foundational tables for user management
-- Tables affected: users, trainers, clients
-- Author: AI Assistant
-- Date: 2025-10-26

-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create users table
create table public.users (
    id uuid primary key, -- references auth.users.id
    role text not null check (role in ('super_admin', 'trainer', 'client')),
    email text unique,
    phone text unique,
    full_name text not null,
    created_at timestamptz not null default now(),
    deleted_at timestamptz
);

-- Enable RLS on users table
alter table public.users enable row level security;

-- Create trainers table
create table public.trainers (
    id uuid primary key references public.users(id) on delete cascade,
    bio text
);

-- Enable RLS on trainers table
alter table public.trainers enable row level security;

-- Create clients table
create table public.clients (
    id uuid primary key references public.users(id) on delete cascade,
    date_of_birth date,
    gender text,
    deleted_at timestamptz
);

-- Enable RLS on clients table
alter table public.clients enable row level security;

-- Create RLS policies for users table
-- Super admin has full access
create policy "super_admin_full_access_users"
    on public.users
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Users can read their own data
create policy "users_read_own"
    on public.users
    as permissive
    for select
    to authenticated
    using (id = auth.uid());

-- Create RLS policies for trainers table
-- Super admin has full access
create policy "super_admin_full_access_trainers"
    on public.trainers
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Trainers can read their own data
create policy "trainers_read_own"
    on public.trainers
    as permissive
    for select
    to authenticated
    using (id = auth.uid());

-- Create RLS policies for clients table
-- Super admin has full access
create policy "super_admin_full_access_clients"
    on public.clients
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Clients can read their own data
create policy "clients_read_own"
    on public.clients
    as permissive
    for select
    to authenticated
    using (id = auth.uid());

-- Trainers can read their active clients' data (will be updated after trainer_client table creation)
create policy "trainers_read_clients"
    on public.clients
    as permissive
    for select
    to authenticated
    using (
        auth.jwt() ->> 'role' = 'trainer'
        -- Note: This policy will be updated in the next migration after trainer_client table is created
    );

-- Add helpful comments
comment on table public.users is 'User profiles for all system users';
comment on table public.trainers is 'Extended profile information for trainer users';
comment on table public.clients is 'Extended profile information for client users';
