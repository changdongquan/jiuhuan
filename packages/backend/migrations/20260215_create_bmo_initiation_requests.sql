-- BMO 立项申请单：支持多用户协作（申请/确认/审核）与自动入库
IF OBJECT_ID('dbo.bmo_initiation_requests', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.bmo_initiation_requests (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    bmo_record_id NVARCHAR(100) NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT DF_bmo_initiation_requests_status DEFAULT (N'DRAFT'),

    -- 推荐/最终项目编号
    project_code_candidate NVARCHAR(50) NULL,
    project_code_final NVARCHAR(50) NULL,
    sales_order_no NVARCHAR(50) NULL,

    -- 快照/草稿数据（JSON 字符串）
    goods_draft_json NVARCHAR(MAX) NULL,
    sales_order_draft_json NVARCHAR(MAX) NULL,
    tech_snapshot_json NVARCHAR(MAX) NULL,

    -- 审计信息
    created_by NVARCHAR(100) NULL,
    confirmed_by NVARCHAR(100) NULL,
    approved_by NVARCHAR(100) NULL,
    rejected_reason NVARCHAR(400) NULL,

    created_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_initiation_requests_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_bmo_initiation_requests_updated_at DEFAULT (SYSDATETIME()),
    confirmed_at DATETIME2 NULL,
    approved_at DATETIME2 NULL
  );

  CREATE UNIQUE INDEX UX_bmo_initiation_requests_record
    ON dbo.bmo_initiation_requests (bmo_record_id);
END

