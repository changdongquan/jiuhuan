IF OBJECT_ID(N'dbo.review_actions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_actions (
    action_key NVARCHAR(120) NOT NULL PRIMARY KEY,
    action_name NVARCHAR(200) NOT NULL,
    module_code NVARCHAR(80) NOT NULL,
    enabled BIT NOT NULL CONSTRAINT DF_review_actions_enabled DEFAULT (1),
    created_at DATETIME2 NOT NULL CONSTRAINT DF_review_actions_created_at DEFAULT (SYSDATETIME()),
    updated_at DATETIME2 NOT NULL CONSTRAINT DF_review_actions_updated_at DEFAULT (SYSDATETIME())
  );

  CREATE INDEX IX_review_actions_module_code
    ON dbo.review_actions(module_code);
END
GO

IF OBJECT_ID(N'dbo.review_action_user_bindings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_action_user_bindings (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    action_key NVARCHAR(120) NOT NULL,
    username NVARCHAR(120) NOT NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_review_action_user_bindings_created_at DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_review_action_user_bindings_action
      FOREIGN KEY (action_key) REFERENCES dbo.review_actions(action_key) ON DELETE CASCADE,
    CONSTRAINT UQ_review_action_user_bindings UNIQUE(action_key, username)
  );

  CREATE INDEX IX_review_action_user_bindings_username
    ON dbo.review_action_user_bindings(username);
END
GO

IF OBJECT_ID(N'dbo.review_action_group_bindings', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.review_action_group_bindings (
    id BIGINT IDENTITY(1,1) PRIMARY KEY,
    action_key NVARCHAR(120) NOT NULL,
    group_dn NVARCHAR(500) NOT NULL,
    group_name NVARCHAR(200) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_review_action_group_bindings_created_at DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_review_action_group_bindings_action
      FOREIGN KEY (action_key) REFERENCES dbo.review_actions(action_key) ON DELETE CASCADE,
    CONSTRAINT UQ_review_action_group_bindings UNIQUE(action_key, group_dn)
  );

  CREATE INDEX IX_review_action_group_bindings_group_dn
    ON dbo.review_action_group_bindings(group_dn);
END
GO

MERGE dbo.review_actions AS target
USING (
  SELECT N'BMO_INITIATION.REVIEW' AS action_key, N'BMO立项审核' AS action_name, N'BMO_INITIATION' AS module_code
  UNION ALL
  SELECT N'HARD_DELETE.REVIEW', N'硬删除审核', N'HARD_DELETE'
) AS src
ON target.action_key = src.action_key
WHEN MATCHED THEN
  UPDATE SET
    action_name = COALESCE(NULLIF(target.action_name, N''), src.action_name),
    module_code = COALESCE(NULLIF(target.module_code, N''), src.module_code),
    updated_at = SYSDATETIME()
WHEN NOT MATCHED THEN
  INSERT (action_key, action_name, module_code, enabled)
  VALUES (src.action_key, src.action_name, src.module_code, 1);
GO
