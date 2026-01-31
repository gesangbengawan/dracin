-- ============================================
-- DRACIN DATABASE SCHEMA v2 - SAFE TO RE-RUN
-- ============================================

-- 1. Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data->>'full_name', 
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 3. Dramas cache table
CREATE TABLE IF NOT EXISTS public.dramas (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  poster_url TEXT,
  total_episodes INT DEFAULT 0,
  page_number INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.dramas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dramas are viewable by everyone" ON public.dramas;
CREATE POLICY "Dramas are viewable by everyone" 
  ON public.dramas FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage dramas" ON public.dramas;
CREATE POLICY "Service role can manage dramas" 
  ON public.dramas FOR ALL USING (true);

-- 4. Indexes for fast search
DROP INDEX IF EXISTS idx_dramas_title;
CREATE INDEX idx_dramas_title ON public.dramas USING gin(to_tsvector('simple', title));

DROP INDEX IF EXISTS idx_dramas_title_lower;
CREATE INDEX idx_dramas_title_lower ON public.dramas (LOWER(title));

-- 5. Watch history
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  drama_id TEXT,
  episode INT,
  message_id INT,
  watched_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can see own history" ON public.watch_history;
CREATE POLICY "Users can see own history" 
  ON public.watch_history FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own history" ON public.watch_history;
CREATE POLICY "Users can insert own history" 
  ON public.watch_history FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Fast search function
CREATE OR REPLACE FUNCTION search_dramas(search_query TEXT, result_limit INT DEFAULT 50)
RETURNS SETOF public.dramas AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM public.dramas
  WHERE LOWER(title) LIKE '%' || LOWER(search_query) || '%'
  ORDER BY 
    CASE WHEN LOWER(title) LIKE LOWER(search_query) || '%' THEN 0 ELSE 1 END,
    title
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Done!
SELECT 'Schema v2 created successfully!' as status;
