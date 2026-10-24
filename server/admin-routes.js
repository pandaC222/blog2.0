import multer from "multer";
import { db, withTransaction } from "./db.js";
import { fetchBangumi } from "./bilibili.js";
import {
	BOARDS,
	cleanSlug,
	listAlbums,
	listPostFiles,
	readAbout,
	readBoard,
	readPostFile,
	removeAlbum,
	removeAlbumPhoto,
	removePostFile,
	saveAlbum,
	saveAlbumPhoto,
	savePublicUpload,
	setAlbumCover,
	writeAbout,
	writeBoard,
	writePostFile,
} from "./content-files.js";

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

function splitTags(value) {
	const list = Array.isArray(value) ? value : String(value ?? "").split(/[,，]/);
	const seen = new Set();
	const tags = [];
	for (const raw of list) {
		const tag = String(raw ?? "").trim().slice(0, 64);
		if (!tag || seen.has(tag)) continue;
		seen.add(tag);
		tags.push(tag);
	}
	return tags;
}

function asInt(value, fallback) {
	if (value === undefined || value === null || value === "") return fallback;
	if (typeof value === "boolean") return value ? 1 : 0;
	if (typeof value === "number") return value ? 1 : 0;
	const text = String(value).trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(text)) return 1;
	if (["0", "false", "no", "off"].includes(text)) return 0;
	return fallback;
}

function sendError(res, error) {
	const status = error.status || 500;
	if (status >= 500) console.error(error);
	res.status(status).json({ error: error.message || "服务器错误" });
}

function replaceTags(postId, tags) {
	db.prepare("DELETE FROM post_tags WHERE post_id = ?").run(postId);
	const insert = db.prepare(
		"INSERT INTO post_tags (post_id, tag, sort_order) VALUES (?, ?, ?)",
	);
	tags.forEach((tag, index) => insert.run(postId, tag, index));
}

function upsertPost(form, previousSlug) {
	const slug = cleanSlug(form.slug || form.title);
	const prev = previousSlug ? cleanSlug(previousSlug) : slug;
	const title = String(form.title || "").trim();
	const published = String(form.published || "").trim();
	if (!title) {
		const error = new Error("标题不能为空");
		error.status = 400;
		throw error;
	}
	if (!published) {
		const error = new Error("发布时间不能为空");
		error.status = 400;
		throw error;
	}
	const tags = splitTags(form.tags);
	const existing =
		db.prepare("SELECT * FROM posts WHERE slug = ?").get(prev) ||
		db.prepare("SELECT * FROM posts WHERE slug = ?").get(slug);
	const priority =
		form.priority === "" || form.priority === null || form.priority === undefined
			? null
			: Number(form.priority);
	if (priority !== null && !Number.isFinite(priority)) {
		const error = new Error("priority 必须是数字");
		error.status = 400;
		throw error;
	}
	const now = nowISO();
	const id = withTransaction(() => {
		if (!existing) {
			const info = db
				.prepare(
					`INSERT INTO posts (
						slug, title, published_at, updated_at, draft, description, image, category,
						lang, pinned, comment, priority, author, source_link, license_name, license_url,
						body, views, created_at, db_updated_at
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
				)
				.run(
					slug,
					title,
					published,
					form.updated ? String(form.updated) : null,
					asInt(form.draft, 0),
					form.description || "",
					form.image || "",
					form.category || "",
					form.lang || "",
					asInt(form.pinned, 0),
					asInt(form.comment, 1),
					priority,
					form.author || "",
					form.sourceLink || "",
					form.licenseName || "",
					form.licenseUrl || "",
					String(form.body ?? ""),
					now,
					now,
				);
			const postId = Number(info.lastInsertRowid);
			replaceTags(postId, tags);
			return postId;
		}
		db.prepare(
			`UPDATE posts SET
				slug = ?, title = ?, published_at = ?, updated_at = ?, draft = ?, description = ?,
				image = ?, category = ?, pinned = ?, comment = ?, priority = ?, body = ?,
				db_updated_at = ?
			 WHERE id = ?`,
		).run(
			slug,
			title,
			published,
			form.updated ? String(form.updated) : null,
			asInt(form.draft, existing.draft),
			form.description ?? existing.description,
			form.image ?? existing.image,
			form.category ?? existing.category,
			asInt(form.pinned, existing.pinned),
			asInt(form.comment, existing.comment),
			priority,
			form.body === undefined ? existing.body : String(form.body),
			now,
			existing.id,
		);
		replaceTags(existing.id, tags);
		return existing.id;
	});
	const row = db.prepare("SELECT id, slug, views FROM posts WHERE id = ?").get(id);
	return { ...row, tags, fileSlug: slug, previousSlug: existing ? prev : "" };
}

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

export function registerAdminContent(app, requireAuth) {
	app.get("/api/admin/content/boards", requireAuth, (_req, res) => {
		res.json({
			boards: Object.entries(BOARDS).map(([id, board]) => ({
				id,
				label: board.label,
				file: board.file,
			})),
		});
	});

	app.get("/api/admin/content/boards/:id", requireAuth, (req, res) => {
		try {
			res.json(readBoard(req.params.id));
		} catch (error) {
			sendError(res, error);
		}
	});

	app.put("/api/admin/content/boards/:id", requireAuth, (req, res) => {
		try {
			const saved = writeBoard(req.params.id, req.body?.data);
			res.json({ ok: true, ...saved });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.get("/api/admin/content/about", requireAuth, (_req, res) => {
		res.json(readAbout());
	});

	app.put("/api/admin/content/about", requireAuth, (req, res) => {
		try {
			res.json({ ok: true, ...writeAbout(req.body?.body) });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.get("/api/admin/content/posts", requireAuth, (_req, res) => {
		const files = listPostFiles();
		const rows = db.prepare("SELECT slug, id, views FROM posts").all();
		const bySlug = new Map(rows.map((row) => [row.slug, row]));
		res.json({
			posts: files.map((file) => ({
				...file,
				id: bySlug.get(file.slug)?.id ?? null,
				views: bySlug.get(file.slug)?.views ?? 0,
			})),
		});
	});

	app.get("/api/admin/content/posts/file", requireAuth, (req, res) => {
		try {
			const post = readPostFile(req.query.slug);
			const row = db.prepare("SELECT id, views FROM posts WHERE slug = ?").get(post.slug);
			res.json({ ...post, id: row?.id ?? null, views: row?.views ?? 0 });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.put("/api/admin/content/posts", requireAuth, (req, res) => {
		try {
			const form = req.body || {};
			const slug = cleanSlug(form.slug || form.title);
			const previous = form.previousSlug ? cleanSlug(form.previousSlug) : slug;
			if (previous !== slug) {
				const taken = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug);
				const current = db.prepare("SELECT id FROM posts WHERE slug = ?").get(previous);
				if (taken && (!current || taken.id !== current.id)) {
					return res.status(409).json({ error: "目标 slug 已被另一篇文章占用" });
				}
				try {
					readPostFile(slug);
					return res.status(409).json({ error: "目标 Markdown 文件已存在" });
				} catch (error) {
					if (error.status !== 404) throw error;
				}
			}
			let baseData;
			if (previous !== slug) {
				try {
					baseData = readPostFile(previous).data;
				} catch (error) {
					if (error.status !== 404) throw error;
				}
			}
			const written = writePostFile(slug, { ...form, tags: splitTags(form.tags) }, baseData);
			let saved;
			try {
				saved = upsertPost({ ...form, slug }, previous);
			} catch (error) {
				error.message = `Markdown 已写入，数据库更新失败：${error.message}`;
				throw error;
			}
			if (previous !== slug) removePostFile(previous);
			res.json({ ok: true, ...written, id: saved.id, views: saved.views });
		} catch (error) {
			if (String(error.message).includes("UNIQUE")) {
				return res.status(409).json({ error: "slug 已存在" });
			}
			sendError(res, error);
		}
	});

	app.delete("/api/admin/content/posts", requireAuth, (req, res) => {
		try {
			const slug = cleanSlug(req.query.slug);
			const row = db.prepare("SELECT id FROM posts WHERE slug = ?").get(slug);
			if (row) db.prepare("DELETE FROM posts WHERE id = ?").run(row.id);
			removePostFile(slug);
			res.json({ ok: true });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.post("/api/admin/media", requireAuth, (req, res) => {
		memoryUpload.single("file")(req, res, (error) => {
			if (error) return res.status(400).json({ error: error.message });
			if (!req.file) return res.status(400).json({ error: "缺少文件字段 file" });
			try {
				const saved = savePublicUpload(req.file.buffer, req.file.originalname, req.body?.folder);
				res.status(201).json(saved);
			} catch (err) {
				sendError(res, err);
			}
		});
	});

	app.get("/api/admin/albums", requireAuth, (_req, res) => {
		res.json({ albums: listAlbums() });
	});

	app.post("/api/admin/albums", requireAuth, (req, res) => {
		try {
			const saved = saveAlbum(req.body?.id, req.body?.info || req.body || {});
			res.status(201).json({ ok: true, ...saved });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.put("/api/admin/albums/:id", requireAuth, (req, res) => {
		try {
			res.json({ ok: true, ...saveAlbum(req.params.id, req.body?.info || req.body || {}) });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.delete("/api/admin/albums/:id", requireAuth, (req, res) => {
		try {
			removeAlbum(req.params.id);
			res.json({ ok: true });
		} catch (error) {
			sendError(res, error);
		}
	});

	// 把某张照片设为相册封面。name 传空则清除，退回默认封面。
	app.post("/api/admin/albums/:id/cover", requireAuth, (req, res) => {
		try {
			res.json({ ok: true, ...setAlbumCover(req.params.id, req.body?.name) });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.post("/api/admin/albums/:id/photos", requireAuth, (req, res) => {
		memoryUpload.single("file")(req, res, (error) => {
			if (error) return res.status(400).json({ error: error.message });
			if (!req.file) return res.status(400).json({ error: "缺少文件字段 file" });
			try {
				const saved = saveAlbumPhoto(req.params.id, req.file.buffer, req.file.originalname);
				res.status(201).json(saved);
			} catch (err) {
				sendError(res, err);
			}
		});
	});

	app.delete("/api/admin/albums/:id/photos", requireAuth, (req, res) => {
		try {
			removeAlbumPhoto(req.params.id, req.query.name);
			res.json({ ok: true });
		} catch (error) {
			sendError(res, error);
		}
	});

	app.post("/api/admin/bilibili", requireAuth, async (req, res) => {
		try {
			const data = await fetchBangumi(req.body?.url || req.body?.id || "");
			res.json(data);
		} catch (error) {
			res.status(400).json({ error: error.message || "抓取失败" });
		}
	});
}
