/**
 * 加载 CMS 可编辑的管理员配置（YAML）。
 * 使用 Vite 的 ?raw 导入 + yaml 解析，避免 esbuild 无法处理 .yml 模块的问题。
 */
import { parse } from "yaml";
import type { AnnouncementConfig, ProfileConfig, SiteConfig } from "../types/config";

import animeRaw from "../content/admin/anime.yml?raw";
import announcementRaw from "../content/admin/announcement.yml?raw";
import bannerRaw from "../content/admin/banner.yml?raw";
import devicesRaw from "../content/admin/devices.yml?raw";
import diaryRaw from "../content/admin/diary.yml?raw";
import featuresRaw from "../content/admin/features.yml?raw";
import friendsRaw from "../content/admin/friends.yml?raw";
import profileRaw from "../content/admin/profile.yml?raw";
import projectsRaw from "../content/admin/projects.yml?raw";
import skillsRaw from "../content/admin/skills.yml?raw";
import timelineRaw from "../content/admin/timeline.yml?raw";
import musicRaw from "../content/admin/music.yml?raw";
import pioRaw from "../content/admin/pio.yml?raw";

type FeaturePages = SiteConfig["featurePages"];

export type FriendItem = {
	id: number;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags: string[];
};

export type BannerAdminConfig = {
	desktop: string[];
	mobile: string[];
	carousel: {
		enable: boolean;
		interval: number;
	};
	homeText: {
		enable: boolean;
		title: string;
		subtitle: string[];
		typewriter: {
			enable: boolean;
			speed: number;
			deleteSpeed: number;
			pauseTime: number;
		};
	};
};

export type ProjectItem = {
	id: string;
	title: string;
	description: string;
	image: string;
	category: "web" | "mobile" | "desktop" | "other";
	techStack: string[];
	status: "completed" | "in-progress" | "planned";
	liveDemo?: string;
	sourceCode?: string;
	visitUrl?: string;
	startDate: string;
	endDate?: string;
	featured?: boolean;
	tags?: string[];
	showImage?: boolean;
};

export type SkillItem = {
	id: string;
	name: string;
	description: string;
	icon: string;
	category: "frontend" | "backend" | "database" | "tools" | "other";
	level: "beginner" | "intermediate" | "advanced" | "expert";
	experience: { years: number; months: number };
	projects?: string[];
	certifications?: string[];
	color?: string;
};

export type TimelineItemData = {
	id: string;
	title: string;
	description: string;
	type: string;
	startDate: string;
	endDate?: string;
	location?: string;
	organization?: string;
	position?: string;
	skills?: string[];
	achievements?: string[];
	links?: { name: string; url: string; type?: string }[];
	icon?: string;
	color?: string;
	featured?: boolean;
};

export type DiaryItemData = {
	id: number;
	content: string;
	date: string;
	images?: string[];
	location?: string;
	mood?: string;
	tags?: string[];
};

export type AnimeItemData = {
	title: string;
	status: "watching" | "completed" | "planned";
	rating: number;
	cover: string;
	description: string;
	episodes: string;
	year: string;
	genre: string[];
	studio: string;
	link: string;
	progress: number;
	totalEpisodes: number;
	startDate: string;
	endDate: string;
};

export type DeviceItemData = {
	name: string;
	image: string;
	specs: string;
	description: string;
	link: string;
};

type ProfileYaml = {
	name?: string;
	bio?: string;
	avatar?: string;
	typewriter?: { enable?: boolean; speed?: number };
	links?: { name: string; url: string; icon: string }[];
};

type AnnouncementYaml = {
	enable?: boolean;
	title?: string;
	content?: string;
	closable?: boolean;
	link?: {
		enable?: boolean;
		text?: string;
		url?: string;
		external?: boolean;
	};
};

type FeaturesYaml = Partial<FeaturePages>;
type FriendsYaml = { items?: FriendItem[] };
type BannerYaml = {
	desktop?: unknown;
	mobile?: unknown;
	carousel?: { enable?: boolean; interval?: number };
	homeText?: {
		enable?: boolean;
		title?: string;
		subtitle?: unknown;
		typewriter?: {
			enable?: boolean;
			speed?: number;
			deleteSpeed?: number;
			pauseTime?: number;
		};
	};
};

const DEFAULT_FEATURES: FeaturePages = {
	anime: false,
	diary: false,
	friends: false,
	projects: true,
	skills: true,
	timeline: true,
	albums: true,
	devices: false,
};

function parseYaml<T>(raw: string): T {
	return (parse(raw) ?? {}) as T;
}

function normalizeImageList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item === "string") return item;
			if (item && typeof item === "object" && "image" in item) {
				const img = (item as { image?: unknown }).image;
				return typeof img === "string" ? img : "";
			}
			return "";
		})
		.filter(Boolean);
}

function normalizeStringList(value: unknown, key = "tag"): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.map((item) => {
			if (typeof item === "string") return item;
			if (item && typeof item === "object" && key in item) {
				return String((item as Record<string, unknown>)[key] ?? "");
			}
			return "";
		})
		.filter(Boolean);
}

export function loadProfileConfig(): ProfileConfig {
	const data = parseYaml<ProfileYaml>(profileRaw);
	return {
		name: data.name ?? "pandac",
		bio: data.bio ?? "",
		avatar: data.avatar ?? "/uploads/avatar.webp",
		typewriter: {
			enable: data.typewriter?.enable ?? true,
			speed: data.typewriter?.speed ?? 80,
		},
		links: Array.isArray(data.links) ? data.links : [],
	};
}

export function loadAnnouncementConfig(): AnnouncementConfig {
	const data = parseYaml<AnnouncementYaml>(announcementRaw);
	return {
		enable: data.enable ?? true,
		title: data.title ?? "公告",
		content: data.content ?? "",
		closable: data.closable ?? false,
		link: {
			enable: data.link?.enable ?? false,
			text: data.link?.text ?? "",
			url: data.link?.url ?? "/about/",
			external: data.link?.external ?? false,
		},
	};
}

export function loadFeaturePages(): FeaturePages {
	const data = parseYaml<FeaturesYaml>(featuresRaw);
	return {
		anime: data.anime ?? DEFAULT_FEATURES.anime,
		diary: data.diary ?? DEFAULT_FEATURES.diary,
		friends: data.friends ?? DEFAULT_FEATURES.friends,
		projects: data.projects ?? DEFAULT_FEATURES.projects,
		skills: data.skills ?? DEFAULT_FEATURES.skills,
		timeline: data.timeline ?? DEFAULT_FEATURES.timeline,
		albums: data.albums ?? DEFAULT_FEATURES.albums,
		devices: data.devices ?? DEFAULT_FEATURES.devices,
	};
}

export function loadFriendsData(): FriendItem[] {
	const data = parseYaml<FriendsYaml>(friendsRaw);
	const items = Array.isArray(data.items) ? data.items : [];
	return items.map((item, index) => ({
		id: Number(item.id ?? index + 1),
		title: item.title ?? "",
		imgurl: item.imgurl ?? "",
		desc: item.desc ?? "",
		siteurl: item.siteurl ?? "",
		tags: normalizeStringList(item.tags, "tag"),
	}));
}

export function loadBannerConfig(): BannerAdminConfig {
	const data = parseYaml<BannerYaml>(bannerRaw);
	const desktopList = normalizeImageList(data.desktop);
	const desktop =
		desktopList.length > 0
			? desktopList
			: ["/assets/desktop-banner/6.webp"];
	const mobile = normalizeImageList(data.mobile);
	const subtitleRaw = data.homeText?.subtitle;
	let subtitle: string[] = [];
	if (Array.isArray(subtitleRaw)) {
		subtitle = subtitleRaw
			.map((item) =>
				typeof item === "string"
					? item
					: item && typeof item === "object" && "line" in item
						? String((item as { line?: unknown }).line ?? "")
						: "",
			)
			.filter(Boolean);
	} else if (typeof subtitleRaw === "string" && subtitleRaw) {
		subtitle = [subtitleRaw];
	}
	if (subtitle.length === 0) {
		subtitle = ["希望有朝一日成为算法大蛇"];
	}

	return {
		desktop,
		mobile,
		carousel: {
			enable: data.carousel?.enable ?? true,
			interval: data.carousel?.interval ?? 3,
		},
		homeText: {
			enable: data.homeText?.enable ?? true,
			title: data.homeText?.title ?? "pandac的blog",
			subtitle,
			typewriter: {
				enable: data.homeText?.typewriter?.enable ?? true,
				speed: data.homeText?.typewriter?.speed ?? 100,
				deleteSpeed: data.homeText?.typewriter?.deleteSpeed ?? 50,
				pauseTime: data.homeText?.typewriter?.pauseTime ?? 2000,
			},
		},
	};
}

export function loadProjectsData(): ProjectItem[] {
	const data = parseYaml<{ items?: ProjectItem[] }>(projectsRaw);
	const items = Array.isArray(data.items) ? data.items : [];
	return items.map((item, index) => ({
		id: item.id || `project-${index + 1}`,
		title: item.title ?? "",
		description: item.description ?? "",
		image: item.image ?? "",
		category: item.category ?? "other",
		techStack: normalizeStringList(item.techStack, "tech"),
		status: item.status ?? "planned",
		liveDemo: item.liveDemo,
		sourceCode: item.sourceCode,
		visitUrl: item.visitUrl,
		startDate: item.startDate ?? "",
		endDate: item.endDate,
		featured: item.featured ?? false,
		tags: normalizeStringList(item.tags, "tag"),
		showImage: item.showImage,
	}));
}

export function loadSkillsData(): SkillItem[] {
	const data = parseYaml<{ items?: SkillItem[] }>(skillsRaw);
	const items = Array.isArray(data.items) ? data.items : [];
	return items.map((item, index) => ({
		id: item.id || `skill-${index + 1}`,
		name: item.name ?? "",
		description: item.description ?? "",
		icon: item.icon ?? "mdi:code-tags",
		category: item.category ?? "other",
		level: item.level ?? "beginner",
		experience: {
			years: Number(item.experience?.years ?? 0),
			months: Number(item.experience?.months ?? 0),
		},
		projects: normalizeStringList(item.projects, "project"),
		certifications: normalizeStringList(item.certifications, "cert"),
		color: item.color,
	}));
}

export function loadTimelineData(): TimelineItemData[] {
	const data = parseYaml<{ items?: TimelineItemData[] }>(timelineRaw);
	return Array.isArray(data.items) ? data.items : [];
}

export function loadDiaryData(): DiaryItemData[] {
	const data = parseYaml<{ items?: DiaryItemData[] }>(diaryRaw);
	const items = Array.isArray(data.items) ? data.items : [];
	return items.map((item, index) => ({
		id: Number(item.id ?? index + 1),
		content: item.content ?? "",
		date: item.date ?? new Date().toISOString(),
		images: normalizeImageList(item.images),
		location: item.location,
		mood: item.mood,
		tags: normalizeStringList(item.tags, "tag"),
	}));
}

export function loadAnimeData(): AnimeItemData[] {
	const data = parseYaml<{ items?: AnimeItemData[] }>(animeRaw);
	const items = Array.isArray(data.items) ? data.items : [];
	return items.map((item) => ({
		title: item.title ?? "",
		status: item.status ?? "planned",
		rating: Number(item.rating ?? 0),
		cover: item.cover ?? "",
		description: item.description ?? "",
		episodes: item.episodes ?? "",
		year: String(item.year ?? ""),
		genre: normalizeStringList(item.genre, "genre"),
		studio: item.studio ?? "",
		link: item.link ?? "",
		progress: Number(item.progress ?? 0),
		totalEpisodes: Number(item.totalEpisodes ?? 0),
		startDate: item.startDate ?? "",
		endDate: item.endDate ?? "",
	}));
}

export function loadDevicesData(): Record<string, DeviceItemData[]> {
	const data = parseYaml<{
		categories?:
			| Record<string, DeviceItemData[]>
			| { key?: string; name?: string; devices?: DeviceItemData[] }[];
	}>(devicesRaw);
	const raw = data.categories;
	if (!raw) return {};
	if (Array.isArray(raw)) {
		const out: Record<string, DeviceItemData[]> = {};
		for (const cat of raw) {
			const key = cat.key || cat.name;
			if (!key) continue;
			out[key] = Array.isArray(cat.devices) ? cat.devices : [];
		}
		return out;
	}
	if (typeof raw === "object") {
		return raw as Record<string, DeviceItemData[]>;
	}
	return {};
}

export type MusicAdminConfig = {
	enable: boolean;
	showFloatingPlayer: boolean;
	floatingEntryMode: "default" | "fab";
	mode: "local" | "meting";
	meting_api: string;
	id: string;
	server: string;
	type: string;
};

export type PioAdminConfig = {
	enable: boolean;
	position: "left" | "right";
	width: number;
	height: number;
	mode: string;
	hiddenOnMobile: boolean;
	models: string[];
	dialog: {
		welcome?: string;
		home?: string;
		close?: string;
		link?: string;
		touch?: string[];
		skin?: string[];
	};
};

export function loadMusicConfig(): MusicAdminConfig {
	const data = parseYaml<Partial<MusicAdminConfig>>(musicRaw);
	return {
		enable: data.enable ?? false,
		showFloatingPlayer: data.showFloatingPlayer ?? false,
		floatingEntryMode: (data.floatingEntryMode as any) ?? "fab",
		mode: (data.mode as any) ?? "local",
		meting_api:
			data.meting_api ??
			"https://meting.mysqil.com/api?server=:server&type=:type&id=:id&auth=:auth&r=:r",
		id: String(data.id ?? ""),
		server: data.server ?? "netease",
		type: data.type ?? "playlist",
	};
}

export function loadPioConfig(): PioAdminConfig {
	const data = parseYaml<any>(pioRaw) || {};
	const dialog = data.dialog || {};
	return {
		enable: data.enable ?? false,
		position: data.position === "right" ? "right" : "left",
		width: Number(data.width ?? 280),
		height: Number(data.height ?? 250),
		mode: data.mode ?? "draggable",
		hiddenOnMobile: data.hiddenOnMobile ?? true,
		models: Array.isArray(data.models) ? data.models : ["/pio/models/pio/model.json"],
		dialog: {
			welcome: dialog.welcome ?? "",
			home: dialog.home ?? "",
			close: dialog.close ?? "",
			link: dialog.link ?? "",
			touch: Array.isArray(dialog.touch) ? dialog.touch : [],
			skin: Array.isArray(dialog.skin) ? dialog.skin : [],
		},
	};
}
