-- Create game leaderboard table (if missing)
IF OBJECT_ID('game_leaderboard', 'U') IS NULL
BEGIN
  CREATE TABLE game_leaderboard (
    id INT IDENTITY(1,1) PRIMARY KEY,
    game_code NVARCHAR(64) NOT NULL,
    username NVARCHAR(255) NOT NULL,
    display_name NVARCHAR(255) NULL,
    score INT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );

  CREATE UNIQUE INDEX UX_game_leaderboard_game_user ON game_leaderboard(game_code, username);
  CREATE INDEX IX_game_leaderboard_score ON game_leaderboard(game_code, score DESC, updated_at DESC);
END;
GO

-- Migrate existing snake leaderboard data (if any)
IF OBJECT_ID('snake_leaderboard', 'U') IS NOT NULL
BEGIN
  INSERT INTO game_leaderboard (game_code, username, display_name, score, created_at, updated_at)
  SELECT 'snake', s.username, s.display_name, s.score, s.created_at, s.updated_at
  FROM snake_leaderboard s
  WHERE NOT EXISTS (
    SELECT 1
    FROM game_leaderboard g
    WHERE g.game_code = 'snake' AND g.username = s.username
  );
END;
GO
