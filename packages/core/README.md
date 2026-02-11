# three-way-diff-editor

一个用于 **React** 的三栏（左/中/右）对比与合并编辑器组件：支持逐行选择“接受左侧/右侧”、自由编辑合并结果、虚拟滚动渲染与字符级高亮。

> 包名：`three-way-diff-editor`  
> 默认导出 / 命名导出：`ThreeWayDiffEditor`

## 特性

- **三栏视图**：左侧（旧/你的版本）、中间（合并结果）、右侧（新/线上版本）
- **合并操作**：
  - 工具栏：全部接受左侧 / 全部接受右侧 / 重置
  - 行级：对冲突行选择接受左/右，或直接编辑该行
  - 块级：对代码块（连续变更段）支持一键接受左/右
- **自由编辑模式**：直接编辑整份合并结果，退出时弹窗提示保存/丢弃；保存会自动去掉空行（见“行为说明”）
- **性能**：虚拟滚动（overscan）减少大文件渲染开销
- **字符级 diff**：对比左右内容并高亮字符差异
- **滚动同步**：三栏滚动联动，并在左右变更行之间绘制连接线

## 安装

```bash
npm i three-way-diff-editor
```

或使用 pnpm：

```bash
pnpm add three-way-diff-editor
```

## 快速开始

```tsx
import React, { useState } from 'react';
import { ThreeWayDiffEditor } from 'three-way-diff-editor';

export default function Example() {
  const [merged, setMerged] = useState('');

  return (
    <ThreeWayDiffEditor
      oldContent={`{\n  "a": 1\n}\n`}
      newContent={`{\n  "a": 2\n}\n`}
      onChange={(nextMerged) => setMerged(nextMerged)}
      onHasChangesChange={(hasChanges) => {
        // 例如：用于提示“未保存更改”
        console.log('hasChanges:', hasChanges);
      }}
    />
  );
}
```

## 样式（Less）

组件内部会 `import './styles/index.less'`。如果你的构建链支持 Less（例如 Vite + `less`），通常无需额外处理。

如果你想显式引入样式，可使用包导出：

```ts
import 'three-way-diff-editor/styles';
```

> 注意：`styles` 导出的是 Less 文件（不是编译后的 CSS）。如果你的工程 **不支持 Less**，需要自行增加 Less 处理（或在你的构建链里把本包的 Less 编译成 CSS）。

## API

### `ThreeWayDiffEditorProps`

| Prop | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `oldContent` | `string` | 是 | 左侧内容（旧版本/你的版本） |
| `newContent` | `string` | 是 | 右侧内容（新版本/线上版本） |
| `middleContent` | `string` | 否 | 初始合并结果内容；提供后会按行覆盖默认合并结果，并将该行视为 `manual` 来源 |
| `onChange` | `(mergedContent: string) => void` | 否 | 合并结果变化回调（行级选择、行内编辑、自由编辑都会触发） |
| `onHasChangesChange` | `(hasChanges: boolean) => void` | 否 | 是否相对初始化状态发生变更（用于“未保存更改”提示等） |
| `defaultEditMode` | `boolean` | 否 | **目前版本未生效**（预留字段，组件内部尚未使用） |

### 导出的类型

你也可以直接从包里导入类型（位于 `src/types`）：

```ts
import type { DiffLine, DiffStats, ThreeWayDiffEditorProps } from 'three-way-diff-editor';
```

## 行为说明（重要）

- **冲突的定义**：同一行左右两侧均存在且内容不同（`leftContent !== null && rightContent !== null && leftContent !== rightContent`）时视为冲突；未解决冲突会计入“剩余冲突”。
- **自由编辑保存**：保存时会对编辑内容做一次“去空行”（删除全空/仅空白字符的行），再同步回内部的 `diffLines`。
- **`middleContent` 的对齐方式**：按行索引对齐覆盖（`middleContent.split('\n')[index]`）；当中间内容行数不足时，不会覆盖超出部分。

## 依赖

### Peer Dependencies

- `react` (>= 18)
- `react-dom` (>= 18)

### Dependencies

- `diff`

## 在本仓库开发 / 运行 demo

在仓库根目录：

```bash
pnpm install
pnpm --filter three-way-diff-demo dev
```

然后访问终端输出的本地地址（通常类似 `http://localhost:5173/`；端口被占用时会自动递增）。

## License

MIT
