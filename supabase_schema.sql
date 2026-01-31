-- Create Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  display_name text,
  avatar_url text,
  role text default 'user',
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies for Profiles
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can insert their own profile."
  on profiles for insert
  with check ( auth.uid() = id );

create policy "Users can update own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Handle new user signup trigger
create function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Create Dramas Table (Cache)
create table public.dramas (
  id text primary key, -- The WebApp Drama ID (e.g. '10535')
  title text not null,
  poster_url text,
  total_episodes int default 0,
  updated_at timestamptz default now()
);

alter table public.dramas enable row level security;
create policy "Dramas are viewable by everyone" on public.dramas for select using (true);
create policy "Only service role can insert/update dramas" on public.dramas for all using (false); -- Backend only

-- Create User Watch History / Logs
create table public.watch_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id),
  drama_id text references public.dramas(id),
  episode int,
  watched_at timestamptz default now()
);

alter table public.watch_history enable row level security;
create policy "Users can see own history" on public.watch_history for select using (auth.uid() = user_id);
create policy "Users can insert own history" on public.watch_history for insert with check (auth.uid() = user_id);
