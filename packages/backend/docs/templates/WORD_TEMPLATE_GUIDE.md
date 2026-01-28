# Word 文档模板生成工具使用指南

## 功能说明

这个工具可以将已填充的 Word 文档中的实际内容替换成占位符，从而快速生成模板文件。

## 使用方法

### 方法一：使用命令行参数（推荐）

```bash
node packages/backend/scripts/tools/create-word-template.js <已填充文档路径> <输出模板路径> <数据映射JSON文件路径>
```

**示例：**

```bash
# 1. 准备数据映射文件（参考 packages/backend/docs/templates/word-template-data-map.example.json）
# 2. 运行脚本
node packages/backend/scripts/tools/create-word-template.js filled.docx template.docx word-template-data-map.json
```

### 方法二：在代码中直接修改数据映射

1. 打开 `packages/backend/scripts/tools/create-word-template.js` 文件
2. 找到 `dataMap` 对象（大约在第 100 行）
3. 修改为你需要的数据映射：

```javascript
dataMap = {
  mould_no: 'JH01-001', // 将文档中的 "JH01-001" 替换成 {{mould_no}}
  part_name: '产品名称示例', // 将文档中的 "产品名称示例" 替换成 {{part_name}}
  customer_name: '客户名称示例' // 将文档中的 "客户名称示例" 替换成 {{customer_name}}
  // 添加更多映射...
}
```

4. 运行脚本：

```bash
node packages/backend/scripts/tools/create-word-template.js filled.docx template.docx
```

## 数据映射 JSON 文件格式

创建一个 JSON 文件，格式如下：

```json
{
  "占位符名称1": "文档中的实际内容1",
  "占位符名称2": "文档中的实际内容2",
  "占位符名称3": "文档中的实际内容3"
}
```

**示例：**

```json
{
  "mould_no": "JH01-001",
  "part_name": "产品名称示例",
  "customer_name": "客户名称示例",
  "date": "2024-01-15"
}
```

## 占位符命名规则

- 只能包含字母、数字和下划线
- 建议使用小写字母和下划线（如：`mould_no`、`part_name`）
- 避免使用特殊字符和空格

## 工作原理

1. **读取 Word 文档**：Word 文档（.docx）本质是一个 ZIP 压缩包
2. **提取 XML**：从压缩包中提取 `word/document.xml` 文件
3. **查找替换**：在 XML 中查找实际内容，替换成 `{{占位符名称}}` 格式
4. **重新打包**：将修改后的 XML 写回压缩包，生成新的模板文件

## 注意事项

### 1. 内容必须完全匹配

数据映射中的值必须与 Word 文档中的内容**完全一致**，包括：

- 大小写
- 空格
- 标点符号
- 换行符

### 2. 文本可能被分割

Word 可能会将文本分割成多个片段（例如在格式化时），工具会尝试处理这种情况，但可能无法完全匹配。

### 3. 特殊字符处理

工具会自动处理 XML 转义字符（如 `&`、`<`、`>` 等），但某些特殊格式可能无法识别。

### 4. 替换顺序

工具会按值的长度从长到短进行替换，避免短值先匹配导致长值无法匹配。

## 示例场景

### 场景：从三方协议生成模板

假设你有一个已填充的三方协议文档 `三方协议-已填充.docx`，内容如下：

```
客户模号：JH01-001
产品名称：示例产品
客户名称：示例客户
```

**步骤：**

1. 创建数据映射文件 `agreement-map.json`：

```json
{
  "mould_no": "JH01-001",
  "part_name": "示例产品",
  "customer_name": "示例客户"
}
```

2. 运行脚本：

```bash
node packages/backend/scripts/tools/create-word-template.js 三方协议-已填充.docx 三方协议模板.docx agreement-map.json
```

3. 生成的模板文件 `三方协议模板.docx` 中，内容会变成：

```
客户模号：{{mould_no}}
产品名称：{{part_name}}
客户名称：{{customer_name}}
```

## 故障排除

### 问题：某些内容没有被替换

**可能原因：**

1. 数据映射中的值与文档内容不完全一致
2. 文本被 Word 分割成多个片段
3. 包含特殊格式或字符

**解决方法：**

1. 仔细检查数据映射中的值是否与文档完全一致
2. 尝试手动在 Word 中查找该内容，确认是否存在
3. 如果内容很长，尝试分段替换
4. 检查 Word 文档中是否有隐藏字符或格式

### 问题：替换了错误的内容

**可能原因：**

1. 短值先匹配，导致长值无法匹配
2. 多个位置有相同的内容

**解决方法：**

1. 工具已经按长度排序，但如果有问题，可以调整数据映射的顺序
2. 如果文档中有重复内容，可能需要手动处理

### 问题：生成的模板文件损坏

**可能原因：**

1. XML 格式错误
2. 替换时破坏了 XML 结构

**解决方法：**

1. 检查原始文档是否正常
2. 尝试用更简单的数据映射测试
3. 确保 Word 文档格式正确

## 相关文件

- `packages/backend/scripts/tools/create-word-template.js` - 主脚本文件
- `packages/backend/docs/templates/word-template-data-map.example.json` - 数据映射示例文件
- `packages/backend/routes/project.js` - 使用模板填充文档的代码示例

## 参考

查看 `packages/backend/routes/project.js` 中的 `generateTripartiteAgreementDocxBuffer` 函数，了解如何使用生成的模板文件填充数据。
