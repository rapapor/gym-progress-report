-- Migration: Create reports table
-- Description: Sets up the reports table for tracking client progress measurements
-- Tables affected: reports
-- Author: AI Assistant
-- Date: 2025-10-26

-- Create reports table
create table public.reports (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    created_at timestamptz not null default now(),
    week_number integer not null,
    year integer not null,
    sequence integer not null default 0 check (sequence in (0, 1)),
    weight numeric(6,2) check (weight >= 0),
    waist numeric(6,2) check (waist >= 0),
    chest numeric(6,2) check (chest >= 0),
    biceps_left numeric(6,2) check (biceps_left >= 0),
    biceps_right numeric(6,2) check (biceps_right >= 0),
    thigh_left numeric(6,2) check (thigh_left >= 0),
    thigh_right numeric(6,2) check (thigh_right >= 0),
    cardio_days integer check (cardio_days between 0 and 7),
    note text,
    deleted_at timestamptz,
    unique (client_id, week_number, year, sequence)
);

-- Enable RLS on reports table
alter table public.reports enable row level security;

-- Create indexes for reports
create index idx_reports_client on public.reports (client_id, created_at desc);
create index idx_reports_brin on public.reports using brin(created_at);

-- Create function to automatically set week_number and year
create or replace function public.set_report_week_and_year()
returns trigger as $$
begin
    new.week_number := extract(week from new.created_at);
    new.year := extract(year from new.created_at);
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically set week_number and year
create trigger set_report_week_and_year_trigger
    before insert on public.reports
    for each row
    execute function public.set_report_week_and_year();

-- Create RLS policies for reports table
-- Super admin has full access
create policy "super_admin_full_access_reports"
    on public.reports
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Clients can read their own reports
create policy "clients_read_own_reports"
    on public.reports
    as permissive
    for select
    to authenticated
    using (
        client_id = auth.uid()
        and deleted_at is null
    );

-- Trainers can read their active clients' reports
create policy "trainers_read_client_reports"
    on public.reports
    as permissive
    for select
    to authenticated
    using (
        auth.jwt() ->> 'role' = 'trainer'
        and exists (
            select 1
            from public.trainer_client
            where trainer_client.trainer_id = auth.uid()
            and trainer_client.client_id = reports.client_id
            and trainer_client.is_active = true
        )
        and deleted_at is null
    );

-- Add helpful comments
comment on table public.reports is 'Client progress measurement reports';
comment on column public.reports.sequence is 'Allows two reports per week (0 or 1)';
comment on column public.reports.week_number is 'Automatically set based on created_at';
comment on column public.reports.year is 'Automatically set based on created_at';
