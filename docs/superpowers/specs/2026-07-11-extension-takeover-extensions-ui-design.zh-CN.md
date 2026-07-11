# 扩展接管：常用后缀白名单 + 长文件名 UI

日期：2026-07-11  
仓库：`motrix-next-extension-cust`  
状态：已批准，待写实现计划

## 问题

1. content script 预拦截的下载后缀白名单过短。常见类型（pdf、mkv、docx 等）经常漏拦，Chromium 会先弹出原生「另存为 / 下载路径」界面，之后才可能走到 `chrome.downloads.onCreated` 兜底清理。
2. 过长的任务名与保存路径会撑破 popup 布局（横向溢出 / 视觉错乱），尽管部分样式已尝试省略号。

## 目标

1. 减少**常见下载后缀**的预拦截漏拦。
2. 为 content script 与 shared 辅助逻辑维护**同一份逻辑白名单**，并用自动化测试保证一致。
3. 修复 popup 展示：长文件名/路径不得撑破 410px 宽度；完整文本通过 `title` 悬停可见。
4. 保持现有原生下载兜底、安全策略与 API 契约不变。

## 非目标（本轮不做）

- Content-Disposition / 无后缀 URL 识别
- 更强交互覆盖（中键、新标签、键盘、仅 iframe 场景）
- 更宽的 cookie/header 转发（Authorization 仍排除）
- blob:/data: 下载接管
- 将 Chrome 最低版本抬高到超过当前 116

## 方案

**选定：** 扩大白名单 + 同一逻辑列表的双份打包 + CSS/JS 加固 popup。

本轮否决：

- 「任意非网页后缀」启发式匹配（导航/API 链接误拦过多）
- 两份列表却无机械一致性检查（易回归）
- content script 改为 module（抬高 min Chrome，收益小）

## 架构

MV3 content script 保持经典脚本（非 module）。background / popup / 测试使用 ESM。因此逻辑列表打包两份，并由测试锁定一致。

### 确切文件结构

1. **`download-extensions-data.js`**（ESM）

   ```js
   export const DOWNLOAD_FILE_EXTENSIONS_LIST = Object.freeze([
     // 小写、无点号；完整列表见「白名单」一节
   ]);
   ```

2. **`shared.js`**

   ```js
   import { DOWNLOAD_FILE_EXTENSIONS_LIST } from "./download-extensions-data.js";
   export const DOWNLOAD_FILE_EXTENSIONS = new Set(DOWNLOAD_FILE_EXTENSIONS_LIST);
   ```

   删除原先内联的 `DOWNLOAD_FILE_EXTENSIONS` Set。`isDownloadLikeLink` 继续使用导出的 Set。

3. **`content-download-extensions.js`**（经典 content 注入）

   ```js
   globalThis.MOTRIX_DOWNLOAD_EXTENSIONS = new Set([
     // 成员与 DOWNLOAD_FILE_EXTENSIONS_LIST 相同
   ]);
   ```

   手写维护一次；单元测试断言排序后的成员与 ESM 列表相等。

4. **`manifest.json` content_scripts**

   ```json
   "js": ["content-download-extensions.js", "content.js"]
   ```

5. **`content.js`**

   - 删除本地 `DOWNLOAD_EXTENSIONS` 集合
   - 使用 `globalThis.MOTRIX_DOWNLOAD_EXTENSIONS`（缺失时回退为空 Set）
   - 保持现有点击规则：普通左键、`download` 属性或后缀命中、preventDefault + candidate 消息 + 失败回退打开

6. **`popup.css` / `popup.js`**

   - 加固 `.task`、`.task-head`、`.task-name`、`.task-path`、`.task-meta` 子项的省略号链路
   - 对承载文本的 grid/flex 子项确保 `min-width: 0`
   - 设置 name/path 的 `textContent` 后，将 `element.title` 设为完整字符串
   - **不要**截断提交给 Motrix API 的文件名

## 扩展名白名单

### 保留（现有）

`7z`、`apk`、`appx`、`bin`、`bz2`、`deb`、`dmg`、`exe`、`gz`、`iso`、`msi`、`msix`、`pkg`、`rar`、`rpm`、`tar`、`torrent`、`xz`、`zip`

### 新增

| 类别 | 后缀 |
|------|------|
| 压缩/归档 | `zipx`、`zst`、`lz`、`lzma`、`cab`、`arj`、`lzh`、`lha` |
| 文档 | `pdf`、`doc`、`docx`、`xls`、`xlsx`、`ppt`、`pptx`、`epub`、`mobi`、`djvu`、`rtf`、`odt`、`ods`、`odp`、`txt`、`csv` |
| 音视频 | `mp3`、`mp4`、`m4a`、`m4v`、`mkv`、`avi`、`mov`、`webm`、`flac`、`wav`、`aac`、`ogg`、`opus`、`wmv`、`mpg`、`mpeg`、`ts`、`m2ts` |
| 镜像/磁盘 | `img`、`vhd`、`vhdx`、`vmdk`、`wim`、`esd` |
| 安装包/包格式 | `jar`、`war`、`ear`、`nupkg`、`vsix`、`crx`、`xpi` |
| 字体/设计 | `ttf`、`otf`、`woff`、`woff2`、`psd`、`ai`、`sketch`、`fig` |
| 数据/模型 | `sqlite`、`db`、`parquet`、`avro`、`onnx`、`gguf`、`safetensors`、`pth`、`pt` |
| 字幕 | `srt`、`ass`、`vtt`、`sub` |

### 明确不拦（仅凭后缀不预拦截）

`html`、`htm`、`php`、`asp`、`aspx`、`jsp`、`do`、`action`、`cgi`、`js`、`mjs`、`cjs`、`css`、`map`、`json`、`xml`、`svg`

说明：

- 只要存在 HTML `download` 属性，对 http(s) 链接仍强制预拦截，与后缀无关。
- query / hash 仍由现有 URL 辅助函数在提取文件名/后缀时剥离。
- 复合名如 `file.tar.gz` 按现有逻辑解析为后缀 `gz`；`gz` 已在列表中。
- 存储值一律小写、无前导点号。

## 数据流

### 预拦截（加强后）

1. 用户普通左键点击 `<a href>`
2. content 解析绝对 URL 与候选文件名
3. 若存在 `download` 属性，**或**后缀 ∈ 白名单 → `preventDefault` / `stopImmediatePropagation`
4. 向 background 发送 `{ type: "downloadCandidate", candidate }`
5. background 组装 add 请求（cookies / referer / UA / 白名单 header），POST `/add`
6. 成功：记录 dedupe key，确保 WS/轮询；失败/超时：content `fallbackOpen`

### 原生兜底（不变）

`chrome.downloads.onCreated` → 可选 pause → `/add` → 在接管开启且 URL 支持时 cancel/erase Chrome 下载项。

### Popup 长文本

snapshot 任务 → 用省略号 CSS 渲染 name/path → 将 `title` 设为完整字符串供悬停。

## 错误处理

| 情况 | 行为 |
|------|------|
| 关闭接管或缺少 token | 不预提交；原生路径不变 |
| 后缀不在白名单且无 `download` 属性 | 浏览器默认；`onCreated` 仍可能接管 |
| content 全局列表缺失 | 空 Set；仅 `download` 属性可预拦截 |
| Motrix `/add` 失败 | 经 content 回退 / 恢复下载回到原生路径 |
| 极长文件名 | 展示层截断；API 收完整名；布局不破 |

## 测试

### 自动化（`npm test`）

1. `isDownloadLikeLink("https://ex.com/a.pdf")` → true（以及 mkv、docx、zst 等样例）
2. `isDownloadLikeLink("https://ex.com/page.html")` → false；`api.json`、`style.css` 同理
3. 既有 `download` 属性、query 字符串、blob 拒绝等测试保持通过
4. **列表同步测试：** classic content 注入列表与 ESM 数据列表（排序后）相等
5. Manifest `content_scripts[0].js` 为 `["content-download-extensions.js", "content.js"]`

### 手工验收

1. Motrix Next Opt 运行且扩展已配置密钥时，点击 pdf/mkv/docx 直链 → 不出现 Chromium 另存为；任务出现在 Motrix/popup
2. popup 中名称与路径超过约 80 字符的任务 → 卡片不超出 popup 宽度；悬停可见全文
3. 普通 html 页面链接仍正常导航

## 安全

- 无新增权限
- Authorization 请求头仍永不转发
- 仅 loopback 的 Motrix 控制 API 不变
- 白名单扩大只影响哪些点击被预抢占；原生拦截器本就可接受任意 http(s)/ftp 下载项

## 涉及文件

| 文件 | 变更 |
|------|------|
| `download-extensions-data.js` | **新建** ESM 列表 |
| `content-download-extensions.js` | **新建** classic Set 注入 |
| `shared.js` | 导入列表；删除本地硬编码 Set |
| `content.js` | 使用全局 Set |
| `manifest.json` | 先注入 classic 列表脚本 |
| `popup.css` | 省略号 / min-width 加固 |
| `popup.js` | 为 name/path 设置 `title` |
| `__tests__/shared.test.mjs` | 新增后缀用例 + 列表同步 |
| `README.md` | 可选：简要说明预拦截类型已扩展 |

## 后续跟进（本轮范围外）

- 基于 Content-Disposition / MIME 的预拦截
- 中键 / Ctrl+点击 / target=_blank 对等行为
- 鉴权下载的更完整请求上下文

## 成功标准

1. 常见文档/媒体/压缩后缀在普通左键点击直链时能预拦截。
2. content 与 shared 的逻辑白名单通过自动化测试保持一致。
3. 长文件名/路径下 popup 布局保持稳定。
4. 既有测试全部通过；新测试覆盖新增后缀与明确不拦类型。
