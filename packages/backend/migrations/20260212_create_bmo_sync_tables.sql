-- BMO 采集主表：按 bmo_record_id 幂等更新
IF OBJECT_ID('bmo_mould_procurement', 'U') IS NULL
BEGIN
  CREATE TABLE bmo_mould_procurement (
    id INT IDENTITY(1,1) PRIMARY KEY,
    bmo_record_id NVARCHAR(100) NOT NULL,
    mold_number NVARCHAR(100) NULL,
    part_no NVARCHAR(255) NULL,
    part_name NVARCHAR(255) NULL,
    mold_type NVARCHAR(100) NULL,
    model NVARCHAR(255) NULL,
    budget_wan_tax_incl DECIMAL(18,4) NULL,
    bid_price_tax_incl DECIMAL(18,4) NULL,
    supplier NVARCHAR(255) NULL,
    project_manager NVARCHAR(100) NULL,
    mold_engineer NVARCHAR(100) NULL,
    designer NVARCHAR(100) NULL,
    project_no NVARCHAR(100) NULL,
    process_no NVARCHAR(100) NULL,
    asset_no NVARCHAR(100) NULL,
    progress_days DECIMAL(10,2) NULL,
    bid_time DATETIME2 NULL,
    project_end_time DATETIME2 NULL,
    raw_json NVARCHAR(MAX) NULL,
    source_trace_id NVARCHAR(100) NULL,
    source_updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'UX_bmo_mould_procurement_record'
    AND object_id = OBJECT_ID('bmo_mould_procurement')
)
BEGIN
  CREATE UNIQUE INDEX UX_bmo_mould_procurement_record
    ON bmo_mould_procurement(bmo_record_id);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_bmo_mould_procurement_updated'
    AND object_id = OBJECT_ID('bmo_mould_procurement')
)
BEGIN
  CREATE INDEX IX_bmo_mould_procurement_updated
    ON bmo_mould_procurement(updated_at DESC, id DESC);
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_bmo_mould_procurement_bid_time'
    AND object_id = OBJECT_ID('bmo_mould_procurement')
)
BEGIN
  CREATE INDEX IX_bmo_mould_procurement_bid_time
    ON bmo_mould_procurement(bid_time DESC);
END;
GO

-- BMO 采集任务日志
IF OBJECT_ID('bmo_sync_task_logs', 'U') IS NULL
BEGIN
  CREATE TABLE bmo_sync_task_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    status NVARCHAR(20) NOT NULL,
    triggered_by NVARCHAR(100) NULL,
    request_json NVARCHAR(MAX) NULL,
    response_json NVARCHAR(MAX) NULL,
    rows_fetched INT NULL,
    rows_upserted INT NULL,
    error_message NVARCHAR(MAX) NULL,
    started_at DATETIME2 NULL,
    finished_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;
GO

IF NOT EXISTS (
  SELECT 1
  FROM sys.indexes
  WHERE name = 'IX_bmo_sync_task_logs_created'
    AND object_id = OBJECT_ID('bmo_sync_task_logs')
)
BEGIN
  CREATE INDEX IX_bmo_sync_task_logs_created
    ON bmo_sync_task_logs(created_at DESC, id DESC);
END;
GO

