import fs from "node:fs";
import path from "node:path";
import { parse, stringify } from "yaml";
import { rootDir } from "./db.js";

export const siteRoot = path.join(rootDir, "pandaC222.github.io");
export const postsDir = path.join(siteRoot, "src", "content", "posts");

export const BOARDS = {
	profile: { label: "个人资料", file: "src/content/admin/profile.yml" },
	announcement: { label: "公告", file: "src/content/admin/announcement.yml" },
	banner: { label: "首页横幅", file: "src/content/admin/banner.yml" },
	features: { label: "模块开关", file: "src/content/admin/features.yml" },
	friends: { label: "友链", file: "src/content/admin/friends.yml" },
	projects: { label: "项目", file: "src/content/admin/projects.yml" },
	skills: { label: "技能", file: "src/content/admin/skills.yml" },
	timeline: { label: "时间线", file: "src/content/admin/timeline.yml" },
	diary: { label: "日记", file: "src/content/admin/diary.yml" },
	anime: { label: "番剧", file: "src/content/admin/anime.yml" },
	devices: { label: "设备", file: "src/content/admin/devices.yml" },
	music: { label: "音乐播放器", file: "src/content/admin/music.yml" },
	pio: { label: "看板娘", file: "src/content/admin/pio.yml" },
};

const UPLOAD_FOLDERS = new Set([
	"",
	"diary",
	"banners",
	"friends",
	"projects",
	"anime",
	"devices",
]);

function fail(message, status = 400) {
	const error = new Error(message);
	error.status = status;
	return error;
}

function inside(root, target) {
	const rel = path.relative(root, target);
	return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function cleanSlug(value) {
	const slug = String(value || "")
		.trim()
		.replace(/\.md$/i, "")
		.replace(/[\\/:*?"<>|]/g, "");
	if (!slug || slug === "." || slug === "..") {
		throw fail("slug 不能为空，也不能包含路径符号");
	}
	return slug;
}

function postPath(slug) {
	const safe = cleanSlug(slug);
	const filePath = path.resolve(postsDir, `${safe}.md`);
	if (!inside(postsDir, filePath)) throw fail("文章路径越界");
	return { slug: safe, filePath };
}

function sitePath(rel) {
	const normalized = String(rel || "")
		.replace(/\\/g, "/")
		.replace(/^\/+/, "");
	if (!normalized || normalized.includes("..")) throw fail("非法路径");
	const allowed =
		normalized.startsWith("src/content/") ||
		normalized.startsWith("public/uploads/") ||
		normalized.startsWith("public/images/albums/");
	if (!allowed) throw fail(`路径不允许: ${normalized}`);
	const abs = path.resolve(siteRoot, normalized);
	if (!inside(siteRoot, abs)) throw fail("路径越界");
	return { rel: normalized, abs };
}

function splitFrontmatter(raw) {
	const text = String(raw || "").replace(/^﻿/, "");
	if (!text.startsWith("---")) return { data: {}, body: text };
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { data: {}, body: text };
	const data = parse(match[1]) ?? {};
	if (typeof data !== "object" || Array.isArray(data)) return { data: {}, body: match[2] };
	return { data, body: match[2] };
}

function markdownDocument(data, body) {
	const yamlText = stringify(data, { lineWidth: 0 }).trimEnd();
	const text = String(body ?? "").replace(/\r\n/g, "\n");
	const separated = text.startsWith("\n") ? text : `\n${text}`;
	return `---\n${yamlText}\n---${separated.endsWith("\n") ? separated : `${separated}\n`}`;
}

function overlayPostData(existing, form) {
	const data = { ...(existing || {}) };
	delete data.prevTitle;
	delete data.prevSlug;
	delete data.nextTitle;
	delete data.nextSlug;
	data.title = form.title;
	data.published = form.published;
	if (form.updated) data.updated = form.updated;
	else delete data.updated;
	data.draft = Boolean(form.draft);
	if (form.description) data.description = form.description;
	else delete data.description;
	if (form.image) data.image = form.image;
	else delete data.image;
	if (form.category) data.category = form.category;
	else delete data.category;
	if (Array.isArray(form.tags) && form.tags.length) data.tags = form.tags;
	else delete data.tags;
	if (form.lang) data.lang = form.lang;
	if (form.pinned) data.pinned = true;
	else delete data.pinned;
	if (form.comment === false) data.comment = false;
	else delete data.comment;
	if (form.priority === null || form.priority === undefined || form.priority === "") {
		delete data.priority;
	} else {
		data.priority = Number(form.priority);
	}
	if (form.author) data.author = form.author;
	if (form.sourceLink) data.sourceLink = form.sourceLink;
	if (form.licenseName) data.licenseName = form.licenseName;
	if (form.licenseUrl) data.licenseUrl = form.licenseUrl;
	return data;
}

export function listPostFiles() {
	if (!fs.existsSync(postsDir)) return [];
	return fs
		.readdirSync(postsDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => {
			const slug = entry.name.replace(/\.md$/i, "");
			const filePath = path.join(postsDir, entry.name);
			const raw = fs.readFileSync(filePath, "utf8");
			const { data } = splitFrontmatter(raw);
			const stat = fs.statSync(filePath);
			return {
				slug,
				title: data.title || slug,
				published: data.published || "",
				draft: Boolean(data.draft),
				category: data.category || "",
				pinned: Boolean(data.pinned),
				image: typeof data.image === "string" ? data.image : "",
				tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
				mtimeMs: stat.mtimeMs,
			};
		})
		.sort((a, b) => String(b.published).localeCompare(String(a.published)));
}

export function readPostFile(slug) {
	const { slug: safe, filePath } = postPath(slug);
	if (!fs.existsSync(filePath)) throw fail("文章文件不存在", 404);
	const { data, body } = splitFrontmatter(fs.readFileSync(filePath, "utf8"));
	return { slug: safe, data, body };
}

export function writePostFile(slug, form, baseData) {
	const { slug: safe, filePath } = postPath(slug);
	let existing = baseData && typeof baseData === "object" ? { ...baseData } : {};
	if (!baseData && fs.existsSync(filePath)) {
		existing = splitFrontmatter(fs.readFileSync(filePath, "utf8")).data;
	}
	const data = overlayPostData(existing, { ...form, title: form.title || safe });
	fs.mkdirSync(postsDir, { recursive: true });
	fs.writeFileSync(filePath, markdownDocument(data, form.body ?? ""), "utf8");
	return { slug: safe, file: `src/content/posts/${safe}.md` };
}

export function writePostFromRow(row, tags) {
	return writePostFile(row.slug, {
		title: row.title,
		published: row.published_at,
		updated: row.updated_at || "",
		draft: Boolean(row.draft),
		description: row.description || "",
		image: row.image || "",
		category: row.category || "",
		tags: tags || [],
		lang: row.lang || "",
		pinned: Boolean(row.pinned),
		comment: Boolean(row.comment),
		priority: row.priority,
		author: row.author || "",
		sourceLink: row.source_link || "",
		licenseName: row.license_name || "",
		licenseUrl: row.license_url || "",
		body: row.body || "",
	});
}

export function removePostFile(slug) {
	const { filePath } = postPath(slug);
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

export function readBoard(id) {
	const board = BOARDS[id];
	if (!board) throw fail("未知板块", 404);
	const { abs, rel } = sitePath(board.file);
	if (!fs.existsSync(abs)) throw fail("文件不存在", 404);
	const data = parse(fs.readFileSync(abs, "utf8")) ?? {};
	return { id, label: board.label, file: rel, data };
}

export function writeBoard(id, data) {
	const board = BOARDS[id];
	if (!board) throw fail("未知板块", 404);
	if (!data || typeof data !== "object" || Array.isArray(data)) {
		throw fail("板块内容必须是对象");
	}
	const { abs, rel } = sitePath(board.file);
	const text = stringify(data, { lineWidth: 0 });
	fs.writeFileSync(abs, text.endsWith("\n") ? text : `${text}\n`, "utf8");
	return { id, file: rel };
}

export function readAbout() {
	const { abs } = sitePath("src/content/spec/about.md");
	if (!fs.existsSync(abs)) return { body: "" };
	const raw = fs.readFileSync(abs, "utf8");
	const parsed = splitFrontmatter(raw);
	if (raw.startsWith("---")) return { body: parsed.body, data: parsed.data };
	return { body: raw };
}

export function writeAbout(body) {
	const { abs } = sitePath("src/content/spec/about.md");
	const text = String(body ?? "").replace(/\r\n/g, "\n");
	fs.writeFileSync(abs, text.endsWith("\n") ? text : `${text}\n`, "utf8");
	return { file: "src/content/spec/about.md" };
}

export function savePublicUpload(buffer, originalName, folder) {
	const dir = String(folder || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	if (!UPLOAD_FOLDERS.has(dir)) throw fail("上传目录不允许");
	const ext = path.extname(originalName || "").toLowerCase().slice(0, 10);
	const safeExt = /^\.[a-z0-9]+$/.test(ext) ? ext : "";
	const filename = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${safeExt}`;
	const rel = dir ? `public/uploads/${dir}/${filename}` : `public/uploads/${filename}`;
	const { abs } = sitePath(rel);
	fs.mkdirSync(path.dirname(abs), { recursive: true });
	fs.writeFileSync(abs, buffer);
	return { url: `/${rel.replace(/^public\//, "")}` };
}

function albumDir(id) {
	const name = String(id || "").trim();
	if (!name || name !== path.basename(name) || name.includes("..")) {
		throw fail("相册 id 不合法");
	}
	const { abs, rel } = sitePath(`public/images/albums/${name}`);
	return { id: name, abs, rel };
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp"]);

export function listAlbums() {
	const root = path.join(siteRoot, "public", "images", "albums");
	if (!fs.existsSync(root)) return [];
	return fs
		.readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => {
			const dir = path.join(root, entry.name);
			let info = { title: entry.name, description: "", date: "", location: "", tags: [] };
			const infoPath = path.join(dir, "info.json");
			if (fs.existsSync(infoPath)) {
				try {
					info = { ...info, ...JSON.parse(fs.readFileSync(infoPath, "utf8")) };
				} catch {
					/* keep default */
				}
			}
			const photos = fs
				.readdirSync(dir, { withFileTypes: true })
				.filter((file) => file.isFile() && IMAGE_EXT.has(path.extname(file.name).toLowerCase()))
				.map((file) => ({
					name: file.name,
					url: `/images/albums/${entry.name}/${file.name}`,
				}));
			const coverFile = photos.find((photo) => /^cover\.(webp|jpe?g|png)$/i.test(photo.name));
			return { id: entry.name, info, photos, cover: coverFile?.url || photos[0]?.url || "" };
		});
}

export function saveAlbum(id, info) {
	const dir = albumDir(id);
	fs.mkdirSync(dir.abs, { recursive: true });
	const infoPath = path.join(dir.abs, "info.json");
	// 表单没覆盖的字段（外链相册的 mode、cover、photos 等）从原文件里保留下来。
	let keep = {};
	if (fs.existsSync(infoPath)) {
		try {
			const raw = JSON.parse(fs.readFileSync(infoPath, "utf8"));
			if (raw && typeof raw === "object") keep = raw;
		} catch {
			/* 原 info.json 损坏时直接重建 */
		}
	}
	const next = {
		...keep,
		title: info?.title || dir.id,
		description: info?.description || "",
		date: info?.date || "",
		location: info?.location || "",
		tags: Array.isArray(info?.tags) ? info.tags : [],
		layout: info?.layout || "grid",
		columns: Number(info?.columns || 3),
		hidden: Boolean(info?.hidden),
	};
	fs.writeFileSync(infoPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return { id: dir.id };
}

export function removeAlbum(id) {
	const dir = albumDir(id);
	if (!fs.existsSync(dir.abs)) throw fail("相册不存在", 404);
	fs.rmSync(dir.abs, { recursive: true, force: true });
}

export function saveAlbumPhoto(id, buffer, originalName) {
	const dir = albumDir(id);
	if (!fs.existsSync(dir.abs)) throw fail("相册不存在", 404);
	const ext = path.extname(originalName || "").toLowerCase();
	if (!IMAGE_EXT.has(ext)) throw fail("只能上传图片");
	const filename = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}${ext}`;
	fs.writeFileSync(path.join(dir.abs, filename), buffer);
	return { url: `/images/albums/${dir.id}/${filename}`, name: filename };
}

export function removeAlbumPhoto(id, name) {
	const dir = albumDir(id);
	const filename = path.basename(String(name || ""));
	if (!filename || filename === "info.json") throw fail("不能删除这个文件");
	const filePath = path.join(dir.abs, filename);
	if (!inside(dir.abs, filePath)) throw fail("路径越界");
	if (!fs.existsSync(filePath)) throw fail("图片不存在", 404);
	fs.unlinkSync(filePath);
}
