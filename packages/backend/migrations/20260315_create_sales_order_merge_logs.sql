-- Create sales_order_merge_logs for auditing sales order merges (single source -> target).
-- This table is append-only and does not affect runtime queries by default.

IF OBJECT_ID(N'dbo.sales_order_merge_logs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sales_order_merge_logs (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_order_no NVARCHAR(100) NOT NULL,
    target_order_no NVARCHAR(100) NOT NULL,
    customer_id INT NULL,
    source_detail_count INT NOT NULL,
    source_total_quantity DECIMAL(18, 2) NOT NULL,
    source_total_amount DECIMAL(18, 2) NOT NULL,
    source_detail_ids_json NVARCHAR(MAX) NULL,
    updated_quotation_ref_count INT NOT NULL CONSTRAINT DF_so_merge_log_updated_quotation_ref_count DEFAULT (0),
    updated_bmo_ref_count INT NOT NULL CONSTRAINT DF_so_merge_log_updated_bmo_ref_count DEFAULT (0),
    merged_by NVARCHAR(200) NULL,
    merged_at DATETIME2 NOT NULL CONSTRAINT DF_so_merge_log_merged_at DEFAULT (SYSDATETIME()),
    remark NVARCHAR(500) NULL
  );

  CREATE INDEX IX_so_merge_log_source_order_no
    ON dbo.sales_order_merge_logs(source_order_no, merged_at DESC, id DESC);
  CREATE INDEX IX_so_merge_log_target_order_no
    ON dbo.sales_order_merge_logs(target_order_no, merged_at DESC, id DESC);
  CREATE INDEX IX_so_merge_log_merged_at
    ON dbo.sales_order_merge_logs(merged_at DESC, id DESC);
END

