# Step 4：前台接入动态 API

状态：已完成。前台验证通过：页面样式与原博客一致，阅读量和评论都能正常显示。

## 这一步做了什么

不改文章页原有 DOM 和 CSS 类名，只用客户端脚本接阅读量和评论。

`public/blog-dynamic.js` 只在有 `#post-container` 的文章页运行：

- 阅读量：复用原来的 `.umami-page-views` 和 `.page-views-display`，不新建阅读量节点。文案沿用「浏览量 N · 访问次数 N」。同一篇文章 2 秒内的重复请求只计一次。
- 评论：API 成功后，才在文章卡片后面插入一块新区域。类名用主题里已有的 `card-base p-6 mb-4`。评论内容用 `textContent` 写入。API 不可用时不插入，页面保持原样。
- Swup 切换文章后会再挂一次。

`Layout.astro` 在 `</body>` 前引用脚本，并加了 `is:inline`，避免 Astro 打包这段外部脚本：

```html
<script is:inline src="/blog-dynamic.js"></script>
```

未改文章页、PostMeta、评论组件和任何 CSS。原主题评论开关 `commentConfig.enable` 仍是 `false`，没有开启 Twikoo / Giscus。本地评论由脚本自己插入。

`server/index.js` 增加了本地 CORS，只允许：

- `http://localhost:4321`
- `http://127.0.0.1:4321`

其它来源不会带 `Access-Control-Allow-Origin`。

## 产出文件

- `E:\blog\blog2.0\pandaC222.github.io\public\blog-dynamic.js`
- `E:\blog\blog2.0\pandaC222.github.io\src\layouts\Layout.astro`（只多了上面那一行 script）
- `E:\blog\blog2.0\pandaC222.github.io\src\layouts\Layout.astro.bak`（第一次加 script 之前的备份）
- `E:\blog\blog2.0\server\index.js`（CORS）

## 怎么开

```bash
cd E:/blog/blog2.0/pandaC222.github.io
pnpm dev
```

前台：http://localhost:4321/  
文章示例：http://localhost:4321/posts/Round139/

```bash
cd E:/blog/blog2.0/server
npm start
```

API：http://localhost:3000

## 下一步

Step 5：`/admin` 后台。见确认后的实现。主题里原有的 `/admin`（写 Markdown 的本地管理台）先不动。
