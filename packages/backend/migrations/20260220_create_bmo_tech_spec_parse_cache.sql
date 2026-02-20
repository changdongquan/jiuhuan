IF OBJECT_ID('dbo.bmo_tech_spec_parse_cache', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.bmo_tech_spec_parse_cache (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    bmo_record_id NVARCHAR(100) NOT NULL,
    attachment_id NVARCHAR(120) NOT NULL,
    file_name NVARCHAR(255) NULL,
    parsed_json NVARCHAR(MAX) NOT NULL,
    parsed_meta_json NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_tech_spec_parse_cache_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_tech_spec_parse_cache_updated_at DEFAULT (SYSDATETIME())
  );
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_bmo_tech_spec_parse_cache_key'
    AND object_id = OBJECT_ID('dbo.bmo_tech_spec_parse_cache')
)
BEGIN
  CREATE UNIQUE INDEX UX_bmo_tech_spec_parse_cache_key
    ON dbo.bmo_tech_spec_parse_cache (bmo_record_id, attachment_id);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_bmo_tech_spec_parse_cache_updated'
    AND object_id = OBJECT_ID('dbo.bmo_tech_spec_parse_cache')
)
BEGIN
  CREATE INDEX IX_bmo_tech_spec_parse_cache_updated
    ON dbo.bmo_tech_spec_parse_cache (updated_at DESC, id DESC);
END
GO
