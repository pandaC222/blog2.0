# Step 3：存量 Markdown 迁移

## 这一步做了什么

只读副本 `pandaC222.github.io/src/content/posts`，不读、不改原仓库 `E:\blog\pandaC222.github.io`。

脚本用 YAML failsafe 解析 Front-matter，保留原始正文。纯日期补成当天 `00:00:00+08:00`；原来已带偏移的时间换成同一时刻的 `+08:00` 文本。标签按中文逗号 `，` 拆开，顺序保留。`Round139.md` 的 `[牛客周赛，算法]` 拆成 `牛客周赛`、`算法`。

先写入测试库并做字段断言，正文再和源文件逐篇比较，通过后才写入正式库。重复运行按 `slug` 更新，不把已有阅读量清零。

## 产出文件

- `E:\blog\blog2.0\server\migrate.js`
- `server/package.json` 里的脚本：`migrate:test`、`migrate`
- 测试库 `E:\blog\blog2.0\data\blog.test.db`
- 正式库 `E:\blog\blog2.0\data\blog.db`（8 篇文章）
- 报告 `data/migrate-test-report.json`、`data/migrate-apply-report.json`（已被 gitignore）

## 怎么再跑

```bash
cd E:/blog/blog2.0/server
npm run migrate:test
npm run migrate
```

`migrate` 会先重建测试库并断言，通过后才写入 `data/blog.db`。

## 迁移结果

8 个文件，14 条标签。正文和源文件一致，没有把 Front-matter 写进正文。公开接口能读到 7 篇；`first` 是草稿，公开接口 404。

| slug | 标题 | published | 标签 | 备注 |
|---|---|---|---|---|
| first | 我的第一篇博客 | `2026-04-04T00:00:00+08:00` | 博客 | 草稿 |
| Codeforces Round 1090 (Div. 4) | Codeforces Round 1090 (Div.4)题解 | `2026-04-05T00:00:00+08:00` | 算法, Codeforces | |
| nowcoderpratice | 牛客竞赛每日一题 | `2026-04-05T01:49:00+08:00` | 算法, 每日一题 | 置顶，priority 1 |
| blogban | 自用板子 | `2026-04-05T14:42:00+08:00` | 算法, 模板 | |
| cfpratice | Codeforces每日一题 | `2026-04-07T00:00:00+08:00` | Codeforces, 每日一题 | 置顶，priority 2 |
| AtCoder | AtCoder Beginner Contest 453复盘 | `2026-04-12T00:00:00+08:00` | AtCoder, 算法 | |
| Round139 | 牛客周赛139 | `2026-04-13T00:00:00+08:00` | 牛客周赛, 算法 | 中文逗号已拆开 |
| 测试 | 测试测试 | `2026-07-17T20:56:00+08:00` | 测试 | |

## 下一步

Step 4 进行中：前台用独立脚本接阅读量和评论。见 `step4.md`。
