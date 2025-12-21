-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES
-- Matches auth.users and stores app-specific user settings
create table public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  commission_rate integer default 40, -- Default 40% commission
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table public.profiles enable row level security;

create policy "Users can view their own profile" 
  on public.profiles for select 
  using ( auth.uid() = id );

create policy "Users can update their own profile" 
  on public.profiles for update 
  using ( auth.uid() = id );

-- Trigger to handle new user signup
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 2. SERVICES CATALOG
-- Pre-defined services for the user to select quickly
create table public.services (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  default_price integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.services enable row level security;

create policy "Users can CRUD their own services"
  on public.services for all
  using ( auth.uid() = user_id );


-- 3. TRANSACTIONS
-- Unified table for Incomes (Services, Tips) and Expenses (Supplies)
create type transaction_type as enum ('income', 'expense');
create type transaction_category as enum ('service', 'tip', 'supply', 'other');

create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  
  -- Core fields
  title text not null, -- Description or Service Name
  amount integer not null, -- Final amount affecting the balance
  type transaction_type not null,
  category transaction_category not null,
  date timestamp with time zone default timezone('utc'::text, now()) not null,
  
  -- Metadata for calculations (optional but useful)
  -- For Services:
  gross_amount integer, -- "Total Cliente"
  commission_amount integer, -- "Comisión Salón"
  retention_amount integer, -- "Retención SII"
  
  -- For scanning/receipts
  receipt_url text,
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.transactions enable row level security;

create policy "Users can CRUD their own transactions"
  on public.transactions for all
  using ( auth.uid() = user_id );


-- 4. SAVINGS GOALS
-- "Fiscal Savings Card" and "Savings Goal Card"
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  target_amount integer not null,
  current_amount integer default 0,
  deadline date,
  color text, -- For UI customization
  icon text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.goals enable row level security;

create policy "Users can CRUD their own goals"
  on public.goals for all
  using ( auth.uid() = user_id );


-- 5. STORAGE (Optional but recommended for receipts)
-- You need to create a bucket named 'receipts' in the Supabase Dashboard manually,
-- but here is the policy SQL if you do.

-- insert into storage.buckets (id, name) values ('receipts', 'receipts');

-- create policy "Users can upload their own receipts"
--   on storage.objects for insert
--   with check ( bucket_id = 'receipts' and auth.uid() = owner );

-- create policy "Users can view their own receipts"
--   on storage.objects for select
--   using ( bucket_id = 'receipts' and auth.uid() = owner );
