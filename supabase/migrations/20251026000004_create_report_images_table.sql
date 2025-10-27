-- Migration: Create report_images table
-- Description: Sets up the report_images table for storing progress photos
-- Tables affected: report_images
-- Author: AI Assistant
-- Date: 2025-10-26

-- Create report_images table
create table public.report_images (
    id uuid primary key default gen_random_uuid(),
    report_id uuid not null references public.reports(id) on delete cascade,
    storage_path text not null,
    size_bytes integer not null check (size_bytes <= 10485760), -- Max 10MB
    width integer,
    height integer,
    created_at timestamptz not null default now(),
    is_deleted boolean not null default false,
    deleted_at timestamptz
);

-- Enable RLS on report_images table
alter table public.report_images enable row level security;

-- Create index for report_images
create index idx_report_images_brin on public.report_images using brin(created_at);

-- Create RLS policies for report_images table
-- Super admin has full access
create policy "super_admin_full_access_report_images"
    on public.report_images
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Clients can read their own report images
create policy "clients_read_own_report_images"
    on public.report_images
    as permissive
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.reports
            where reports.id = report_images.report_id
            and reports.client_id = auth.uid()
            and reports.deleted_at is null
        )
        and not is_deleted
    );

-- Trainers can read their active clients' report images
create policy "trainers_read_client_report_images"
    on public.report_images
    as permissive
    for select
    to authenticated
    using (
        auth.jwt() ->> 'role' = 'trainer'
        and exists (
            select 1
            from public.reports
            join public.trainer_client on trainer_client.client_id = reports.client_id
            where reports.id = report_images.report_id
            and trainer_client.trainer_id = auth.uid()
            and trainer_client.is_active = true
            and reports.deleted_at is null
        )
        and not is_deleted
    );

-- Create function for image retention policy
create or replace function public.cleanup_old_report_images()
returns void as $$
begin
    -- Mark images older than 180 days as deleted
    update public.report_images
    set is_deleted = true,
        deleted_at = now()
    where created_at < now() - interval '180 days'
    and not is_deleted;
end;
$$ language plpgsql;

-- Add helpful comments
comment on table public.report_images is 'Progress photos attached to reports';
comment on column public.report_images.storage_path is 'Path to the image file in Supabase Storage';
comment on column public.report_images.size_bytes is 'File size in bytes, max 10MB';
comment on column public.report_images.is_deleted is 'Flag for retention policy, true means pending deletion from storage';
