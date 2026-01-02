-- Add enable image flag for part quotation image column display/export.
IF COL_LENGTH(N'报价单', N'启用图示') IS NULL
BEGIN
  ALTER TABLE 报价单 ADD 启用图示 BIT NOT NULL CONSTRAINT DF_报价单_启用图示 DEFAULT (1);
END
