-- Migration: Add Supabase Auth integration
-- Description: Sets up integration with auth.users and automatic profile creation
-- Tables affected: users, trainers, clients
-- Author: AI Assistant
-- Date: 2025-10-26

-- Add foreign key constraint to link users table with auth.users
alter table public.users
    add constraint users_id_fkey
    foreign key (id)
    references auth.users(id)
    on delete cascade;

-- Create function to handle new user registration
create or replace function public.handle_new_user()
returns trigger as $$
declare
    default_role text;
begin
    -- Get the role from metadata if available, default to 'client'
    default_role := coalesce(
        new.raw_user_meta_data->>'role',
        'client'
    );

    -- Validate role
    if default_role not in ('super_admin', 'trainer', 'client') then
        default_role := 'client';
    end if;

    -- Insert into public.users
    insert into public.users (id, role, email, phone, full_name)
    values (
        new.id,
        default_role,
        new.email,
        new.phone,
        coalesce(new.raw_user_meta_data->>'full_name', 'Anonymous User')
    );

    -- Based on role, create corresponding profile
    case default_role
        when 'trainer' then
            insert into public.trainers (id)
            values (new.id);
        when 'client' then
            insert into public.clients (id)
            values (new.id);
        else
            -- For super_admin, no additional profile needed
            null;
    end case;

    return new;
end;
$$ language plpgsql security definer;

-- Create trigger to handle new user registration
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- Create function to handle user deletion
create or replace function public.handle_user_deletion()
returns trigger as $$
begin
    -- The cascade delete will handle the rest due to foreign key constraints
    update public.users
    set deleted_at = now()
    where id = old.id;
    
    return old;
end;
$$ language plpgsql security definer;

-- Create trigger to handle user deletion
create trigger on_auth_user_deleted
    before delete on auth.users
    for each row execute function public.handle_user_deletion();

-- Update RLS policies to use auth.uid() function
drop policy if exists "super_admin_full_access_users" on public.users;
create policy "super_admin_full_access_users"
    on public.users
    as permissive
    for all
    to authenticated
    using (auth.jwt() ->> 'role' = 'super_admin');

-- Add helpful comments
comment on function public.handle_new_user() is 'Automatically creates user profile when a new user signs up';
comment on function public.handle_user_deletion() is 'Handles soft deletion of user data when auth user is deleted';
