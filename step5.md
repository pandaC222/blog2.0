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
