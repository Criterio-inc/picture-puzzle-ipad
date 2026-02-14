-- Add tabs configuration to puzzle_games table
-- This stores the random tab directions for each puzzle piece edge
-- to ensure pieces maintain their shapes across save/load cycles

ALTER TABLE public.puzzle_games
ADD COLUMN tabs_config JSONB DEFAULT NULL;

COMMENT ON COLUMN public.puzzle_games.tabs_config IS 'Stores the tab configuration (horizontal and vertical arrays) that define piece shapes. Essential for maintaining puzzle integrity across sessions.';
