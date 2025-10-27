-- Migration: Create trainer_client mapping table
-- Description: Sets up the relationship between trainers and their clients
-- Tables affected: trainer_client
-- Author: AI Assistant
-- Date: 2025-10-26

-- Create trainer_client mapping table
create table public.trainer_client (
    trainer_id uuid not null references public.trainers(id) on delete cascade,
    client_id uuid not null references public.clients(id) on delete cascade,
    started_at timestamptz not null default now(),
    is_active boolean not null default true,
    primary key (trainer_id, client_id)
);

-- Enable RLS on trainer_client table
alter table public.trainer_client enable row level security;

-- Create index for trainer queries
create index idx_trainer_client_trainer on public.trainer_client (trainer_id, is_active, started_at desc);

-- Create RLS policies for trainer_client table
-- Super admin has full access
create policy "super_admin_full_access_trainer_client"
    on public.trainer_client
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Trainers can read their own client mappings
create policy "trainers_read_own_clients"
    on public.trainer_client
    as permissive
    for select
    to authenticated
    using (
        auth.jwt() ->> 'role' = 'trainer'
        and trainer_id = auth.uid()
    );

-- Update the trainers_read_clients policy on clients table
drop policy if exists "trainers_read_clients" on public.clients;
create policy "trainers_read_clients"
    on public.clients
    as permissive
    for select
    to authenticated
    using (
        auth.jwt() ->> 'role' = 'trainer'
        and exists (
            select 1
            from public.trainer_client
            where trainer_client.trainer_id = auth.uid()
            and trainer_client.client_id = clients.id
            and trainer_client.is_active = true
        )
    );

-- Add helpful comments
comment on table public.trainer_client is 'Mapping table for trainer-client relationships';
comment on column public.trainer_client.is_active is 'Indicates if the trainer-client relationship is currently active';
