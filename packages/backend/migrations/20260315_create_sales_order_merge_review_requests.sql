IF OBJECT_ID(N'dbo.sales_order_merge_review_requests', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sales_order_merge_review_requests (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    source_order_no NVARCHAR(100) NOT NULL,
    target_order_no NVARCHAR(100) NOT NULL,
    customer_id INT NULL,
    customer_name NVARCHAR(200) NULL,
    status NVARCHAR(20) NOT NULL,
    request_reason NVARCHAR(1000) NULL,
    requester_name NVARCHAR(200) NULL,
    reviewer_name NVARCHAR(200) NULL,
    review_comment NVARCHAR(1000) NULL,
    source_snapshot_json NVARCHAR(MAX) NULL,
    target_snapshot_json NVARCHAR(MAX) NULL,
    preview_json NVARCHAR(MAX) NULL,
    execution_result NVARCHAR(MAX) NULL,
    execution_error NVARCHAR(1000) NULL,
    approved_at DATETIME2 NULL,
    rejected_at DATETIME2 NULL,
    canceled_at DATETIME2 NULL,
    executed_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_so_merge_review_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_so_merge_review_updated_at DEFAULT (SYSDATETIME())
  );

  CREATE INDEX IX_so_merge_review_status
    ON dbo.sales_order_merge_review_requests(status, created_at DESC, id DESC);
  CREATE INDEX IX_so_merge_review_source_order
    ON dbo.sales_order_merge_review_requests(source_order_no, created_at DESC, id DESC);
  CREATE INDEX IX_so_merge_review_target_order
    ON dbo.sales_order_merge_review_requests(target_order_no, created_at DESC, id DESC);
END
