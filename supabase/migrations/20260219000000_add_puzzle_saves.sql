-- ─────────────────────────────────────────────────────────────────────────────
-- puzzle_saves table
-- Stores puzzle progress for authenticated users.
-- user_id is a Clerk userId (text), NOT a UUID FK to auth.users.
-- RLS policies use auth.jwt() ->> 'sub' which matches Clerk's JWT sub claim.
--
-- Prerequisites:
--   1. In the Clerk dashboard → JWT Templates → create a template named
--      "supabase" using your Supabase JWT secret. Include { "sub": "{{user.id}}" }.
--   2. In Supabase dashboard → Authentication → JWT Settings, add Clerk as a
--      trusted third-party JWT issuer using your Clerk Frontend API URL.
--
-- Storage bucket (run manually in Supabase SQL editor or dashboard):
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('puzzle-images', 'puzzle-images', false)
--   ON CONFLICT DO NOTHING;
-- ─────────────────────────────────────────────────────────────────────────────

-- update_updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── Main table ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.puzzle_saves (
  id               uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          text        NOT NULL,
  created_at       timestamptz DEFAULT now() NOT NULL,
  updated_at       timestamptz DEFAULT now() NOT NULL,

  -- Image storage: either a Supabase Storage URL or an external URL (picsum)
  image_url        text        NOT NULL,
  image_is_picsum  boolean     NOT NULL DEFAULT false,

  cols             integer     NOT NULL,
  rows             integer     NOT NULL,

  -- Seed used to generate piece shapes — must be saved to reconstruct edges[]
  puzzle_seed      bigint      NOT NULL,

  -- Fractional piece positions (board-size-independent)
  -- Each element: { id, fx, fy, isPlaced, zIndex }
  -- fx = (x - boardX) / boardW,  fy = (y - boardY) / boardH
  pieces_state     jsonb       NOT NULL DEFAULT '[]',

  -- Piece IDs currently in the tray (not on the board)
  tray_ids         text[]      NOT NULL DEFAULT '{}',

  placed_count     integer     NOT NULL DEFAULT 0,
  total            integer     NOT NULL,
  is_completed     boolean     NOT NULL DEFAULT false,

  -- Optional thumbnail stored in Supabase Storage
  thumbnail_url    text
);

-- Auto-update updated_at on every row update
CREATE TRIGGER update_puzzle_saves_updated_at
  BEFORE UPDATE ON public.puzzle_saves
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Index for fast user lookups
CREATE INDEX idx_puzzle_saves_user_id ON public.puzzle_saves(user_id);
CREATE INDEX idx_puzzle_saves_updated_at ON public.puzzle_saves(updated_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE public.puzzle_saves ENABLE ROW LEVEL SECURITY;

-- All RLS policies match the Clerk userId (JWT sub) against the row's user_id.
-- This requires the Supabase project to trust Clerk JWTs (see prerequisites above).

CREATE POLICY "puzzle_saves_select"
  ON public.puzzle_saves FOR SELECT
  USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "puzzle_saves_insert"
  ON public.puzzle_saves FOR INSERT
  WITH CHECK (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "puzzle_saves_update"
  ON public.puzzle_saves FOR UPDATE
  USING (user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "puzzle_saves_delete"
  ON public.puzzle_saves FOR DELETE
  USING (user_id = (auth.jwt() ->> 'sub'));
