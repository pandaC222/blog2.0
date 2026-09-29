import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

/**
 * 统一把 frontmatter 日期解析为绝对时间。
 * - 仅日期 `YYYY-MM-DD` → 当天 00:00（站点 UTC+8）
 * - 无时区的日期时间 → 按 UTC+8 解释（后台写入的本地墙钟）
 * - 已带 Z / ±HH:mm 的保持原意
 *
 * 否则无偏移的 `2026-07-17T19:42:00` 会被当成 UTC，
 * 在中国区显示成次日 03:42。
 */
function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

function parseSiteDate(value: unknown): Date {
	if (value instanceof Date && !Number.isNaN(value.getTime())) {
		// 纯日期常被解析成 UTC 00:00；改成站点时区当天 00:00，避免显示成 08:00
		if (
			value.getUTCHours() === 0 &&
			value.getUTCMinutes() === 0 &&
			value.getUTCSeconds() === 0 &&
			value.getUTCMilliseconds() === 0
		) {
			const y = value.getUTCFullYear();
			const m = pad2(value.getUTCMonth() + 1);
			const d = pad2(value.getUTCDate());
			return new Date(`${y}-${m}-${d}T00:00:00+08:00`);
		}
		return value;
	}
	const raw = String(value ?? "").trim();
	if (!raw) return new Date(Number.NaN);

	// 纯日期
	if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
		return new Date(`${raw}T00:00:00+08:00`);
	}

	// 已有时区（Z 或 ±HH:mm / ±HHmm）
	if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(raw)) {
		return new Date(raw);
	}

	// `YYYY-MM-DD HH:mm[:ss]` 或 `YYYY-MM-DDTHH:mm[:ss][.sss]` → 按 +08:00
	const normalized = raw.replace(" ", "T");
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(normalized)) {
		const withSec = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
			? `${normalized}:00`
			: normalized;
		return new Date(`${withSec}+08:00`);
	}

	return new Date(raw);
}

const siteDate = z.preprocess((val) => parseSiteDate(val), z.date());

const postsCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: siteDate,
		updated: siteDate.optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		comment: z.boolean().optional().default(true),
		priority: z.number().optional(),
		author: z.string().optional().default(""),
		sourceLink: z.string().optional().default(""),
		licenseName: z.string().optional().default(""),
		licenseUrl: z.string().optional().default(""),

		/* Page encryption fields */
		encrypted: z.boolean().optional().default(false),
		password: z.string().optional().default(""),
		passwordHint: z.string().optional().default(""),

		/* Posts alias */
		alias: z.string().optional(),

		/* Custom permalink - 自定义固定链接，优先级高于 alias */
		permalink: z.string().optional(),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});
const specCollection = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/spec" }),
	schema: z.object({}),
});
export const collections = {
	posts: postsCollection,
	spec: specCollection,
};
