import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { parse } from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const postsDir = path.join(rootDir, "pandaC222.github.io", "src", "content", "posts");
const schemaPath = path.join(rootDir, "schema.sql");
const dataDir = path.join(rootDir, "data");
const testDbPath = path.join(dataDir, "blog.test.db");
const officialDbPath = path.join(dataDir, "blog.db");
const apply = process.argv.includes("--apply");

function walkMarkdown(dir) {
	const files = [];
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) files.push(...walkMarkdown(fullPath));
		else if (entry.name.endsWith(".md")) files.push(fullPath);
	}
	return files.sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function splitFrontmatter(raw) {
	const text = raw.replace(/^﻿/, "");
	if (!text.startsWith("---")) return { data: {}, body: text };
	const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) throw new Error("Front-matter 没有闭合");
	const data = parse(match[1], { schema: "failsafe" }) ?? {};
	if (typeof data !== "object" || Array.isArray(data)) {
		throw new Error("Front-matter 不是对象");
	}
	return { data, body: match[2] };
}

function formatShanghai(date) {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Shanghai",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
	return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+08:00`;
}

function toSiteISO(value, label) {
	if (value == null || String(value).trim() === "") return null;
	const raw = String(value).trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T00:00:00+08:00`;
	if (/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw)) {
		const date = new Date(raw);
		if (Number.isNaN(date.getTime())) throw new Error(`${label} 无法解析: ${raw}`);
		return formatShanghai(date);
	}
	const normalized = raw.replace(" ", "T");
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) return `${normalized}:00+08:00`;
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(normalized)) {
		return `${normalized}+08:00`;
	}
	throw new Error(`${label} 不是可识别的日期: ${raw}`);
}

function asBool(value, fallback) {
	if (value == null || value === "") return fallback;
	const text = String(value).trim().toLowerCase();
	if (["1", "true", "yes", "on"].includes(text)) return 1;
	if (["0", "false", "no", "off"].includes(text)) return 0;
	throw new Error(`无法解析布尔值: ${value}`);
}

function splitTags(value) {
	const items = Array.isArray(value) ? value : String(value ?? "").split(/[,，]/);
	const tags = [];
	const seen = new Set();
	for (const item of items) {
		for (const part of String(item).split("，")) {
			const tag = part.trim();
			if (!tag || seen.has(tag)) continue;
			seen.add(tag);
			tags.push(tag);
		}
	}
	return tags;
}

function optionalText(value) {
	if (value == null) return null;
	const text = String(value).trim();
	return text || null;
}

function text(value) {
	return value == null ? "" : String(value);
}

function readPosts() {
	if (!fs.existsSync(postsDir)) throw new Error(`找不到文章目录: ${postsDir}`);
	return walkMarkdown(postsDir).map((filePath) => {
		const raw = fs.readFileSync(filePath, "utf8");
		const { data, body } = splitFrontmatter(raw);
		const rel = path.relative(postsDir, filePath).split(path.sep).join("/");
		const slug = rel.replace(/\.md$/i, "");
		if (!text(data.title).trim()) throw new Error(`${rel} 缺少 title`);
		const published = toSiteISO(data.published, `${rel} published`);
		if (!published) throw new Error(`${rel} 缺少 published`);
		let priority = null;
		if (data.priority != null && String(data.priority).trim() !== "") {
			priority = Number(data.priority);
			if (!Number.isFinite(priority)) throw new Error(`${rel} priority 不是数字`);
		}
		return {
			slug,
			source_path: `pandaC222.github.io/src/content/posts/${rel}`,
			alias: optionalText(data.alias),
			permalink: optionalText(data.permalink),
			title: text(data.title).trim(),
			published_at: published,
			updated_at: toSiteISO(data.updated, `${rel} updated`),
			draft: asBool(data.draft, 0),
			description: text(data.description),
			image: text(data.image),
			category: text(data.category),
			lang: text(data.lang),
			pinned: asBool(data.pinned, 0),
			comment: asBool(data.comment, 1),
			priority,
			author: text(data.author),
			source_link: text(data.sourceLink),
			license_name: text(data.licenseName),
			license_url: text(data.licenseUrl),
			encrypted: asBool(data.encrypted, 0),
			password: text(data.password),
			password_hint: text(data.passwordHint),
			body,
			tags: splitTags(data.tags),
		};
	});
}

function openDatabase(dbPath, { fresh = false } = {}) {
	fs.mkdirSync(dataDir, { recursive: true });
	if (fresh) {
		for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(dbPath + suffix, { force: true });
	}
	const db = new DatabaseSync(dbPath);
	db.exec("PRAGMA foreign_keys = ON");
	db.exec(fs.readFileSync(schemaPath, "utf8"));
	return db;
}

function importPosts(db, posts) {
	const upsert = db.prepare(`
		INSERT INTO posts (
			slug, source_path, alias, permalink, title, published_at, updated_at, draft,
			description, image, category, lang, pinned, comment, priority, author,
			source_link, license_name, license_url, encrypted, password, password_hint, body
		) VALUES (
			?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?, ?
		)
		ON CONFLICT(slug) DO UPDATE SET
			source_path = excluded.source_path,
			alias = excluded.alias,
			permalink = excluded.permalink,
			title = excluded.title,
			published_at = excluded.published_at,
			updated_at = excluded.updated_at,
			draft = excluded.draft,
			description = excluded.description,
			image = excluded.image,
			category = excluded.category,
			lang = excluded.lang,
			pinned = excluded.pinned,
			comment = excluded.comment,
			priority = excluded.priority,
			author = excluded.author,
			source_link = excluded.source_link,
			license_name = excluded.license_name,
			license_url = excluded.license_url,
			encrypted = excluded.encrypted,
			password = excluded.password,
			password_hint = excluded.password_hint,
			body = excluded.body,
			db_updated_at = strftime('%Y-%m-%dT%H:%M:%S+08:00', 'now', '+8 hours')
	`);
	const findId = db.prepare("SELECT id FROM posts WHERE slug = ?");
	const clearTags = db.prepare("DELETE FROM post_tags WHERE post_id = ?");
	const insertTag = db.prepare(
		"INSERT INTO post_tags (post_id, tag, sort_order) VALUES (?, ?, ?)",
	);

	db.exec("BEGIN");
	try {
		for (const post of posts) {
			upsert.run(
				post.slug,
				post.source_path,
				post.alias,
				post.permalink,
				post.title,
				post.published_at,
				post.updated_at,
				post.draft,
				post.description,
				post.image,
				post.category,
				post.lang,
				post.pinned,
				post.comment,
				post.priority,
				post.author,
				post.source_link,
				post.license_name,
				post.license_url,
				post.encrypted,
				post.password,
				post.password_hint,
				post.body,
			);
			const { id } = findId.get(post.slug);
			clearTags.run(id);
			post.tags.forEach((tag, index) => insertTag.run(id, tag, index));
		}
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}
}

function dumpPosts(db) {
	const rows = db
		.prepare(
			`SELECT slug, title, published_at, updated_at, draft, description, image, category,
			        pinned, comment, priority, body
			 FROM posts
			 ORDER BY published_at, slug`,
		)
		.all();
	return rows.map((row) => {
		const tags = db
			.prepare(
				"SELECT tag FROM post_tags WHERE post_id = (SELECT id FROM posts WHERE slug = ?) ORDER BY sort_order",
			)
			.all(row.slug)
			.map((item) => item.tag);
		return {
			slug: row.slug,
			title: row.title,
			published: row.published_at,
			updated: row.updated_at,
			draft: row.draft,
			description: row.description,
			image: row.image,
			category: row.category,
			tags,
			pinned: row.pinned,
			comment: row.comment,
			priority: row.priority,
			body_chars: row.body.length,
			body_has_frontmatter: row.body.startsWith("---"),
		};
	});
}

const expected = {
	"first": {
		title: "我的第一篇博客",
		published: "2026-04-04T00:00:00+08:00",
		tags: ["博客"],
		category: "测试",
		draft: 1,
	},
	"Round139": {
		title: "牛客周赛139",
		published: "2026-04-13T00:00:00+08:00",
		tags: ["牛客周赛", "算法"],
		category: "牛客周赛",
		draft: 0,
	},
	"AtCoder": {
		title: "AtCoder Beginner Contest 453复盘",
		published: "2026-04-12T00:00:00+08:00",
		tags: ["AtCoder", "算法"],
		category: "算法",
		draft: 0,
	},
	"nowcoderpratice": {
		title: "牛客竞赛每日一题",
		published: "2026-04-05T01:49:00+08:00",
		tags: ["算法", "每日一题"],
		category: "牛客",
		pinned: 1,
		priority: 1,
		draft: 0,
	},
	"cfpratice": {
		title: "Codeforces每日一题",
		published: "2026-04-07T00:00:00+08:00",
		tags: ["Codeforces", "每日一题"],
		category: "Codeforces",
		pinned: 1,
		priority: 2,
		draft: 0,
	},
	"blogban": {
		title: "自用板子",
		published: "2026-04-05T14:42:00+08:00",
		tags: ["算法", "模板"],
		category: "模板",
		draft: 0,
	},
	"Codeforces Round 1090 (Div. 4)": {
		title: "Codeforces Round 1090 (Div.4)题解",
		published: "2026-04-05T00:00:00+08:00",
		tags: ["算法", "Codeforces"],
		category: "Codeforces",
		draft: 0,
	},
	"测试": {
		title: "测试测试",
		published: "2026-07-17T20:56:00+08:00",
		tags: ["测试"],
		category: "测试",
		image: "/uploads/1784243302458-2025-06-28_003921_253.jpg",
		draft: 0,
	},
};

function assertImport(posts, dumped, label) {
	const errors = [];
	if (posts.length !== 8) errors.push(`${label}: 文章数是 ${posts.length}，期望 8`);
	if (dumped.length !== posts.length) {
		errors.push(`${label}: 库内 ${dumped.length} 篇，解析 ${posts.length} 篇`);
	}
	const bySlug = new Map(dumped.map((post) => [post.slug, post]));
	for (const post of posts) {
		const row = bySlug.get(post.slug);
		if (!row) {
			errors.push(`${label}: 缺少 ${post.slug}`);
			continue;
		}
		if (row.body_chars !== post.body.length || row.body_has_frontmatter) {
			errors.push(`${label}: ${post.slug} 正文不完整或含有 front-matter`);
		}
		const want = expected[post.slug];
		if (!want) {
			errors.push(`${label}: 未预期的文件 ${post.slug}`);
			continue;
		}
		for (const key of ["title", "published", "category", "draft", "image", "pinned", "priority"]) {
			if (want[key] === undefined) continue;
			if (row[key] !== want[key]) {
				errors.push(`${label}: ${post.slug} ${key} = ${JSON.stringify(row[key])}，期望 ${JSON.stringify(want[key])}`);
			}
		}
		if (JSON.stringify(row.tags) !== JSON.stringify(want.tags)) {
			errors.push(`${label}: ${post.slug} tags = ${JSON.stringify(row.tags)}，期望 ${JSON.stringify(want.tags)}`);
		}
	}
	if (errors.length) {
		throw new Error(errors.join("\n"));
	}
}

const posts = readPosts();
const testDb = openDatabase(testDbPath, { fresh: true });
importPosts(testDb, posts);
const testDump = dumpPosts(testDb);
assertImport(posts, testDump, "测试库");
testDb.close();

const report = {
	mode: apply ? "apply" : "test",
	source: "pandaC222.github.io/src/content/posts",
	files: posts.length,
	tag_rows: posts.reduce((sum, post) => sum + post.tags.length, 0),
	test_db: testDbPath,
	posts: testDump,
};

if (apply) {
	const officialDb = openDatabase(officialDbPath);
	importPosts(officialDb, posts);
	const officialDump = dumpPosts(officialDb);
	assertImport(posts, officialDump, "正式库");
	officialDb.close();
	report.official_db = officialDbPath;
	report.official_posts = officialDump.length;
}

const reportPath = path.join(dataDir, apply ? "migrate-apply-report.json" : "migrate-test-report.json");
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");
console.log(
	JSON.stringify({
		ok: true,
		mode: report.mode,
		files: report.files,
		tag_rows: report.tag_rows,
		report: reportPath,
	}),
);
