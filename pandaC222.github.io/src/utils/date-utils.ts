import { siteConfig } from "../config";

function pad2(n: number): string {
	return String(n).padStart(2, "0");
}

/**
 * 按站点时区（siteConfig.timeZone，默认 UTC+8）拆分 Date 的墙钟时间。
 * 避免 GitHub Actions（UTC）与本机（UTC+8）显示不一致。
 */
export function getSiteTimeParts(date: Date): {
	year: number;
	month: number;
	day: number;
	hours: number;
	minutes: number;
	seconds: number;
} {
	const offsetHours =
		typeof siteConfig.timeZone === "number" &&
		siteConfig.timeZone >= -12 &&
		siteConfig.timeZone <= 14
			? siteConfig.timeZone
			: 8;
	// 先平移到「站点时区的 UTC 伪时间」，再用 UTC getter 取墙钟字段
	const shifted = new Date(date.getTime() + offsetHours * 60 * 60 * 1000);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
		hours: shifted.getUTCHours(),
		minutes: shifted.getUTCMinutes(),
		seconds: shifted.getUTCSeconds(),
	};
}

/** 站点时区日期；若有非 0 时分则带上 HH:mm */
export function formatDateToYYYYMMDD(date: Date): string {
	const p = getSiteTimeParts(date);
	const y = p.year;
	const m = pad2(p.month);
	const d = pad2(p.day);
	const hh = pad2(p.hours);
	const mm = pad2(p.minutes);
	if (p.hours === 0 && p.minutes === 0 && p.seconds === 0) {
		return `${y}-${m}-${d}`;
	}
	return `${y}-${m}-${d} ${hh}:${mm}`;
}

// 国际化日期格式化函数（含可选时分，固定站点时区）
export function formatDateI18n(dateString: string): string {
	const date = new Date(dateString);
	const lang = siteConfig.lang || "en";
	const offsetHours =
		typeof siteConfig.timeZone === "number" ? siteConfig.timeZone : 8;
	// Intl 的 timeZone：用固定偏移字符串，如 UTC+8
	const tz =
		offsetHours === 0
			? "UTC"
			: `UTC${offsetHours >= 0 ? "+" : "-"}${Math.abs(offsetHours)}`;

	const parts = getSiteTimeParts(date);
	const hasTime = !(parts.hours === 0 && parts.minutes === 0 && parts.seconds === 0);

	const options: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "long",
		day: "numeric",
		timeZone: tz,
		...(hasTime
			? { hour: "2-digit", minute: "2-digit", hour12: false }
			: {}),
	};

	const localeMap: Record<string, string> = {
		zh_CN: "zh-CN",
		zh_TW: "zh-TW",
		en: "en-US",
		ja: "ja-JP",
		ko: "ko-KR",
		es: "es-ES",
		th: "th-TH",
		vi: "vi-VN",
		tr: "tr-TR",
		id: "id-ID",
		fr: "fr-FR",
		de: "de-DE",
		ru: "ru-RU",
		ar: "ar-SA",
	};

	const locale = localeMap[lang] || "en-US";
	return date.toLocaleString(locale, options);
}
