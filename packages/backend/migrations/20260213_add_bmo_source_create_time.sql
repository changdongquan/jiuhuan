-- Add source_create_time to match BMO UI ordering proxy
IF OBJECT_ID('bmo_mould_procurement', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'bmo_mould_procurement', N'source_create_time') IS NULL
    ALTER TABLE bmo_mould_procurement ADD source_create_time DATETIME2 NULL;
END;
GO

-- Backfill from existing project_end_time (same source field in current mapping)
IF OBJECT_ID('bmo_mould_procurement', 'U') IS NOT NULL
BEGIN
  UPDATE bmo_mould_procurement
  SET source_create_time = project_end_time
  WHERE source_create_time IS NULL AND project_end_time IS NOT NULL;
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_bmo_mould_procurement_source_create_time'
    AND object_id = OBJECT_ID('bmo_mould_procurement')
)
BEGIN
  CREATE INDEX IX_bmo_mould_procurement_source_create_time
    ON bmo_mould_procurement(source_create_time DESC, id DESC);
END;
GO

