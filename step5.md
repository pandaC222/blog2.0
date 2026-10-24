# Step 5：本地后台

状态：功能能用，外观已按前台重做了一遍。小卡片列表和图片预览写到一半，页面上还没接上。

日期：2026-09-29。只在副本 `E:\blog\blog2.0` 里做。原仓库 `E:\blog\pandaC222.github.io` 没有改。

## 方向

前台继续用 Astro 渲染 Mizuki 主题，DOM 和 CSS 类名不动。动态数据只走浏览器里的 `fetch`。

后台不替换主题自己的管理页。两套同时存在：

- 主题原来的 `/admin`：`http://localhost:4321/admin`，源码在站点 `src/pages/admin/`，这一步没动。
- 新后台：`http://localhost:3000/admin`。三个静态文件 `admin/index.html`、`admin/admin.css`、`admin/admin.js`，由 Express 直接提供。不用 Vite、不用 webpack、不引入 React。`admin.js` 也没有拆成多个模块，一直是一个文件。

保存必须写回主题已经在读的文件，这样前台刷新就能看到。不另做一套只存在数据库里的内容。

| 改什么 | 写到哪里 |
|---|---|
| 文章 | `pandaC222.github.io/src/content/posts/<slug>.md`，同时 upsert SQLite |
| 日记、追番、友链、项目、技能、时间线、资料、公告、横幅、音乐、看板娘、模块开关、设备 | `src/content/admin/` 下对应的那一个 yml，整份对象写回 |
| 关于我 | `src/content/spec/about.md`，只写正文 |
| 相册 | `public/images/albums/<id>/` 文件夹加 `info.json`，不新建 markdown 目录 |
| 上传的图 | `public/uploads/`，日记进 `public/uploads/diary/`。接口返回 `/uploads/...` |

文章以 Markdown 文件为准。打开编辑时读文件里的 frontmatter，不用数据库里已经拆开的标签来填表单。中文逗号 `，` 只在保存时拆成多个标签。表单没展示的 frontmatter 原样留在文件里。不写算出来的 prev / next。YAML 用 `yaml` 包整份 `stringify`，所以音乐、看板娘文件里原来的注释在保存后会丢掉，这是已知限制。

评论仍是本地评论。主题的 `commentConfig.enable` 保持 `false`，没有打开 Twikoo 或 Giscus。写入前做 HTML 转义。前台展示用 `textContent`，不用用户原文的 `innerHTML`。

## 这一步实际做了什么

Step 4 结束后先出过一版能改各板块的后台，然后按你的要求重写了一遍：先补功能（预览、上传、评论审核），再把要手填的枚举改成下拉和取色器，再按前台的颜色和深色模式重做外观。最后一次要求（追番封面、小卡片、上传预览）只做了样式和两个辅助函数，渲染还没换。

### 1. 服务端

相关文件：

- `server/index.js`：登录、评论、上传、CORS，最后调用 `registerAdminContent`。
- `server/admin-routes.js`：文章、YAML 板块、关于我、媒体、相册、B 站抓取。
- `server/content-files.js`：读写站点里的 Markdown、YAML、相册目录、上传文件。
- `server/db.js`：建表，并给已有库补 `comments.is_admin`。
- 数据库文件：`E:\blog\blog2.0\data\blog.db`。
- 本地配置在 `server/.env`，没有放进说明，也不提交。`PORT=3000`，`JWT_SECRET` 是本地开发用的值。

账号：用户名 `admin`，密码 `admin123`。登录 `POST /api/admin/login`，之后 `GET /api/admin/me`。令牌放在浏览器 `sessionStorage`，键名 `blog2-admin-token`。请求头 `Authorization: Bearer ...`。密码用 bcrypt。

CORS 只允许 `http://localhost:4321` 和 `http://127.0.0.1:4321`。

文章：

- 列表、按 slug 读文件、保存、删除都走 `/api/admin/content/posts`。
- slug 就是文件名去掉 `.md`。`cleanSlug` 只去掉 `\ / : * ? " < > |`。
- 改 slug 时：用旧文件的 frontmatter 当底，写新文件，upsert SQLite，再删旧文件。
- 发布日期只有日期时写成 `YYYY-MM-DD`；填了时间就写成 `YYYY-MM-DDTHH:mm:ss+08:00`。
- `comment: true` 不写入文件（主题默认就是允许）；只有关掉评论才写 `comment: false`。
- `listPostFiles()` 现在会返回封面 `image`。这行已经在 `content-files.js` 里，但 API 进程停了，要重新启动后列表接口才会带上这个字段。

YAML 板块是整份 GET / PUT：`/api/admin/content/boards/:id`。id 对应 `content-files.js` 里的 `BOARDS`：profile、announcement、banner、features、friends、projects、skills、timeline、diary、anime、devices、music、pio。

上传：`POST /api/admin/upload`，字段名 `file`，可选 `folder`。允许的目录是空、`diary`、`banners`、`friends`、`projects`、`anime`、`devices`。文件落在站点 `public/uploads/` 下。另外还有 `POST /api/admin/media`，写的是同一处。

相册：列表、创建、改 `info.json`、删整个文件夹、上传照片、删一张照片。照片只接受常见图片后缀。

评论：

- 公开 `GET` 只返回 `status = 'visible'`。
- 前台新评论插入为 `pending`，`is_admin = 0`。
- 后台列表可以按文章、状态、关键字筛。
- `PATCH /api/admin/comments/:id` 改状态，`DELETE` 删除。
- `POST /api/admin/comments/:id/reply`：作者用登录用户名，`is_admin = 1`，状态直接 `visible`，内容先转义再入库。
- 前台脚本 `public/blog-dynamic.js` 已改过两处文案：管理员回复后面加 ` · 管理员`；提交成功提示 `已提交，通过审核后显示`。仍然用 `textContent`。除此之外没有改前台。

B 站：`POST /api/admin/bilibili`，用链接或 media id 填追番表单。填完不会自动保存。

### 2. 后台页面，功能

`admin.js` 约 1550 行，一个页面里切板块，不刷新整页。

侧栏三个分组：

- 内容：文章、日记、追番、关于我
- 站点：友链、项目、技能、时间线、相册、设备、个人资料、公告、横幅、音乐、看板娘、模块开关
- 互动：评论

交互：

- 离开有未保存修改的表单时，用自己的确认框，不用 `window.confirm`。
- 评论回复用自己的输入框，不用 `window.prompt`。
- 操作结果用右上角提示，2 秒消失。
- 提交按钮会变成「处理中…」并禁用。
- 文章缺标题、slug、发布日期时，对应字段加 `.field.invalid`。

文章编辑：

- 标题、slug、发布日期/时间、更新日期/时间、分类（已有分类下拉，或新建）、标签芯片、priority、摘要、封面、草稿、置顶、允许评论。
- 标签：回车或英文/中文逗号确认。打开时显示文件里的原文，不是数据库拆好的结果。
- 正文左边 Markdown，右边本地预览。预览先做 HTML 转义再替换标题、列表、链接、图片、代码块。工具栏有加粗、斜体、标题、行内代码、链接、插入图片。
- 封面可以拖到虚线区域，或点选文件，上传到 `public/uploads/`，把返回的路径填进封面输入框。

日记：时间、摘要、心情、地点、标签用表格列出。点编辑才打开表单。时间是普通文本，提示保持 `2026-07-17T06:04:00` 这种无时区字符串，不转成 `+08:00`。图片多张上传到 `public/uploads/diary/`。保存时用原条目打底再盖表单字段，所以文件里多出来的 `expYears`、`expMonths` 会留下来。日记字段列表里没有这两项，不会被收成 `experience`。

追番：表格列出封面、标题、状态、评分、进度。编辑页可以贴 B 站链接抓取后填入。封面上传到 `anime` 目录。

友链、项目、技能、时间线：每条都是展开的大表单，底部一个「保存全部」。删一条只是先从内存拿掉，要点保存才写文件。

技能的年、月在界面上是两个数字，写入文件时收成 `experience: { years, months }`，并删掉临时的 `expYears`、`expMonths`。

个人资料：名字、头像、简介、打字机开关和速度、链接（每行 `名称 | 图标 | 网址`）。保存时展开原对象，只盖这些字段。

公告、横幅、音乐、看板娘、模块开关：各自一个表单，保存时同样先展开原对象。横幅分桌面和移动两组图，上传到 `banners`。模块开关把 yml 里已有的键画成勾选，不新增键。

设备：一整块 JSON 文本框，避免表单漏掉的字段被写丢。

相册：创建文件夹、改标题/日期/地点/简介/标签/排版、拖拽上传照片、删一张、删整个相册。排版目前选项只有「网格」。`columns` 和 `hidden` 沿用原来的值。

评论：按文章、状态（待审 / 已通过 / 已隐藏）、内容搜索。按钮在三个状态之间转。回复、删除都在这一页。

### 3. 下拉和取色器

你说颜色不要手填、能选的不要自己打。对照前台组件后，这些改成了选项：

| 字段 | 选项 |
|---|---|
| 技能等级 | beginner 入门、intermediate 进阶、advanced 熟练、expert 精通 |
| 技能分类 | frontend、backend、database、tools、other |
| 项目状态 | planned、in-progress、completed |
| 时间线类型 | education、work、project、achievement |
| 追番状态 | watching、planned、completed、onhold、dropped |
| 心情 | happy，以及开心、平静、兴奋、疲惫、难过、生气、一般。文件里现有的一条就是 `happy`，前台是原样显示这段文字 |
| 音乐入口 | default、fab |
| 音乐模式 | local、meting |
| 音乐服务 | netease、tencent、kugou、xiami、baidu |
| 音乐类型 | playlist、song、album、artist、search |
| 看板娘位置 | left、right |
| 看板娘模式 | static、fixed、draggable |

技能颜色、时间线颜色是取色器加一个十六进制文本框，两边会互相改。

下拉里没有的旧值不会被清掉，会多一项「现有」并保持选中。

日记时间仍是文本。项目、时间线、追番、相册的日期用 `type="date"`。

### 4. 外观

先读了前台 `src/styles/variables.styl`、`main.css`、按钮和 Markdown 样式，以及 `src/config.ts` 里的 `themeColor.hue: 240`。你确认色板之后，`admin.css` 和 `index.html` 按这套重写，`admin.js` 只改了外壳（侧栏、顶栏、登录页），板块逻辑没拆文件。

- 默认色相 240。亮色和 `html.dark` 两套 oklch 变量，名称对齐前台：`--primary`、`--page-bg`、`--card-bg`、按钮底色、文字 90/75/50、分割线。
- 深色不是简单反色。`index.html` 在绘制前读 `localStorage` 键 `blog2-admin-theme`；没有记录时看系统 `prefers-color-scheme`。后台和前台不同源，所以不共用前台那个主题记录。
- 字体：Roboto、Segoe UI、苹方、微软雅黑。代码：JetBrains Mono、Consolas。没有用前台装饰用的萝莉体 / ZenMaru。
- 主按钮是主色渐变，悬停上移 2px。卡片悬停略抬起。侧栏在 1100px 以下收成抽屉。
- 登录页一块卡片，右上角可以切深色。

### 5. 冒烟测过的

当时 API 重新启动后，用 Node `fetch`（避免 Git Bash 里 curl 把中文弄乱）跑过一轮，结果是：

- `GET /api/admin/me` 返回 `admin`。
- 后台页面 HTTP 200。
- 文章列表 8 篇，和正式文章数量一致。
- 用临时 slug 写过一篇再读文件：作者、语言、`2026-09-29T08:30:00+08:00`、标签「甲」「乙」都还在。临时文件后来删了，正式 8 篇没动。
- 日记图片上传返回 201，路径在 `/uploads/diary/`，站点 `public/uploads/diary/` 里确实有这个文件，测完已删。
- 公开评论插入是 201、状态 `pending`；后台改状态成功；管理员回复的 `is_admin` 为 1。测试评论和回复已删。

`comment: true` 不会出现在文件里，所以上面那轮没有打印 `fileComment`。这是写入规则，不是漏测。

追番封面单独探过 B 站 CDN `i0.hdslb.com`：

- 不带 Referer：200，`image/png`
- Referer 为 `https://www.bilibili.com/`：200
- Referer 为 `http://localhost:3000/admin`：403，返回的是 HTML

所以后台里的 `<img>` 必须加 `referrerpolicy="no-referrer"`。前台追番封面走的是 Astro 的图片处理，不经过这个 Referer，不在这次修改范围内。

## 做到哪一步

功能保存和外观这两段已经落在文件里，也测过。

「追番图片显示不出来；其他板块改成小卡片；上传的图都要能预览」这一轮已经改完（2026-09-29，只动 `admin/admin.js`，`admin.css` 没再改）：

- `fieldHtml` 单图字段改成：预览框（`.shot`）+ 地址输入框 + 「选择图片」按钮（隐藏的 `<input type="file">`）。追番封面是竖版（`.shot.poster`）。
- 新增 `pic()`（小卡片封面图）和 `bindImageFields()`（绑定预览、选图、上传后回填地址并派发 `input`）。
- 文章、日记、追番、友链、项目、技能、时间线的列表全部从表格改成 `.mini-grid` 小卡片。文章卡片用 `post.image` 封面；日记取第一张图；追番是海报竖图；友链取 `imgurl`、项目取 `image`，技能和时间线没有图，只有文字。
- 友链、项目、技能、时间线从「全部展开的大表单 + 保存全部」改成和日记、追番一样：先看小卡片，点编辑才打开单条表单，保存/删除立即写入对应 yml。删除不再等「保存全部」。
- 所有出图片的地方（小卡片、预览框、多图缩略图、相册照片、Markdown 预览）都加了 `referrerpolicy="no-referrer"`，B 站图能显示。
- 上传成功后设置地址并派发 `input`，预览框立即刷新：文章封面、追番封面、友链头像、项目封面、个人资料头像。B 站抓取填入追番表单后也会刷新封面预览。
- 横幅每张图左边加了预览框，手动改地址会跟着刷新。
- `node --check` 通过。

之后按「编辑页和相册页还是很乱」又改了一轮（同样只动 `admin.js` + `admin.css`）：

- 文章编辑页分成四张卡片：基本信息（标题、slug、发布/更新时间）、分类与标签（分类、priority、标签）、内容（摘要、封面、正文编辑器）、设置（草稿、置顶、允许评论）。
- 发布/更新的日期和时间合并成一个 `datetime-local` 输入框。时间 00:00 保存为纯日期，其他保存为 `+08:00` 完整时间，往返无损（`dtValue` / `dtLocal`，`publishedValue` 已删）。空更新时间不写。
- 底部固定操作栏 `.savebar`（sticky bottom）：保存（蓝）/ 取消（灰）/ 右侧阅读量说明，滚动时常驻。
- 封面预览放大为 200×140（`.shot.big`）。
- 相册页改成三态：列表态是 `.mini-grid` 小卡片（`album.cover` 封面 + 标题 + 文件夹名 + 照片数 + 编辑/删除）；点编辑展开单相册完整表单（信息 + 照片 + sticky 操作栏）；「新建相册」按钮点开才显示创建表单，创建后直接进编辑态传照片。上传/删照片后局部刷新（保持编辑态），不再整页 `open("albums")`。
- 新 CSS：`.sec-title`（分区小标题）、`.savebar`、`.shot.big`，`datetime-local` 加入输入框样式选择器。
- `dtValue`/`dtLocal` 用临时脚本测过四种输入的往返转换。

`thumb()` 仍然留着没有调用（`pic()` 和 `bindImagePreview()` 覆盖了所有场景）。

`thumb()` 仍然留着没有调用（`pic()` 和 `bindImagePreview()` 覆盖了所有场景）。

之后又做了一轮（返回按钮、相册隐藏、预览图片路径，外加相册/文章编辑页布局收尾；`admin.js`、`admin.css`、`server/content-files.js` 三个文件）：

- 顶栏左侧加「返回上一页」按钮（`#goback`，`shell()` 里默认隐藏，新增 `setBack(处理器)` 帮助函数）。文章编辑页点亮它，点击回文章列表（走 `open("posts")`，有未保存修改时仍弹确认框）；相册编辑态点亮，点击回列表态；新建表单展开时点亮，点击收起。其他板块不显示。
- 相册隐藏功能：列表卡片上每张多一个「隐藏 / 取消隐藏」按钮，点击立即 PUT 整份 info（翻 `hidden` 位）并局部刷新，隐藏的相册带「已隐藏」徽标；编辑表单里也有同样开关，随「保存」生效（`hidden: input.get("hidden") === "on"`，不再硬编码原值）。
- `saveAlbum`（content-files.js）改成先读原 `info.json` 打底、再覆盖 8 个已知字段。改之前任何一次 PUT 都会把外链相册 ExternalExample 的 `mode`、`cover`、`photos` 写丢。这是服务端代码，已重启 API 生效。
- 相册列表卡片按「封面 + 标题 + 日期 + 照片数量 + 编辑/删除」重排，去掉了文件夹名那一行（文件夹名只在编辑表单标题里出现）；编辑表单去掉重复的大标题，排版和标签合并一行，照片区用 `.sec-title.sub`。
- 文章编辑页「内容」卡片里，封面和编辑器之间加「正文」小节标题，对应「内容：摘要、封面、正文」的分组。四张分组卡片和底部 `.savebar` 不变。
- `mdPreview()` 的图片替换改成回调：`src` 以 http 开头原样，其余（`/uploads/...`、`/images/...`）拼 `SITE`（http://localhost:4321）。Markdown 正文本身不动。这修掉了预览图落到 3000 端口 404 的问题。
- 顺手修了：编辑相册时点「新建相册」，原先会同时显示编辑表单和新建表单，现在先清编辑态。
- `node --check` 通过。API 冒烟（Node fetch）：ExternalExample 隐藏切换往返一次，`mode/cover/photos/tags` 都在，JSON 内容与改前一致；mdPreview 转换逻辑用相同代码跑过，`/` 路径拼 4321、https 原样、无 3000 泄漏。

注意：3000 端口上曾挂着一个 9 月 29 日凌晨 01:27 启动的旧 API 进程（PID 18040），跑的是没有 `image` 字段的旧代码，响应来自它。已被杀掉并重启（2026-09-29 下午）。

## 现在没在跑

Astro（`pnpm dev`，4321）没在跑。Express（3000）启动过一次做冒烟测试：健康检查、后台页面 200、登录、文章列表都通，但当时撞上了上面那个旧进程，`image` 字段没验证到新代码的结果。

## 明确没做的

- 没有改 `E:\blog\pandaC222.github.io`。
- 没有改前台页面结构、主题 CSS、`Layout.astro`。`Layout.astro` 里仍然只有一行 `<script is:inline src="/blog-dynamic.js"></script>`，在 `</body>` 前。
- 没有改 `src/content/posts/测试.md`（那是你本地改过的，不是这次会话动的）。
- 没有 git commit，没有推远程。`server/.env` 不进入版本库。
- 没有开 Twikoo / Giscus。
- 后台不会主动通知 Astro 内容失效。前台要看到刚保存的文章，需要站点的 dev 在跑，并且那一页再刷新一次。

## 个人资料页：社交链接改成结构化卡片

2026-09-29。只动 `admin/admin.js`、`admin/admin.css`，diff 单独存了一份在 `step5-social-links.diff`。

原来「链接」是一个文本域，每行手写 `名称 | 图标 | 网址`。现在每条链接一张卡片：

- 卡头是「#序号 名称」+ 上移 / 下移 / 删除（首尾对应的按钮禁用），底部「＋ 添加链接」。
- 三个字段：名称 / 图标（下拉）/ 网址。下拉来自 `LINK_ICONS`，10 项都用前台已装的图标集校验过（fa7-brands、fa7-solid、simple-icons）。值不在下拉里时自动落到「自定义…」，多出一行手填 Iconify 名称的输入框——所以 `mdi:home` 这类旧值不会被清掉。
- `CUSTOM_ICON = "__custom__"`；`DEFAULT_ICON = "fa7-solid:link"`，用于新卡片和空图标的兜底（前台 Icon 组件拿到空字符串会画不出东西）。
- 保存载荷还是 `{name, icon, url}` 数组，比按行拆更稳；`name` 和 `url` 都空的卡片会被丢掉。
- 顺序就是前台显示顺序，所以上下移、增删也会把 `state.dirty` 置位，离开时会走「还有未保存的修改」。

踩到的坑：`.field` 自带 `display: flex`，是作者样式，会盖掉浏览器默认的 `[hidden] { display: none }`。所以「自定义图标」那行靠 `hidden` 藏不住，补了一条 `.field[hidden] { display: none; }`。

同一个坑还落在顶栏「返回上一页」按钮上：`#goback` 带 `.btn`（`display: inline-flex`），它的 `hidden` 属性其实一直没生效，等于所有页面都会显示这个按钮。这次**没有动**，等你确认。

验证：`node --check` 通过；用 jsdom 临时脚本真跑了一遍 `renderProfile`，22 项断言全过（渲染、下拉选中、自定义回落、改名字同步标题、下移换序、删前确认框、添加、提交载荷、其它字段不丢、保存后清 dirty），脚本用完已删。**没有在浏览器里看过实际外观。**

注意工作区里还留着上次会话未提交的改动：`.tags-box` + `bindTagBox` + 相册标签改用胶囊输入，以及 `step5.md`、`ExternalExample/info.json`。这次的 diff 文件里不含那些。

## 编辑页统一：返回按钮 + 分组布局 + 标签胶囊，推广到所有板块

2026-09-29。只动 `admin/admin.js`、`admin/admin.css`。累计 diff（含上一轮）在 `step5-admin-ui.diff`。

### 两个共用件

- `formFooter(hint, cancelId)`：底部 sticky 操作栏，保存常驻可见，右侧一行说明。传 `cancelId` 就多一个「返回列表」。
- `groupedFieldsHtml({ fields, groups }, item)`：按 `groups` 顺序渲染 `sec-title` 小标题 + 该组字段。**没写进任何分组的字段会兜到「其他」**，所以以后加字段忘了配分组也不会丢。

### 推广到哪些页面

| 页面 | 做了什么 |
|---|---|
| 友链 / 项目 / 技能 / 时间线 | `LISTS` 四张表各加 `groups`；编辑卡改成分组 + `formFooter`；`setBack` 回列表 |
| 日记 / 追番 | 补 `setBack`（列表态 `setBack(null)`，编辑态点亮）；编辑表单改用 `groupedFieldsHtml`；底部操作栏 |
| 音乐 / 看板娘 / 公告 / 模块开关 / 设备 / 关于我 / 个人资料 / 横幅 | 加 `sec-title` 分组 + `formFooter` |

个人资料顺带把「打字机」拆成独立分组；横幅原来是两个裸 `<h3>`，改成 `sec-title` 并把轮播/首页文案收进一张卡。

### 标签胶囊统一

`fieldHtml` 里 `tags` 类型现在渲染 `.tags-box`（不是文本框），所以**日记、追番、友链、项目、技能、时间线一起都换了**，不是只换点名的四个。

- `bindTagBox(box, tags)` 现在返回 `{ commit, set }`：`commit()` 收口还没回车的残字，`set(list)` 整份替换后重画。它自己会把 `state.dirty` 置位（原来不会，相册页漏标过）。
- 新增 `bindTagsFields(card, fields, item)`：把卡片里所有 `[data-tags]` 接上，数组挂 `card.__tags`，盒子挂 `card.__tagBoxes`。
- `readCard` 提交前先 `commit()` 一遍，所以输入框里没按回车的字不会被丢掉。相册页的 `#save` 也补了 `tagBox.commit()`。
- 文章编辑页原来是自己一套 `.chips` + `#tag-input`（40 行），现在换成 `.tags-box` + `bindTagBox`，六个地方一套实现。
- 追番 B 站抓取回填 `genre` 时，字段已经不是 `[data-key]` 输入框了，改成走 `box.set()` 整份替换。

`.chips` 那条 CSS 现在没有引用了，留着没删。

### 模块开关改中文

`FEATURE_LABELS` 把 yml 的键映成中文：追番 / 日记 / 友链 / 项目 / 技能 / 时间线 / 相册 / 设备。中文名后面跟一个小 `.badge` 显示原始键名，方便对着 yml 查。**yml 里没见过的键原样显示**，不新增也不丢键。勾选区改成 `.features-grid` 多列，不再一个开关占一整行。

### 顺手修的 hidden

`.btn` / `.field` 这些作者样式的 `display` 会盖掉浏览器默认的 `[hidden] { display: none }`。原来只在个人资料页单点补了 `.field[hidden]`，现在换成全局一条：

```css
[hidden] { display: none !important; }
```

副作用是顶栏「返回上一页」按钮**现在真的会隐藏了**（之前所有页面都显示着，`setBack(null)` 又把它变成死按钮）。上一轮提过这个 bug，这轮顺手修掉，不再是遗留项。

### 验证

`node --check` 通过；jsdom 临时脚本按场景逐个进程跑，全过：

- `groups`：技能/项目/时间线分组名逐字比对；日记/追番编辑态有返回按钮 + 操作栏，列表态隐藏；各页标签胶囊读到旧值。
- `boards`：音乐 3 组 / 看板娘 4 组 / 公告 3 组 / 模块开关 1 组 / 设备 1 组 / 关于我 1 组 / 个人资料 3 组 / 横幅 4 组 / 日记 5 组 / 追番 6 组，全部有 `.savebar`。
- `features`：8 个中文名、8 个原始键名徽标、保存后 8 个键都在。
- `boardsubmit`：看板娘台词/模型不丢；个人资料 links 结构化提交不变、typewriter/bio 不丢；公告的 `link` 子对象不丢。
- `skills` / `projects` / `timeline` / `anime` / `post`：提交载荷逐项比对（experience 收口、techStack/skills 成数组、B 站 genre 整份替换、文章 tags 删一个加一个）。

**没有在浏览器里看过实际外观。**

### 还没做

- 文章「隐藏」开关：**原博客只有 `draft`，没有 `hidden`**。`src/content.config.ts` 第 67 行是 `draft`，`draft !== true` 的过滤点在 `src/utils/content-utils.ts` 的 4 处，另外 `atom.xml.ts` 和 `og/[...slug].png.ts` 各一处。所以要么直接复用 `draft`（零前台改动），要么新增 `hidden` 字段（要改 schema + 6 处过滤）。等定。
- Step 6 推送。
- 「技能/友链/项目/时间线的列表改卡片 + 点击编辑」这项其实上一轮之前就已经是 `.mini-grid` 小卡片 + 点编辑进单条表单了，不需要再做。

## 修改密码

2026-09-29。动到 `server/index.js`、`server/db.js`、`schema.sql`、`admin/admin.js`，独立 diff 在 `step5-password.diff`。

### 接口

`POST /api/admin/password`，`requireAuth` 保护，载荷 `{ current, next }`。

- 校验：都必填；`next` 至少 8 位、最多 200 位；不能和 `current` 相同。
- 密码用 bcrypt（cost 10，和 `ensureAdmin` 建号时一致）重新哈希后写回 `admin_users.password_hash`。
- **当前密码不对时返回 400，不是 401。** 前端的 `api()` 见到 401 会当成 token 失效，清掉登录态跳回登录页——那样只是打错一次当前密码就被登出了。
- 成功时返回 `{ ok: true, token }`，一串重新签发的 token。前端存进 `sessionStorage`，本机登录态无缝续上。

### 改密后旧 token 作废

`admin_users` 新增一列 `pwd_changed_at`（Unix 秒，默认 0 = 从未改过）。

`requireAuth` 在 `jwt.verify` 之后加了一步：token 的 `iat` 早于 `pwd_changed_at` 一律 401「密码已修改，请重新登录」。也就是**改完密码，其它设备上的登录会失效**，只有改密的这台因为拿到了新 token 不受影响。

顺序上的一个坑：必须**先写库再签发新 token**。反过来（先签后写）会有一个跨秒边界的窗口——`pwd_changed_at` 落在下一秒而新 token 的 `iat` 还停在上一秒——管理员刚改完密码就把自己锁在外面。

老库靠 `db.js` 里的 `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` 自动补列（和 `comments.is_admin` 一个套路），不需要重建数据库。`pwd_changed_at` 默认 0，所以升级后**现有登录不会被踢**，只有真正改过一次密码才开始生效。

注意：`ensureAdmin` 只在 `admin_users` 为空时建号，所以改了密码之后 `server/.env` 里的 `ADMIN_PASSWORD` 不会再覆盖数据库里的密码。

### 后台入口

顶栏「切换深色」和「退出」中间加了一个锁图标按钮，点开是三段输入的弹窗（当前密码 / 新密码 / 确认新密码）：

- 本地先校验长度、两次一致、不与当前相同，**不过就别发请求**；后端返回的错误也显示在弹窗里同一行。
- 校验失败或后端 400 时**弹窗不关**、登录态不清、按钮恢复可点，可以直接改着重试。

### 验证

`node --check` 三个文件全过。

- **真接口端到端**：用新代码在 3100 起了一个实例（没碰 3000 上原来那个），22 项全过——列迁移成功、无 token 打接口 401、`.env` 里的原密码能登录、当前密码错返回 400 且会话仍在、7 位密码/与原密码相同/空密码都被拒、改密后 hash 变了且记下时刻、新 token 可用、**旧 token 被踢回 401**、旧密码登录失败、新密码登录成功。跑完把原来的 `password_hash` 和 `pwd_changed_at` 原样写回，并复验原密码仍可登录，测试实例已杀、临时脚本已删。
- **前端弹窗**：jsdom 里真点了一遍，25 项全过——入口按钮与锁图标、三个 password 框、三条本地校验各自拦下且不发请求、后端 400 时错误回显 + 弹窗不关 + 登录态不清 + 按钮恢复、正常提交的请求体是 `{current,next}`、新 token 存进 `sessionStorage`、弹窗关闭 + 「密码已修改」toast、取消可关闭。

**没有在浏览器里看过实际外观。** 另外 3000 上那个实例是旧代码（不带这个接口），要重启才会生效。

---

## 编辑页版式统一

2026-09-29。动到 `admin/admin.js`、`admin/admin.css`。**没动列表页、没动前台、没加依赖。** 前后对比见 `step5-edit-preview/index.html`。

### 先看一遍，归纳共性问题

把 14 个板块的编辑页在 1440px 下逐个截图看了一遍，共性是：

1. **卡片边界几乎看不见** —— `--shadow-card` 是 `rgba(0,0,0,0.005)`，等于没有；卡片和页底色又接近，整页糊成一片。
2. **区块标题和字段标签长得一样** —— 都是 15px 常规字重，分不出层级。
3. **每个字段都独占一整行** —— 像「经验（月）」这种两位数输入框也占满 900px，右边一大片空白。
4. **字段宽窄和重要性无关** —— 标题和 icon URL 一样宽。
5. **tags-box 是唯一的异类** —— 只有它 `fit-content`，夹在一堆通栏里很突兀。
6. **保存条压住内容** —— 滚动到底部，最后几个字段被悬浮条挡住。
7. **单个 textarea 高度固定** —— 内容多了要手动拉。
8. **`.switch` 孤儿** —— 单独一个开关飘在表单底部，没有归属。
9. **图片字段按钮被拉满** —— 按钮和输入框一起被拉伸变形。

### 做成一套可复用的东西

- **三级表面**：页面底 `--page-bg` → 卡片 `--card-bg` → 卡内下沉块 `--surface-inset`（新增，浅一档）。区块用 `.panel` 包住，`--shadow-panel` 给一条看得见的边。
- **`.panel-title`**：加粗 + 一条 `::after` 横线延伸（`.fgroup` 也用），和字段标签明确区分开。
- **12 栏网格**：每个字段带 `style="--span:N"` 决定占几栏（`FIELD_SPAN` / `SPAN_BY_TYPE` / `spanOf(key, type)`），重要字段给足空间、次要字段不浪费。
- **`.switch-row`**：把零散开关收进一块浅底，一行三个。
- **`.hint`**：统一小字说明色。

### 分批推广 → 已全量

**第一轮**只放了 `skills` 和 `posts`（一个 Set `PANEL_LAYOUT` 控制），技能是「树形字段」、文章是「长内联表单」，两种极端。确认风格后**第二轮把其余 14 个编辑页全铺完**，`PANEL_LAYOUT` 这个开关连同旧版式分支一起删掉了 —— 现在所有编辑页只有一套结构，不再有「老页面」的概念。

三个版本的 `.row`、`.card`（编辑页用的那个）、`.sec-title` 也随之成为死代码，一并从 `admin.css` 里删掉（列表页用的 `.mini` / `.table-wrap` 保留）。

### 全量推广时补的几件事

- **`FIELD_SPAN` 补齐到覆盖所有板块**：新增 `rating / studio / episodes / mood / date / link / sourceCode / visitUrl / imgurl` 等键；`title` 和 `name` 从 9 栏收成 8 栏，这样和 4 栏的「序号 / ID」正好凑满一行（`id 4 + title 8 = 12`、`title 8 + status 4 = 12`）。
- **`SPAN_BY_TYPE.image` 从 6 改成 12**：除「头像」这种明确要并排的小图（`imgurl` 单独设成 6）外，封面独占一行比挤半行好看 —— 左右各留 6 栏空白反而更空。
- **单表单板块的版式积木**：新增 `fGrid / fGroup / fFld / fSw / fSwRow` 五个小工具，让个人资料、公告、音乐这类手写表单也能直接拼出 `.panel + .fgroup + .field-grid`，不用手抄一长串 class。
- **三个通用 CSS 修正**（都是全量铺开后暴露出来的）：
  - `.field > .btn { align-self: flex-start }` —— `.field` 是竖排 flex，里面的按钮会被拉成整行宽（「抓取并填入」曾经撑满一整行）。
  - 图片字段的「选择图片」按钮包进一个 `.toolbar`，同理不再拉伸。
  - `.field-grid > .switch { align-self: end; margin-bottom: 9px }` —— 开关只有 19px 高、输入框有 38px（上面还有 label），默认 stretch 会让开关浮在行中间像错位，现在对齐到输入框的中线。
- **横幅页单独重排**：原来一张图一个 `.card`，7 张桌面图就是 7 张卡片竖着堆。改成一行一张（`display:flex`：缩略图 / 地址 / 上传替换 / 删除并排），`.banner-item` 一条新样式。
- **分组重新划过**：`projects` 从 5 组并成 3 组、`timeline` 从 4 组并成 3 组、`anime` 从 5 组并成 4 组 —— 组数太多会把「分组」这个层级本身稀释掉。

### 效果（整页高度，1440px 宽）

| 板块 | 改前 | 改后 | 变化 |
|---|---|---|---|
| 横幅 | 1921px | **1528px** | −393px |
| 追番 | 1903px | **1524px** | −379px |
| 项目 | 1552px | **1215px** | −337px |
| 时间线 | 1497px | **1175px** | −322px |
| 相册 | 1594px | 1677px | +83px |
| 文章 | 1768px | 1768px | 0（第一轮已改） |
| 技能 | 1146px | 1146px | 0（第一轮已改） |
| 友链 | 1058px | **963px** | −95px |
| 日记 | 1267px | **1217px** | −50px |
| 个人资料 | 1172px | 1205px | +33px |
| 公告 | 900px | 975px | +75px |
| 音乐 / 设备 / 关于我 / 模块开关 | 900px | 900px | 0（本来就一屏放得下） |

几个页面**变高**是正常的：一屏就放得下的短表单，分栏省不出高度，反而因为分组之间补了间距线、卡片补了内边距而略微变长。高度不是目标，**分层和比例**才是。

### 验证

**一、结构断言（14 个板块全过）**：每个编辑页 `#panel` 里恰好 1 个 `.panel`、0 个 `.card`、0 个 `.sec-title`，并且有 `.field-grid`。

**二、保存载荷回归（14/14 逐字段一致）** —— 这是这轮最关键的验证，做法是**完全只读**的：

> 打开编辑页 → 一个值都不改直接点保存 → 在请求发出前拦截 PUT/POST，把请求体截下来并 `abort()` → 和 `GET` 到的原始数据做深比较。

新版式改的是 DOM 结构，`readCard` / `commitItem` 靠的是 `[data-key]` / `[name]` 选择器。如果哪里漏读或读错了一个字段，请求体就会和原始数据对不上。结果 14 个板块**逐字段一致**，一个 `abort` 都没真的落盘。

跑出来的差异只有三类，都是**改动之前就存在的前端归一化**，不是这次引入的：
- 数字型 `id`（`1`）存成字符串（`"1"`）—— id 字段本来就是文本输入框；
- yml 里没有的键（`techStack` / `featured`），表单会补成空默认值（`[]` / `false`）。

**三、列表页零回归**：9 个列表页（文章/日记/追番/技能/友链/项目/时间线/相册/评论）逐个截图，全部走 `.mini` / `.table-wrap`，`card` 命中 0 次，无脚本报错。

**四、深色 + 窄屏**：深色下 `.panel` / `.switch-row` / 分隔线都成立；760px 下实测每个字段 682px 通栏（实测宽度：项目 `346,708,346,346,346` → `682,682,682,682,682`）。

**五、文章页字节级一致**：`shots/after/posts.png` 与上一轮已确认的 `after-posts.png` **完全相同**，说明这轮没碰已经定稿的文章页。

### 这轮踩到的两个测试坑

1. 后台的 token 存在 **`sessionStorage`**（不是 `localStorage`）。第一版只读测试用 `localStorage.getItem("blog2-admin-token")` 取，取到 `null` → GET 返回 `{error:"未登录"}` → `before` 是 `undefined`。更坑的是**文章页看起来「通过」了**：它的 PUT body 是扁平结构没有 `.data`，两边都取到 `undefined`，`undefined === undefined` 于是报了假 OK。**相等的 undefined 比不相等的真实值更像成功。**
2. 文章编辑页的 slug 输入框用 `name="slug"`，而列表页编辑态的用 `data-key="slug"`。测试里只按 `data-key` 找，拿到的 slug 是空串。

### 复现命令

测试脚本都在 `E:\blog\tmp-test\`（不往工作区落），依赖托管 node 里的 `puppeteer-core`：

```bash
# 16 个编辑页截图 + 量高度（before / after）
NODE_PATH="C:/Users/PandaC/.workbuddy/binaries/node/workspace/node_modules" node shot.cjs <输出目录>

# 只读的保存载荷回归（拦截并 abort 所有写请求）
NODE_PATH=... node smoke-payload.cjs

# 深色 / 窄屏抽查
NODE_PATH=... node theme-check.cjs
# 列表页回归
NODE_PATH=... node list-check.cjs
```

---

## 相册封面（后台手选）

2026-09-29。动到 `server/content-files.js`、`server/admin-routes.js`、`admin/admin.js`、`admin/admin.css`，以及**唯一一处前台改动** `pandaC222.github.io/src/utils/album-scanner.ts`。

### 背景

相册封面原来只有「第一张照片」这一种兜底，后台没有选封面的入口。

### 封面优先级

`info.json.cover`（后台「设为封面」写的）> 文件夹里的 `cover.webp` / `cover.jpg` > 第一张照片。

### 前台那三行

原来本地模式只在「没有 `info.cover`」时才去扫 `cover.webp` / `cover.jpg`，扫不到就是 `undefined`。改成：**先扫照片，再按上面的优先级挑封面** —— 这样后台新建的相册前台立刻能看到（以前新建会因为没有 cover 文件而整个不显示）。

新增 `hasManualCover(value)`：校验 `/images/...` 本地路径在磁盘上真的存在（外链 URL 直接放行）。

### 后端

- `listAlbums()` 挑封面改成上面那套优先级，并多返回一个 `coverSource`（`"manual" | "file" | "first" | "none"`），后台据此显示「当前封面来自哪里」。
- 新增 `COVER_FILE = /^cover\.(webp|jpe?g)$/i`，`listAlbums()` 把 `cover.webp` / `cover.jpg` **从 `photos` 里排除掉**。顺手修掉一个隐藏 bug —— 后台照片数原来会把 cover 文件也算进去（22 张真照片显示成 23），而且在后台删掉它会连封面一起删掉。
- 新增 `setAlbumCover(id, name)`：把 `info.json.cover` 写进去（`name` 为空 = 恢复默认，删掉该字段）。校验扩展名 + 文件真实存在，最后重新 `listAlbums()` 取返回值。
- `removeAlbumPhoto` 补一步：如果删掉的正是当前封面，顺手把 `info.json.cover` 清掉，避免前台指空。
- 路由：`POST /api/admin/albums/:id/cover`，体 `{ name }`。

### 后台 UI

相册编辑页新增「封面」区块（`#coverbox`）：显示当前封面 + 来源；照片网格里每张图悬停出现「设为封面」「删除」，当前封面那张带 `.cover-flag` 角标；另有一个「恢复默认」。

### 验证

真接口端到端 **36 项全过**（15 setup + 21 verify）：

- 新建相册 → 传 `a.png` + `b.jpg` → 初始 `coverSource=first`、封面=第一张、`photos.length=2`、`info.json` 里没有 `cover` 字段。
- 设为 jpg 封面 → `200` 且 `coverSource=manual`、`info.json.cover` 写入、其它字段保留、列表接口也返回 `manual`。
- **前台 scanner 单独跑过**：真的读到 `/images/albums/__cover-test/<b.jpg>`，`PHOTOS=2`。
- 非法入参：非图片 400、照片不存在 404、路径穿越被挡、相册不存在 404，且以上失败都没改坏 cover。
- 删掉正当前封面的那张 → `info.json.cover` 自动清掉、回落到第一张。
- 设完封面再保存表单 → cover 没被冲掉、标题也更新了。
- 恢复默认 → `info.json.cover` 删除。
- 跑完测试相册已删干净。

### 测试环境的两个坑

- **沙箱里 node 不能再 spawn node**（`spawnSync ... EBUSY`，`process.execPath` 和系统 node 都试过），所以前台 scanner 不能当子进程跑。测试脚本拆成 `setup` / `verify` 两段，中间用一条独立的顶层命令跑 scanner。
- 自测脚本本身有个 bug：`await cleanup()` 原来写在阶段分支**外面**，verify 阶段一进去就把现场删了，断言全废。已挪进 `setup` 分支。

**提醒**：测试过程在 `public/images/albums/` 下建过一个 `__cover-test` 相册，已通过接口删干净（目录没了、没有残留）。以后这类要写盘的功能，先在 `E:\blog\tmp-test\` 之类的临时目录里做；`server/content-files.js` 的 `siteRoot` 目前是从 `db.js` 的 `rootDir` 派生的，写死指向 `pandaC222.github.io`，要能重定向得再加个 env 开关。

---

## 「实时修改」验证（2026-09-29）

后台保存 → 前台 Astro dev 反映，实测**约 1 秒**，新建 / 修改 / 删除都一样：

| 操作 | 前台可见 / 消失耗时（两次实测） |
|---|---|
| 新建文章 | 675 ms / 674 ms（另一次 1006 ms、1364 ms） |
| 修改文章 | 684 ms / 1053 ms |
| 删除文章 | 892 ms / 1109 ms |

前台详情页、首页列表、归档页都会跟着变；删除后详情页回到 404。

### 两个 URL 注意点（配置行为，不是 bug）

- `astro.config` 里是 **`trailingSlash: "always"`**，所以**必须带尾斜杠**：`/posts/atcoder` 会 404，`/posts/atcoder/` 才是 200。手动验证前台时别漏了。
- **草稿前台看不到**：`first.md` 是 `draft`，所以 `/posts/first/` 404、列表里也不出现。前台 `api/allPostMeta.json` 出 7 条而数据库里 8 条，差的就是这篇草稿。

### 验证方法上的教训

一开始结论是错的（「实时性很差，动辄 60 秒不更新」），原因是**轮询了 900KB 的 HTML 页面**（每 250ms 一次），把单线程的 dev server 压到请求排队，大量虚假超时。

改用轻量接口 **`/api/allPostMeta.json`（1.3KB）** 轮询内容新鲜度之后，结果立刻稳定在 1 秒上下。以后验证前台内容是否更新，都用这个接口，别拿完整页面轮询。

另外两个中途误判，也都是测试方法造成的，**不是产品 bug**：

1. 用 `__realtime-test` 当 slug 时前台一直看不到，一度怀疑「下划线开头的文件被 glob 忽略」。单独耐心复测后，`_x`、`__x`、普通 slug **都能正常出现**（1.0–1.4s）。下划线不会被忽略，当时的失败是被压住的 dev server 造成的。
2. 「删了前台还能看到」——是在 ~1 秒的传播窗口内就去查了；等几秒即恢复正常。

### 环境

- 验证时 3000（Express）与 4321（Astro dev）都在跑，均为最新代码。
- 测试脚本放在 **`E:\blog\tmp-test\`**（`freshness.mjs`、`delete-lag.mjs`、`realtime-check` 系列），不往工作区落脚本。
- 跑完核对：`src/content/posts/` 回到 9 项、数据库 `posts` 8 行、无孤儿 `post_tags`、无残留文件。


