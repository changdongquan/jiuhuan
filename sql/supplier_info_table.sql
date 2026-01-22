-- 供方信息表
CREATE TABLE 供方信息 (
    -- 主键
    供方ID BIGINT IDENTITY(1,1) PRIMARY KEY,
    
    -- 基本信息
    供方名称 VARCHAR(200) NOT NULL,
    供方等级 VARCHAR(1) NOT NULL DEFAULT 'A' CHECK (供方等级 IN ('A', 'B', 'C')),
    分类 VARCHAR(10) NOT NULL CHECK (分类 IN ('原料', '配件', '设备', '外协', '服务')),
    供方状态 VARCHAR(10) NOT NULL DEFAULT 'active' CHECK (供方状态 IN ('active', 'suspended')),
    
    -- 联系信息
    联系人 VARCHAR(100) NOT NULL,
    联系电话 VARCHAR(20) NOT NULL,
    电子邮箱 VARCHAR(100),
    所在地区 VARCHAR(100),
    详细地址 VARCHAR(500),
    
    -- 业务信息
    备注信息 TEXT,
    
    -- 银行信息
    纳税人识别号 VARCHAR(20),
    开户银行 VARCHAR(200),
    银行账号 VARCHAR(30),
    银行行号 VARCHAR(12),
    
    -- 系统字段
    创建时间 DATETIME2 DEFAULT GETDATE(),
    更新时间 DATETIME2 DEFAULT GETDATE(),
    创建人 VARCHAR(50),
    更新人 VARCHAR(50),
    是否删除 BIT DEFAULT 0
);

-- 创建索引
CREATE INDEX idx_供方名称 ON 供方信息(供方名称);
CREATE INDEX idx_分类 ON 供方信息(分类);
CREATE INDEX idx_供方状态 ON 供方信息(供方状态);
CREATE INDEX idx_供方等级 ON 供方信息(供方等级);
CREATE INDEX idx_所在地区 ON 供方信息(所在地区);
CREATE INDEX idx_创建时间 ON 供方信息(创建时间);
CREATE INDEX idx_是否删除 ON 供方信息(是否删除);

-- 插入示例数据
INSERT INTO 供方信息 (
    供方名称, 供方等级, 分类, 供方状态,
    联系人, 联系电话, 电子邮箱, 所在地区, 详细地址,
    备注信息, 纳税人识别号, 开户银行, 银行账号, 银行行号,
    创建人
) VALUES 
(
    '华东材料有限公司', 'A', '原料', 'active',
    '王强', '021-62345678', 'supplier@hdmaterials.com', '上海市', '浦东新区张江高科产业园',
    '优质材料供应商，年度框架协议',
    '91310000123456789X', '中国工商银行上海分行', '6222021234567890123', '102290000001',
    'system'
),
(
    '远航物流服务', 'B', '服务', 'active',
    '陈俊', '0755-86771234', 'service@yuahanglogistics.com', '深圳市', '南山区前海路弘毅中心18楼',
    '物流服务供应商，付款周期 30 天',
    '91440300123456789Y', '中国建设银行深圳分行', '6217001234567890123', '105584000001',
    'system'
),
(
    '星辰设备', 'C', '设备', 'suspended',
    '王京', '010-66553322', 'info@xingchenequipment.com', '北京市', '亦庄经济开发区创新园B座',
    '设备供应商，目前暂停大额采购',
    '91110000123456789Z', '中国银行北京分行', '6216601234567890123', '104100000001',
    'system'
);
