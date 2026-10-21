import { fileStore } from "../services/fileStore";

export const SAMPLE_NOTEBOOK_NAME = "示例笔记本";
export const SAMPLE_NOTE_NAME = "欢迎使用 Ruvo.md";

export const SAMPLE_NOTE_CONTENT = `# 欢迎使用 Ruvo

Ruvo 是一款极简、纯净、高响应的本地 Markdown 个人知识库与第二大脑。所有数据完全以纯文本格式存储于您的本地磁盘中，零网络依赖，零隐私泄露风险。

本篇文档展示了本软件所支持的全部排版格式与交互实例。

---

## 标题层级示例

本系统完整支持一到六级标准的标题层级，大纲解析器能够自动提取并在右侧边栏生成对应的导航目录。

### 三级子标题示例

这里是三级子标题下的段落文本。

#### 四级层级标题

这里是四级标题下的段落文本。

##### 五级层级标题

这里是五级标题下的段落文本。

###### 六级层级标题

这里是六级标题下的段落文本。

---

## 行内文本样式

您可以在编辑区使用快捷键或工具栏快速应用以下行内样式：

- **粗体样式**：用于强调核心关键词与重点语句。
- *斜体样式*：用于专有名词、术语定义或语气变化。
- ***粗斜体组合***：同时应用加粗与斜体强调。
- ~~删除线样式~~：用于标记已被废弃或不再适用的内容。
- \`行内代码样式\`：用于标记变量名、函数签名如 \`fileStore.readNote()\` 或快捷键。
- [外部网络链接](https://github.com/Rua10432/Ruvo)：支持跳转至外部网络资源。
- 内部双向链接：通过 [[我的知识库]] 与 [[今日灵感]] 关联知识库内部的其他卡片。

---

## 列表与任务清单

### 无序列表

- 基础项目一
- 基础项目二
  - 二级嵌套列表项 A
  - 二级嵌套列表项 B
- 基础项目三

### 有序列表

1. 确认系统环境与文件权限
2. 创建或导入您的第一个 Markdown 笔记本
3. 撰写文档并通过快捷键保存
4. 导出为所需的文件格式

### 交互式任务清单

- [x] 完成软件的首次安装与初始化
- [x] 阅读并掌握基础 Markdown 语法
- [ ] 尝试在左侧文件栏创建一篇新的个人笔记
- [ ] 输入双中括号体验双链自动补全
- [ ] 在右侧边栏查看大纲树与反向链接列表

---

## 引用块

> 知识不是孤立的岛屿，而是一座互联互通的网络。通过双向链接构建网状结构，有助于将碎片化信息沉淀为可持续调用的第二大脑。
>
> 引用块支持多行文本，同时能够与行内格式自由组合，例如包含 **加粗说明** 与 \`代码片段\`。

---

## 多语言代码块

\`\`\`typescript
// 演示 TypeScript 代码高亮
interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

function processNote(note: NoteItem): boolean {
  console.log(\`[Ruvo Engine] 正在处理笔记: \${note.title}\`);
  return note.content.length > 0;
}
\`\`\`

\`\`\`rust
// 演示 Rust 后端结构定义
pub struct NotebookEntry {
    pub id: String,
    pub name: String,
    pub path: String,
}
\`\`\`

---

## 表格数据排版

| 功能操作 | 快捷键 (Windows) | 快捷键 (macOS) | 状态 |
| :--- | :--- | :--- | :---: |
| 新建笔记 | Ctrl + N | Command + N | 已启用 |
| 保存笔记 | Ctrl + S | Command + S | 已启用 |
| 折叠或展开左侧栏 | Ctrl + B | Command + B | 已启用 |
| 折叠或展开右侧栏 | Ctrl + J | Command + J | 已启用 |
| 全局搜索 | Ctrl + F | Command + F | 已启用 |
| 偏好设置 | Ctrl + , | Command + , | 已启用 |

---

## 图片展示

![Ruvo 演示徽标](./assets/ruvo_logo.png "Ruvo 官方徽标")

---

> 提示：本篇为系统预置的规范示例模板，您可以随时编辑、重命名或安全删除。
`;

export async function ensureSampleAssets(notebookPath: string) {
  try {
    const res = await fetch("/assets/ruvo_logo.png");
    if (res.ok) {
      const blob = await res.blob();
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(blob);
      const base64 = await base64Promise;
      await fileStore.saveImageAsset(notebookPath, "ruvo_logo.png", base64);
    }
  } catch (err) {
    console.warn("Failed to save sample asset:", err);
  }
}
