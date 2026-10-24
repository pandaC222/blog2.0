import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { db, dbPath, uploadsDir, withTransaction } from "./db.js";
import { registerAdminContent } from "./admin-routes.js";
import { removePostFile, savePublicUpload, siteRoot, writePostFromRow } from "./content-files.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || "dev-only-change-me";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";

function nowISO() {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(new Date());
	const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

function asBool(value, fallback = false) {
	if (value === undefined || value === null || value === "") return fallback;
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	const text = String(value).trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(text)) return true;
	if (["0", "false", "no", "off"].includes(text)) return false;
	return fallback;
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function cleanText(value, max) {
	const text = String(value ?? "")
		.replaceAll("\0", "")
		.trim();
	return text.slice(0, max);
}

function normalizeTags(value) {
	const list = Array.isArray(value)
		? value
		: String(value ?? "")
				.split(/[,，]/)
				.map((item) => item.trim());
	const seen = new Set();
	const tags = [];
	for (const raw of list) {
		const tag = cleanText(raw, 64);
		if (!tag || seen.has(tag)) continue;
		seen.add(tag);
		tags.push(tag);
	}
	return tags;
}

function loadTags(postId) {
	return db
		.prepare(
			"SELECT tag FROM post_tags WHERE post_id = ? ORDER BY sort_order ASC, tag ASC",
		)
		.all(postId)
		.map((row) => row.tag);
}

function replaceTags(postId, tags) {
	db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(postId);
	const insert = db.prepare(
		"INSERT INTO post_tags (post_id, tag, sort_order) VALUES (?, ?, ?)",
	);
	tags.forEach((tag, index) => insert.run(postId, tag, index));
}

function rowToPost(row, { includeBody = false, includeSecrets = false } = {}) {
	const post = {
		id: row.id,
		slug: row.slug,
		alias: row.alias,
		permalink: row.permalink,
		title: row.title,
		published: row.published_at,
		updated: row.updated_at,
		draft: Boolean(row.draft),
		description: row.description,
		image: row.image,
		tags: loadTags(row.id),
		category: row.category,
		lang: row.lang,
		pinned: Boolean(row.pinned),
		comment: Boolean(row.comment),
		priority: row.priority,
		author: row.author,
		sourceLink: row.source_link,
		licenseName: row.license_name,
		licenseUrl: row.license_url,
		encrypted: Boolean(row.encrypted),
		passwordHint: row.password_hint,
		views: row.views,
	};
	if (includeSecrets) post.password = row.password;
	if (includeBody) post.body = row.body;
	return post;
}

function readPostInput(body, { partial = false } = {}) {
	const input = {};
	const set = (key, value) => {
		if (value !== undefined) input[key] = value;
	};

	if (!partial || body.slug !== undefined) set("slug", cleanText(body.slug, 200));
	if (!partial || body.alias !== undefined) {
		set("alias", body.alias ? cleanText(body.alias, 200) : null);
	}
	if (!partial || body.permalink !== undefined) {
		set("permalink", body.permalink ? cleanText(body.permalink, 200) : null);
	}
	if (!partial || body.title !== undefined) set("title", cleanText(body.title, 300));
	if (!partial || body.published !== undefined) {
		set("published_at", cleanText(body.published, 40));
	}
	if (!partial || body.updated !== undefined) {
		set("updated_at", body.updated ? cleanText(body.updated, 40) : null);
	}
	if (!partial || body.draft !== undefined) set("draft", asBool(body.draft) ? 1 : 0);
	if (!partial || body.description !== undefined) {
		set("description", cleanText(body.description, 2000));
	}
	if (!partial || body.image !== undefined) set("image", cleanText(body.image, 500));
	if (!partial || body.category !== undefined) {
		set("category", cleanText(body.category, 100));
	}
	if (!partial || body.lang !== undefined) set("lang", cleanText(body.lang, 20));
	if (!partial || body.pinned !== undefined) set("pinned", asBool(body.pinned) ? 1 : 0);
	if (!partial || body.comment !== undefined) {
		set("comment", asBool(body.comment, true) ? 1 : 0);
	}
	if (!partial || body.priority !== undefined) {
		if (body.priority === "" || body.priority === null || body.priority === undefined) {
			set("priority", null);
		} else {
			const priority = Number(body.priority);
			if (!Number.isFinite(priority)) {
				throw Object.assign(new Error("priority 必须是数字"), { status: 400 });
			}
			set("priority", priority);
		}
	}
	if (!partial || body.author !== undefined) set("author", cleanText(body.author, 100));
	if (!partial || body.sourceLink !== undefined) {
		set("source_link", cleanText(body.sourceLink, 500));
	}
	if (!partial || body.licenseName !== undefined) {
		set("license_name", cleanText(body.licenseName, 100));
	}
	if (!partial || body.licenseUrl !== undefined) {
		set("license_url", cleanText(body.licenseUrl, 500));
	}
	if (!partial || body.encrypted !== undefined) {
		set("encrypted", asBool(body.encrypted) ? 1 : 0);
	}
	if (!partial || body.password !== undefined) {
		set("password", cleanText(body.password, 200));
	}
	if (!partial || body.passwordHint !== undefined) {
		set("password_hint", cleanText(body.passwordHint, 200));
	}
	if (!partial || body.body !== undefined) set("body", String(body.body ?? ""));
	if (!partial || body.tags !== undefined) set("tags", normalizeTags(body.tags));
	return input;
}

function ensureAdmin() {
	const existing = db.prepare("SELECT id FROM admin_users LIMIT 1").get();
	if (existing) return;
	const password = ADMIN_PASSWORD || crypto.randomBytes(9).toString("base64url");
	const hash = bcrypt.hashSync(password, 10);
	db.prepare("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)").run(
		ADMIN_USER,
		hash,
	);
	if (!ADMIN_PASSWORD) {
		console.log(`[blog2] 已创建管理员 ${ADMIN_USER}，初始密码：${password}`);
		console.log("[blog2] 请写入 server/.env 的 ADMIN_PASSWORD，避免下次重置。");
	} else {
		console.log(`[blog2] 已创建管理员 ${ADMIN_USER}`);
	}
}

ensureAdmin();

const app = express();
const ALLOWED_ORIGINS = new Set([
	"http://localhost:4321",
	"http://127.0.0.1:4321",
]);
app.use((req, res, next) => {
	const origin = req.headers.origin;
	if (origin && ALLOWED_ORIGINS.has(origin)) {
		res.setHeader("Access-Control-Allow-Origin", origin);
		res.setHeader("Vary", "Origin");
		res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
		res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
	}
	if (req.method === "OPTIONS") {
		res.sendStatus(204);
		return;
	}
	next();
});
app.use(express.json({ limit: "2mb" }));

app.use("/uploads", express.static(uploadsDir));
app.use("/admin", express.static(path.join(__dirname, "..", "admin")));

function signToken(user) {
	return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
		expiresIn: "7d",
	});
}

function requireAuth(req, res, next) {
	const header = req.headers.authorization || "";
	const token = header.startsWith("Bearer ") ? header.slice(7) : "";
	if (!token) return res.status(401).json({ error: "未登录" });
	try {
		req.user = jwt.verify(token, JWT_SECRET);
	} catch {
		return res.status(401).json({ error: "登录已失效" });
	}
	// 改过密码之后，签发时间早于改密时刻的 token 一律作废（= 其它设备被踢下线）。
	// 改密接口会同时下发一个重新签发的 token，所以改密的本机不会被踢。
	const row = db.prepare("SELECT pwd_changed_at FROM admin_users WHERE id = ?").get(req.user.id);
	if (!row) return res.status(401).json({ error: "登录已失效" });
	if (row.pwd_changed_at && Number(req.user.iat || 0) < row.pwd_changed_at) {
		return res.status(401).json({ error: "密码已修改，请重新登录" });
	}
	next();
}

// Astro 生成的路由会把标题式 slug 归一化：
//   "AtCoder"                          -> atcoder
//   "Codeforces Round 1090 (Div. 4)"   -> codeforces-round-1090-div-4
// 而库里的 slug 存的是原文。前台脚本按 URL 取 slug 来查，两边对不上就会 404，
// 表现为「阅读量和评论不工作」。所以精确匹配不到时，按同样的规则再比一次。
function normalizeSlug(value) {
	return String(value || "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "-")
		.replace(/^-+|-+$/g, "");
}

function getPostBySlug(slug, { includeDraft = false } = {}) {
	const row = includeDraft
		? db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug)
		: db.prepare("SELECT * FROM posts WHERE slug = ? AND draft = 0").get(slug);
	if (row) return row;
	// 精确匹配不到才回退（文章量很小，全表扫一遍无所谓）
	const target = normalizeSlug(slug);
	if (!target) return null;
	const rows = includeDraft
		? db.prepare("SELECT * FROM posts").all()
		: db.prepare("SELECT * FROM posts WHERE draft = 0").all();
	return rows.find((item) => normalizeSlug(item.slug) === target) || null;
}

app.get("/api/health", (_req, res) => {
	res.json({ ok: true, db: dbPath });
});

app.post("/api/admin/login", (req, res) => {
	const username = cleanText(req.body?.username, 64);
	const password = String(req.body?.password ?? "");
	const user = db
		.prepare("SELECT id, username, password_hash FROM admin_users WHERE username = ?")
		.get(username);
	if (!user || !bcrypt.compareSync(password, user.password_hash)) {
		return res.status(401).json({ error: "用户名或密码错误" });
	}
	res.json({ token: signToken(user), username: user.username });
});

app.get("/api/admin/me", requireAuth, (req, res) => {
	res.json({ id: req.user.id, username: req.user.username });
});

// 改密码。注意：当前密码不对时返回 400 而不是 401 —— 前端 api() 见到 401 会当成
// token 失效、清掉登录态并跳回登录页，那样只是打错一次当前密码就被登出了。
app.post("/api/admin/password", requireAuth, (req, res) => {
	const current = String(req.body?.current ?? "");
	const next = String(req.body?.next ?? "");
	if (!current || !next) return res.status(400).json({ error: "请填写当前密码和新密码" });
	if (next.length < 8) return res.status(400).json({ error: "新密码至少 8 位" });
	if (next.length > 200) return res.status(400).json({ error: "新密码太长了（最多 200 位）" });
	if (next === current) return res.status(400).json({ error: "新密码和当前密码一样" });
	const user = db
		.prepare("SELECT id, username, password_hash FROM admin_users WHERE id = ?")
		.get(req.user.id);
	if (!user) return res.status(401).json({ error: "登录已失效" });
	if (!bcrypt.compareSync(current, user.password_hash)) {
		return res.status(400).json({ error: "当前密码不对" });
	}
	// 先落库再签发新 token：新 token 的 iat 一定 >= pwd_changed_at，不会被下面的校验踢掉。
	// 顺序反过来（先签后写）会有一个跨秒边界的窗口，把管理员自己锁在外面。
	const changedAt = Math.floor(Date.now() / 1000);
	db.prepare("UPDATE admin_users SET password_hash = ?, pwd_changed_at = ? WHERE id = ?").run(
		bcrypt.hashSync(next, 10),
		changedAt,
		user.id,
	);
	res.json({ ok: true, token: signToken(user) });
});

function listPosts(req, { includeDraft = false, includeSecrets = false } = {}) {
	const where = [];
	const params = [];
	if (!includeDraft) where.push("p.draft = 0");
	if (req.query.category) {
		where.push("p.category = ?");
		params.push(String(req.query.category));
	}
	if (req.query.tag) {
		where.push(
			"EXISTS (SELECT 1 FROM post_tags t WHERE t.post_id = p.id AND t.tag = ?)",
		);
		params.push(String(req.query.tag));
	}
	if (req.query.q) {
		where.push("(p.title LIKE ? OR p.description LIKE ? OR p.slug LIKE ?)");
		const like = `%${String(req.query.q)}%`;
		params.push(like, like, like);
	}
	if (req.query.draft === "1" || req.query.draft === "0") {
		if (!includeDraft) return { error: "无权按草稿筛选", status: 403 };
		where.push("p.draft = ?");
		params.push(Number(req.query.draft));
	}
	const sql = `
		SELECT p.* FROM posts p
		${where.length ? `WHERE ${where.join(" AND ")}` : ""}
		ORDER BY p.pinned DESC, p.priority IS NULL, p.priority ASC, p.published_at DESC, p.id DESC
	`;
	const includeBody = req.query.include === "body";
	const posts = db
		.prepare(sql)
		.all(...params)
		.map((row) => rowToPost(row, { includeBody, includeSecrets }));
	return { posts };
}

app.get("/api/posts", (req, res) => {
	const result = listPosts(req);
	if (result.error) return res.status(result.status).json({ error: result.error });
	res.json(result);
});

app.get("/api/posts/:slug", (req, res) => {
	const row = getPostBySlug(req.params.slug);
	if (!row) return res.status(404).json({ error: "文章不存在" });
	res.json(rowToPost(row, { includeBody: true }));
});

app.post("/api/posts/:slug/view", (req, res) => {
	const row = getPostBySlug(req.params.slug);
	if (!row) return res.status(404).json({ error: "文章不存在" });
	db.prepare("UPDATE posts SET views = views + 1 WHERE id = ?").run(row.id);
	const updated = db.prepare("SELECT views FROM posts WHERE id = ?").get(row.id);
	res.json({ slug: row.slug, views: updated.views });
});

app.get("/api/posts/:slug/comments", (req, res) => {
	const row = getPostBySlug(req.params.slug);
	if (!row) return res.status(404).json({ error: "文章不存在" });
	const comments = db
		.prepare(
			`SELECT id, parent_id, author, content, is_admin, created_at
			 FROM comments
			 WHERE post_id = ? AND status = 'visible'
			 ORDER BY created_at ASC, id ASC`,
		)
		.all(row.id);
	res.json({ comments });
});

app.post("/api/posts/:slug/comments", (req, res) => {
	const row = getPostBySlug(req.params.slug);
	if (!row) return res.status(404).json({ error: "文章不存在" });
	if (!row.comment) return res.status(403).json({ error: "本文已关闭评论" });

	const author = escapeHtml(cleanText(req.body?.author, 64));
	const content = escapeHtml(cleanText(req.body?.content, 2000));
	const email = cleanText(req.body?.email, 200);
	if (!author || !content) {
		return res.status(400).json({ error: "昵称和内容不能为空" });
	}
	if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return res.status(400).json({ error: "邮箱格式不正确" });
	}

	let parentId = null;
	if (req.body?.parentId) {
		parentId = Number(req.body.parentId);
		const parent = db
			.prepare(
				"SELECT id FROM comments WHERE id = ? AND post_id = ? AND status = 'visible'",
			)
			.get(parentId, row.id);
		if (!parent) return res.status(400).json({ error: "回复的评论不存在" });
	}

	const ipHash = crypto
		.createHash("sha256")
		.update(String(req.ip || ""))
		.digest("hex")
		.slice(0, 16);
	const createdAt = nowISO();
	const info = db
		.prepare(
			`INSERT INTO comments (post_id, parent_id, author, email, content, status, is_admin, ip_hash, created_at)
			 VALUES (?, ?, ?, ?, ?, 'pending', 0, ?, ?)`,
		)
		.run(row.id, parentId, author, email, content, ipHash, createdAt);

	res.status(201).json({
		comment: {
			id: Number(info.lastInsertRowid),
			parent_id: parentId,
			author,
			content,
			created_at: createdAt,
		},
	});
});

app.get("/api/admin/posts", requireAuth, (req, res) => {
	const result = listPosts(req, { includeDraft: true, includeSecrets: true });
	res.json(result);
});

app.get("/api/admin/posts/:id", requireAuth, (req, res) => {
	const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(Number(req.params.id));
	if (!row) return res.status(404).json({ error: "文章不存在" });
	res.json(rowToPost(row, { includeBody: true, includeSecrets: true }));
});

app.post("/api/admin/posts", requireAuth, (req, res) => {
	let input;
	try {
		input = readPostInput(req.body || {});
	} catch (error) {
		return res.status(error.status || 400).json({ error: error.message });
	}
	if (!input.title) return res.status(400).json({ error: "title 不能为空" });
	if (!input.published_at) return res.status(400).json({ error: "published 不能为空" });
	if (!input.slug) input.slug = `post-${Date.now()}`;

	try {
		const id = withTransaction(() => {
			const info = db
				.prepare(
					`INSERT INTO posts (
						slug, alias, permalink, title, published_at, updated_at, draft, description,
						image, category, lang, pinned, comment, priority, author, source_link,
						license_name, license_url, encrypted, password, password_hint, body,
						created_at, db_updated_at
					) VALUES (
						?, ?, ?, ?, ?, ?, ?, ?,
						?, ?, ?, ?, ?, ?, ?, ?,
						?, ?, ?, ?, ?, ?,
						?, ?
					)`,
				)
				.run(
					input.slug,
					input.alias,
					input.permalink,
					input.title,
					input.published_at,
					input.updated_at,
					input.draft ?? 0,
					input.description ?? "",
					input.image ?? "",
					input.category ?? "",
					input.lang ?? "",
					input.pinned ?? 0,
					input.comment ?? 1,
					input.priority ?? null,
					input.author ?? "",
					input.source_link ?? "",
					input.license_name ?? "",
					input.license_url ?? "",
					input.encrypted ?? 0,
					input.password ?? "",
					input.password_hint ?? "",
					input.body ?? "",
					nowISO(),
					nowISO(),
				);
			const postId = Number(info.lastInsertRowid);
			replaceTags(postId, input.tags ?? []);
			return postId;
		});
		const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
		try {
			writePostFromRow(row, loadTags(row.id));
		} catch (fileError) {
			return res.status(500).json({
				error: `数据库已保存，Markdown 写入失败：${fileError.message}`,
			});
		}
		res.status(201).json(rowToPost(row, { includeBody: true, includeSecrets: true }));
	} catch (error) {
		if (String(error.message).includes("UNIQUE")) {
			return res.status(409).json({ error: "slug、alias 或 permalink 已存在" });
		}
		throw error;
	}
});

app.put("/api/admin/posts/:id", requireAuth, (req, res) => {
	const id = Number(req.params.id);
	const current = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
	if (!current) return res.status(404).json({ error: "文章不存在" });

	let input;
	try {
		input = readPostInput(req.body || {}, { partial: true });
	} catch (error) {
		return res.status(error.status || 400).json({ error: error.message });
	}

	const next = {
		slug: input.slug ?? current.slug,
		alias: input.alias === undefined ? current.alias : input.alias,
		permalink: input.permalink === undefined ? current.permalink : input.permalink,
		title: input.title ?? current.title,
		published_at: input.published_at ?? current.published_at,
		updated_at: input.updated_at === undefined ? current.updated_at : input.updated_at,
		draft: input.draft ?? current.draft,
		description: input.description ?? current.description,
		image: input.image ?? current.image,
		category: input.category ?? current.category,
		lang: input.lang ?? current.lang,
		pinned: input.pinned ?? current.pinned,
		comment: input.comment ?? current.comment,
		priority: input.priority === undefined ? current.priority : input.priority,
		author: input.author ?? current.author,
		source_link: input.source_link ?? current.source_link,
		license_name: input.license_name ?? current.license_name,
		license_url: input.license_url ?? current.license_url,
		encrypted: input.encrypted ?? current.encrypted,
		password: input.password ?? current.password,
		password_hint: input.password_hint ?? current.password_hint,
		body: input.body ?? current.body,
	};
	if (!next.title) return res.status(400).json({ error: "title 不能为空" });
	if (!next.slug) return res.status(400).json({ error: "slug 不能为空" });
	if (!next.published_at) return res.status(400).json({ error: "published 不能为空" });

	try {
		withTransaction(() => {
			db.prepare(
				`UPDATE posts SET
					slug = ?, alias = ?, permalink = ?, title = ?, published_at = ?, updated_at = ?,
					draft = ?, description = ?, image = ?, category = ?, lang = ?, pinned = ?,
					comment = ?, priority = ?, author = ?, source_link = ?, license_name = ?,
					license_url = ?, encrypted = ?, password = ?, password_hint = ?, body = ?,
					db_updated_at = ?
				 WHERE id = ?`,
			).run(
				next.slug,
				next.alias,
				next.permalink,
				next.title,
				next.published_at,
				next.updated_at,
				next.draft,
				next.description,
				next.image,
				next.category,
				next.lang,
				next.pinned,
				next.comment,
				next.priority,
				next.author,
				next.source_link,
				next.license_name,
				next.license_url,
				next.encrypted,
				next.password,
				next.password_hint,
				next.body,
				nowISO(),
				id,
			);
			if (input.tags) replaceTags(id, input.tags);
		});
	} catch (error) {
		if (String(error.message).includes("UNIQUE")) {
			return res.status(409).json({ error: "slug、alias 或 permalink 已存在" });
		}
		throw error;
	}

	const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
	try {
		writePostFromRow(row, loadTags(row.id));
		if (current.slug !== row.slug) removePostFile(current.slug);
	} catch (fileError) {
		return res.status(500).json({
			error: `数据库已保存，Markdown 写入失败：${fileError.message}`,
		});
	}
	res.json(rowToPost(row, { includeBody: true, includeSecrets: true }));
});

app.delete("/api/admin/posts/:id", requireAuth, (req, res) => {
	const id = Number(req.params.id);
	const existing = db.prepare("SELECT slug FROM posts WHERE id = ?").get(id);
	const info = db.prepare("DELETE FROM posts WHERE id = ?").run(id);
	if (!info.changes) return res.status(404).json({ error: "文章不存在" });
	if (existing) {
		try {
			removePostFile(existing.slug);
		} catch (fileError) {
			return res.status(500).json({
				error: `数据库记录已删除，Markdown 删除失败：${fileError.message}`,
			});
		}
	}
	res.json({ ok: true });
});

const upload = multer({
	storage: multer.diskStorage({
		destination: (_req, _file, cb) => cb(null, uploadsDir),
		filename: (_req, file, cb) => {
			const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
			const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : "";
			cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${safeExt}`);
		},
	}),
	limits: { fileSize: 8 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (!file.mimetype.startsWith("image/")) {
			cb(new Error("只能上传图片"));
			return;
		}
		cb(null, true);
	},
});

const memoryUpload = multer({
	storage: multer.memoryStorage(),
	limits: { fileSize: 8 * 1024 * 1024 },
	fileFilter: (_req, file, cb) => {
		if (!String(file.mimetype || "").startsWith("image/")) {
			cb(new Error("只能上传图片"));
			return;
		}
		cb(null, true);
	},
});

app.post("/api/admin/upload", requireAuth, (req, res) => {
	memoryUpload.single("file")(req, res, (error) => {
		if (error) return res.status(400).json({ error: error.message });
		if (!req.file) return res.status(400).json({ error: "缺少文件字段 file" });
		try {
			const saved = savePublicUpload(req.file.buffer, req.file.originalname, req.body?.folder || "");
			db.prepare(
				`INSERT INTO uploads (filename, original_name, mime, size_bytes, public_path)
				 VALUES (?, ?, ?, ?, ?)`,
			).run(
				path.basename(saved.url),
				cleanText(req.file.originalname, 200),
				req.file.mimetype,
				req.file.size,
				saved.url,
			);
			res.status(201).json({ url: saved.url });
		} catch (err) {
			res.status(err.status || 500).json({ error: err.message || "上传失败" });
		}
	});
});

app.get("/api/admin/comments", requireAuth, (req, res) => {
	const params = [];
	const where = [];
	if (req.query.postId) {
		where.push("c.post_id = ?");
		params.push(Number(req.query.postId));
	}
	if (req.query.status && ["visible", "hidden", "pending"].includes(String(req.query.status))) {
		where.push("c.status = ?");
		params.push(String(req.query.status));
	}
	if (req.query.q) {
		where.push("c.content LIKE ?");
		params.push("%" + String(req.query.q) + "%");
	}
	const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
	const comments = db
		.prepare(
			`SELECT c.id, c.post_id, p.slug, p.title AS post_title, c.parent_id, c.author, c.email, c.content,
			        c.status, c.is_admin, c.created_at
			 FROM comments c
			 JOIN posts p ON p.id = c.post_id
			 ${whereSql}
			 ORDER BY c.created_at DESC, c.id DESC`,
		)
		.all(...params);
	res.json({ comments });
});

app.patch("/api/admin/comments/:id", requireAuth, (req, res) => {
	const status = String(req.body?.status || "");
	if (!["visible", "hidden", "pending"].includes(status)) {
		return res.status(400).json({ error: "status 只能是 visible、hidden 或 pending" });
	}
	const info = db
		.prepare("UPDATE comments SET status = ? WHERE id = ?")
		.run(status, Number(req.params.id));
	if (!info.changes) return res.status(404).json({ error: "评论不存在" });
	res.json({ ok: true });
});

app.delete("/api/admin/comments/:id", requireAuth, (req, res) => {
	const info = db.prepare("DELETE FROM comments WHERE id = ?").run(Number(req.params.id));
	if (!info.changes) return res.status(404).json({ error: "评论不存在" });
	res.json({ ok: true });
});

app.post("/api/admin/comments/:id/reply", requireAuth, (req, res) => {
	const parent = db.prepare("SELECT id, post_id FROM comments WHERE id = ?").get(Number(req.params.id));
	if (!parent) return res.status(404).json({ error: "评论不存在" });
	const content = escapeHtml(cleanText(req.body?.content, 2000));
	if (!content) return res.status(400).json({ error: "回复不能为空" });
	const author = escapeHtml(cleanText(req.user?.username || "admin", 64));
	const createdAt = nowISO();
	const info = db.prepare(
		`INSERT INTO comments (post_id, parent_id, author, content, status, is_admin, created_at)
		 VALUES (?, ?, ?, ?, 'visible', 1, ?)`,
	).run(parent.post_id, parent.id, author, content, createdAt);
	res.status(201).json({
		comment: {
			id: Number(info.lastInsertRowid),
			post_id: parent.post_id,
			parent_id: parent.id,
			author,
			content,
			status: "visible",
			is_admin: 1,
			created_at: createdAt,
		},
	});
});

registerAdminContent(app, requireAuth);

/* ---------------------------------------------------------------------------
   重建前台静态站
   前台是 output:"static"，后台改完 .md/.yml 只是落盘，必须重新 astro build
   前台才会变。这里异步跑一次构建，请求立即返回，不阻塞保存。
   构建命令由环境变量 REBUILD_CMD 给（见 deploy/），没配就整体禁用。
   --------------------------------------------------------------------------- */
const REBUILD_CMD = process.env.REBUILD_CMD || "";
let rebuildState = { running: false, startedAt: null, finishedAt: null, ok: null, error: "", log: "" };
let rebuildQueued = false;

function startRebuild() {
	rebuildState = { running: true, startedAt: nowISO(), finishedAt: null, ok: null, error: "", log: "" };
	let out = "";
	const child = spawn(REBUILD_CMD, { cwd: siteRoot, shell: true });
	child.stdout?.on("data", (chunk) => {
		out += chunk.toString();
	});
	child.stderr?.on("data", (chunk) => {
		out += chunk.toString();
	});
	child.on("error", (error) => {
		rebuildState = { ...rebuildState, running: false, finishedAt: nowISO(), ok: false, error: String(error?.message || error) };
		console.error("[blog2] rebuild 启动失败", error);
	});
	child.on("close", (code) => {
		rebuildState = {
			...rebuildState,
			running: false,
			finishedAt: nowISO(),
			ok: code === 0,
			error: code === 0 ? "" : `构建退出码 ${code}`,
			log: out.slice(-4000),
		};
		console.log(`[blog2] rebuild ${code === 0 ? "完成" : "失败"}（退出码 ${code}）`);
		// 构建期间又有保存，末尾补跑一次，保证最后一次改动生效
		if (rebuildQueued) {
			rebuildQueued = false;
			startRebuild();
		}
	});
}

app.get("/api/admin/rebuild", requireAuth, (_req, res) => {
	res.json({ configured: Boolean(REBUILD_CMD), ...rebuildState });
});

app.post("/api/admin/rebuild", requireAuth, (_req, res) => {
	if (!REBUILD_CMD) return res.status(503).json({ error: "未配置 REBUILD_CMD，无法重建" });
	if (rebuildState.running) {
		rebuildQueued = true;
		return res.status(202).json({ ok: true, queued: true, message: "已有构建在跑，排在它后面" });
	}
	startRebuild();
	res.status(202).json({ ok: true, message: "已开始重建" });
});

app.use((error, _req, res, _next) => {
	console.error(error);
	res.status(500).json({ error: "服务器错误" });
});

app.listen(PORT, () => {
	console.log(`[blog2] API http://localhost:${PORT}`);
	console.log(`[blog2] db ${dbPath}`);
	if (!fs.existsSync(new URL("./.env", import.meta.url))) {
		console.log("[blog2] 未找到 server/.env，可复制 server/.env.example");
	}
});
