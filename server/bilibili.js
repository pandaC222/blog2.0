function parseMediaId(input) {
	const text = String(input || "").trim();
	const match =
		text.match(/\/md(\d+)/i) ||
		text.match(/media_id=(\d+)/i) ||
		text.match(/ss(\d+)/i) ||
		text.match(/^(\d{2,})$/);
	return match ? match[1] : "";
}

function namesOf(list) {
	if (!Array.isArray(list)) return [];
	return list
		.map((item) => (typeof item === "string" ? item : item?.name || ""))
		.map((item) => String(item).trim())
		.filter(Boolean);
}

function studioFromStaff(staff) {
	const lines = String(staff || "")
		.split(/\n+/)
		.map((line) => line.trim())
		.filter(Boolean);
	for (const key of ["动画制作", "制作公司", "製作", "制作"]) {
		const line = lines.find((item) => item.startsWith(key) || item.includes(`${key}：`) || item.includes(`${key}:`));
		if (!line) continue;
		const value = line.split(/[:：]/).slice(1).join("：").trim();
		if (value) return value.split(/[/、,，\s]/)[0].trim() || value;
	}
	return "";
}

function yearOf(publish = {}) {
	for (const value of [publish.pub_date, publish.release_date, publish.pub_time, publish.pub_date_show]) {
		const match = String(value || "").match(/(20\d{2}|19\d{2})/);
		if (match) return match[1];
	}
	return "";
}

async function getJson(url) {
	const response = await fetch(url, {
		headers: {
			"User-Agent": "Mozilla/5.0",
			Referer: "https://www.bilibili.com",
			Accept: "application/json,text/plain,*/*",
		},
	});
	if (!response.ok) throw new Error(`B站接口 HTTP ${response.status}`);
	return response.json();
}

export async function fetchBangumi(raw) {
	const mediaId = parseMediaId(raw);
	if (!mediaId) throw new Error("无法识别 B 站 media id");
	const mediaResp = await getJson(
		`https://api.bilibili.com/pgc/view/web/media?media_id=${mediaId}`,
	);
	if (mediaResp?.code !== 0) throw new Error(mediaResp?.message || "media 接口失败");
	const media = mediaResp.result?.media || mediaResp.result || {};
	const seasonId = media.season_id || mediaId;
	let season = {};
	try {
		const seasonResp = await getJson(
			`https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`,
		);
		if (seasonResp?.code === 0) season = seasonResp.result || {};
	} catch {
		/* season 详情可选 */
	}
	const publish = season.publish || media.publish || {};
	const styles = namesOf(season.styles?.length ? season.styles : media.styles);
	const areas = namesOf(season.areas?.length ? season.areas : media.areas);
	let totalEpisodes = Number(season.total) || (Array.isArray(season.episodes) ? season.episodes.length : 0) || 0;
	const episodes =
		season.new_ep?.desc ||
		publish.time_length_show ||
		(totalEpisodes ? `全${totalEpisodes}话` : "") ||
		"";
	if (!totalEpisodes) {
		const match = String(episodes).match(/全\s*(\d+)\s*话/);
		if (match) totalEpisodes = Number(match[1]) || 0;
	}
	const startDate = String(publish.pub_date || publish.pub_time || "").slice(0, 10);
	return {
		title: season.title || media.title || "",
		cover: String(season.cover || media.cover || "").replace(/^http:\/\//i, "https://"),
		description: String(season.evaluate || media.evaluate || "").trim(),
		link: season.link || season.share_url || `https://www.bilibili.com/bangumi/media/md${mediaId}`,
		rating: Number(season.rating?.score || media.rating?.score || 0) || 0,
		episodes,
		totalEpisodes,
		year: yearOf(publish),
		studio: studioFromStaff(season.staff || media.staff || "") || areas[0] || "",
		status: "planned",
		progress: 0,
		startDate,
		endDate: Number(publish.is_finish) === 1 ? startDate : "",
		genre: styles.length ? styles : areas,
	};
}
