-- Add remark column for quotation (used by part quotation UI)
IF COL_LENGTH(N'报价单', N'备注') IS NULL
BEGIN
  ALTER TABLE 报价单 ADD 备注 NVARCHAR(MAX) NULL;
END

