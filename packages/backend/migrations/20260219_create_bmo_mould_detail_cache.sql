IF OBJECT_ID('dbo.bmo_mould_detail_cache', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.bmo_mould_detail_cache (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    bmo_record_id NVARCHAR(100) NOT NULL,
    demand_type NVARCHAR(100) NULL,
    designer NVARCHAR(100) NULL,
    tech_table_name NVARCHAR(100) NULL,
    mech_auth_token NVARCHAR(255) NULL,
    tech_fields_json NVARCHAR(MAX) NULL,
    tech_attachments_json NVARCHAR(MAX) NULL,
    raw_json NVARCHAR(MAX) NULL,
    source_updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_mould_detail_cache_source_updated_at DEFAULT (SYSDATETIME()),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_mould_detail_cache_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_mould_detail_cache_updated_at DEFAULT (SYSDATETIME())
  );

  CREATE UNIQUE INDEX UX_bmo_mould_detail_cache_record
    ON dbo.bmo_mould_detail_cache (bmo_record_id);
END
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_bmo_mould_detail_cache_updated'
    AND object_id = OBJECT_ID('dbo.bmo_mould_detail_cache')
)
BEGIN
  CREATE INDEX IX_bmo_mould_detail_cache_updated
    ON dbo.bmo_mould_detail_cache (updated_at DESC, id DESC);
END
GO
