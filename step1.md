# Step 1：SQLite schema 设计

## 这一步做了什么

对照副本 `pandaC222.github.io/src/content.config.ts` 和 `src/content/posts` 里 8 篇文章的 Front-matter，设计了动态博客的 SQLite 表。字段已和原 schema 核对，并经确认。

日期存成带 `+08:00` 的文本，不存无时区时间。纯日期 `YYYY-MM-DD` 表示站点时区当天 `00:00:00`。`prevTitle` / `prevSlug` / `nextTitle` / `nextSlug` 不入库，读取时再算。

## 产出文件

- `E:\blog\blog2.0\schema.sql`

## 表

| 表 | 作用 |
|---|---|
| `posts` | 一篇文章一行。`slug` 来自文件名（去掉 `.md`）。正文是去掉 Front-matter 的原始 Markdown。另加 `views`。 |
| `post_tags` | 标签，多行。有 `sort_order`，保留原顺序。主键 `(post_id, tag)`。 |
| `comments` | 本地评论。只存文本，输出前做 HTML 转义。 |
| `admin_users` | 后台账号，只存密码哈希。 |
| `uploads` | 本地上传图片，公开路径如 `/uploads/...`。 |

## posts 与 Front-matter 的对应

| 库字段 | Front-matter | 说明 |
|---|---|---|
| `title` | `title` | 必填 |
| `published_at` | `published` | 必填，`+08:00` |
| `updated_at` | `updated` | 可空 |
| `draft` | `draft` | 0/1，默认 0 |
| `description` | `description` | 默认空字符串 |
| `image` | `image` | 封面，不是 `cover` |
| `category` | `category` | 单个字符串，不是数组 |
| `lang` | `lang` | 默认空 |
| `pinned` | `pinned` | 0/1，默认 0 |
| `comment` | `comment` | 0/1，默认 1 |
| `priority` | `priority` | 可空，置顶排序用 |
| `author` | `author` | 默认空 |
| `source_link` | `sourceLink` | 默认空 |
| `license_name` | `licenseName` | 默认空 |
| `license_url` | `licenseUrl` | 默认空 |
| `encrypted` / `password` / `password_hint` | 同名加密字段 | 现有文章未使用 |
| `alias` / `permalink` | 同名 | 现有文章未使用 |
| `post_tags.tag` | `tags` | 字符串数组 |

## 下一步

Step 2 已做完：本地 Express API。见 `step2.md`。
