const TOKEN_KEY = "blog2-admin-token";
const SITE = "http://localhost:4321";
const app = document.querySelector("#app");

const NAV = [
	{ group: "内容" },
	{ id: "posts", label: "文章" },
	{ id: "diary", label: "日记" },
	{ id: "anime", label: "追番" },
	{ id: "about", label: "关于我" },
	{ group: "站点" },
	{ id: "friends", label: "友链" },
	{ id: "projects", label: "项目" },
	{ id: "skills", label: "技能" },
	{ id: "timeline", label: "时间线" },
	{ id: "albums", label: "相册" },
	{ id: "devices", label: "设备" },
	{ id: "profile", label: "个人资料" },
	{ id: "announcement", label: "公告" },
	{ id: "banner", label: "横幅" },
	{ id: "music", label: "音乐" },
	{ id: "pio", label: "看板娘" },
	{ id: "features", label: "模块开关" },
	{ group: "互动" },
	{ id: "comments", label: "评论" },
];

const SKILL_LEVELS = [["beginner", "入门"], ["intermediate", "进阶"], ["advanced", "熟练"], ["expert", "精通"]];
const SKILL_CATEGORIES = [["frontend", "前端"], ["backend", "后端"], ["database", "数据库"], ["tools", "工具"], ["other", "其他"]];
const PROJECT_STATUS = [["planned", "计划中"], ["in-progress", "进行中"], ["completed", "已完成"]];
const TIMELINE_TYPES = [["education", "教育"], ["work", "工作"], ["project", "项目"], ["achievement", "成就"]];
const ANIME_STATUS = [["watching", "在看"], ["planned", "想看"], ["completed", "看完"], ["onhold", "搁置"], ["dropped", "弃番"]];
const MOODS = [["happy", "happy"], ["开心", "开心"], ["平静", "平静"], ["兴奋", "兴奋"], ["疲惫", "疲惫"], ["难过", "难过"], ["生气", "生气"], ["一般", "一般"]];

const LISTS = {
	friends: { key: "items", fields: [["id", "序号", "text"], ["title", "站点名称", "text"], ["imgurl", "头像", "image", "friends"], ["desc", "简介", "textarea"], ["siteurl", "网址", "text"], ["tags", "标签", "tags"]] },
	projects: { key: "items", fields: [["id", "ID", "text"], ["title", "标题", "text"], ["description", "简介", "textarea"], ["image", "封面", "image", "projects"], ["category", "分类", "text"], ["status", "状态", "select", PROJECT_STATUS], ["techStack", "技术栈", "tags"], ["sourceCode", "源码", "text"], ["visitUrl", "演示", "text"], ["startDate", "开始", "date"], ["endDate", "结束", "date"], ["featured", "精选", "bool"]] },
	skills: { key: "items", fields: [["id", "ID", "text"], ["name", "名称", "text"], ["description", "简介", "textarea"], ["icon", "图标", "text"], ["category", "分类", "select", SKILL_CATEGORIES], ["level", "等级", "select", SKILL_LEVELS], ["expYears", "经验（年）", "number"], ["expMonths", "经验（月）", "number"], ["projects", "相关项目", "tags"], ["color", "颜色", "color"]] },
	timeline: { key: "items", fields: [["id", "ID", "text"], ["title", "标题", "text"], ["description", "描述", "textarea"], ["type", "类型", "select", TIMELINE_TYPES], ["startDate", "开始", "date"], ["endDate", "结束", "date"], ["organization", "组织", "text"], ["position", "职位", "text"], ["location", "地点", "text"], ["skills", "技能", "tags"], ["color", "颜色", "color"], ["featured", "精选", "bool"]] },
};

const state = { user: "", view: "posts", dirty: false, title: "文章" };

/* 侧边栏线性图标，描边由 CSS 控制 */
const ICON_PATH = {
	posts: '<path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5"/><path d="M9 13h6M9 17h4"/>',
	diary: '<path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 0-2 2z"/><path d="M6 4v16"/>',
	anime: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5l2 4M14 5l2 4M8 19l2-4M14 19l2-4M3 10h18"/>',
	about: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.5-3 3.5-4 7-4s5.5 1 7 4"/>',
	friends: '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="9" r="2.5"/><path d="M3.5 18c.8-2.2 2.4-3 4.5-3s3.7.8 4.5 3M12 18c.8-2.2 2.4-3 4.5-3s3.7.8 4.5 3"/>',
	projects: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5h8v2"/>',
	skills: '<path d="M12 3l2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.6z"/>',
	timeline: '<path d="M5 5v14"/><circle cx="5" cy="7" r="1.5"/><circle cx="5" cy="13" r="1.5"/><path d="M9 7h9M9 13h7"/>',
	albums: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="M3 16l5-4 4 3 3-2 6 5"/>',
	devices: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
	profile: '<circle cx="12" cy="8" r="3"/><path d="M5 19c1.2-3 3.2-4.5 7-4.5S17.8 16 19 19"/>',
	announcement: '<path d="M5 10v4l10 3V7z"/><path d="M15 9.5a3 3 0 0 1 0 5"/><path d="M8 14v3a2 2 0 0 0 2 2h1"/>',
	banner: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15l5-4 3 2 3-3 7 6"/>',
	music: '<path d="M9 18a3 3 0 1 1-2-2.8V6l10-2v10"/><circle cx="17" cy="14" r="2"/>',
	pio: '<circle cx="12" cy="8" r="4"/><path d="M6 20c1-3 3-4.5 6-4.5s5 1.5 6 4.5"/><path d="M9 8h.01M15 8h.01"/>',
	features: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
	comments: '<path d="M5 6h14v9H8l-3 3z"/>',
	theme: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
	menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
	logout: '<path d="M10 7V5h9v14h-9v-2"/><path d="M13 12H4M7 9l-3 3 3 3"/>',
};

function icon(name) {
	return `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATH[name] || ""}</svg>`;
}

function toggleTheme() {
	const dark = document.documentElement.classList.toggle("dark");
	localStorage.setItem("blog2-admin-theme", dark ? "dark" : "light");
}

function token() {
	return sessionStorage.getItem(TOKEN_KEY) || "";
}

async function api(path, options = {}) {
	const headers = { ...(options.headers || {}) };
	if (token()) headers.Authorization = "Bearer " + token();
	let body = options.body;
	if (body && !(body instanceof FormData)) {
		headers["Content-Type"] = "application/json";
		body = JSON.stringify(body);
	}
	const res = await fetch(path, { ...options, headers, body });
	const data = await res.json().catch(() => ({}));
	if (res.status === 401) {
		sessionStorage.removeItem(TOKEN_KEY);
		renderLogin(data.error || "登录已失效");
		throw new Error(data.error || "未登录");
	}
	if (!res.ok) throw new Error(data.error || res.statusText);
	return data;
}

function esc(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function splitList(value) {
	const list = Array.isArray(value) ? value : String(value ?? "").split(/[,，]/);
	return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))];
}

function lines(value) {
	return String(value ?? "").split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}

function toast(message, kind = "ok") {
	let box = document.querySelector("#toasts");
	if (!box) {
		box = document.createElement("div");
		box.id = "toasts";
		document.body.append(box);
	}
	const node = document.createElement("div");
	node.className = "toast" + (kind === "err" ? " err" : "");
	node.textContent = message;
	box.append(node);
	setTimeout(() => node.remove(), 2000);
}

function confirmBox(title, text) {
	return new Promise((resolve) => {
		const modal = document.createElement("div");
		modal.className = "modal";
		modal.innerHTML = `<div class="dialog" role="dialog"><h3>${esc(title)}</h3><p>${esc(text)}</p><div class="actions"><button class="btn" data-no type="button">取消</button><button class="btn danger" data-yes type="button">确认</button></div></div>`;
		document.body.append(modal);
		const close = (value) => {
			modal.remove();
			resolve(value);
		};
		modal.querySelector("[data-no]").onclick = () => close(false);
		modal.querySelector("[data-yes]").onclick = () => close(true);
		modal.querySelector("[data-yes]").focus();
	});
}

function promptBox(title, label) {
	return new Promise((resolve) => {
		const modal = document.createElement("div");
		modal.className = "modal";
		modal.innerHTML = `<form class="dialog" role="dialog"><h3>${esc(title)}</h3><div class="field"><label>${esc(label)}</label><textarea name="value" required></textarea></div><div class="actions"><button class="btn" data-no type="button">取消</button><button class="btn primary" type="submit">发送</button></div></form>`;
		document.body.append(modal);
		const close = (value) => {
			modal.remove();
			resolve(value);
		};
		modal.querySelector("[data-no]").onclick = () => close("");
		modal.querySelector("form").onsubmit = (event) => {
			event.preventDefault();
			close(new FormData(event.target).get("value").trim());
		};
		modal.querySelector("textarea").focus();
	});
}

function markDirty(form) {
	state.dirty = false;
	form.addEventListener("input", () => {
		state.dirty = true;
	});
}

async function leaveOk() {
	if (!state.dirty) return true;
	const ok = await confirmBox("还有未保存的修改", "离开后这次修改会丢掉。");
	if (ok) state.dirty = false;
	return ok;
}

async function withButton(button, work) {
	const old = button.textContent;
	button.disabled = true;
	button.textContent = "处理中…";
	try {
		return await work();
	} finally {
		button.disabled = false;
		button.textContent = old;
	}
}

function requireFields(form, names) {
	let ok = true;
	names.forEach((name) => {
		const input = form.elements[name];
		const field = input.closest(".field");
		const bad = !String(input.value || "").trim();
		field.classList.toggle("invalid", bad);
		if (bad) ok = false;
	});
	return ok;
}

function bindDrop(zone, onFile) {
	zone.addEventListener("dragover", (event) => {
		event.preventDefault();
		zone.classList.add("over");
	});
	zone.addEventListener("dragleave", () => zone.classList.remove("over"));
	zone.addEventListener("drop", (event) => {
		event.preventDefault();
		zone.classList.remove("over");
		[...event.dataTransfer.files].forEach(onFile);
	});
}

async function uploadFile(file, folder = "") {
	const body = new FormData();
	body.append("file", file);
	if (folder) body.append("folder", folder);
	const saved = await api("/api/admin/upload", { method: "POST", body });
	return saved.url;
}

function img(url) {
	if (!url) return "";
	return String(url).startsWith("http") ? url : SITE + url;
}

function thumb(url, poster) {
	if (!url) return `<div class="shot${poster ? " poster" : ""}">无图</div>`;
	return `<div class="shot${poster ? " poster" : ""}"><img src="${esc(img(url))}" alt="" referrerpolicy="no-referrer"></div>`;
}

function pic(url, poster) {
	return `<div class="pic${poster ? " poster" : ""}">${url ? `<img src="${esc(img(url))}" alt="" referrerpolicy="no-referrer">` : `<span class="muted">无图</span>`}</div>`;
}

function bindImagePreview(root) {
	root.querySelectorAll("[data-shot]").forEach((box) => {
		const input = box.parentElement.querySelector(`[data-key="${box.dataset.shot}"]`);
		if (!input) return;
		const paint = () => {
			const url = input.value.trim();
			box.classList.toggle("poster", box.dataset.poster === "1");
			box.innerHTML = url ? `<img src="${esc(img(url))}" alt="" referrerpolicy="no-referrer">` : "无图";
		};
		input.addEventListener("input", paint);
		paint();
	});
}

function bindImageFields(root) {
	bindImagePreview(root);
	root.querySelectorAll("[data-pick]").forEach((button) => {
		const file = root.querySelector(`[data-file="${button.dataset.pick}"]`);
		if (!file) return;
		button.onclick = () => file.click();
		file.onchange = async (event) => {
			const picked = event.target.files?.[0];
			if (!picked) return;
			const input = root.querySelector(`[data-key="${button.dataset.pick}"]`);
			try {
				input.value = await uploadFile(picked, button.dataset.folder || "");
				input.dispatchEvent(new Event("input", { bubbles: true }));
				state.dirty = true;
				toast("图片已上传");
			} catch (error) {
				toast(error.message, "err");
			}
		};
	});
}

function shell() {
	const nav = NAV.map((item) =>
		item.group
			? `<div class="nav-group">${item.group}</div>`
			: `<button class="nav-btn${item.id === state.view ? " active" : ""}" data-nav="${item.id}" type="button">${icon(item.id)}<span>${item.label}</span></button>`,
	).join("");
	app.innerHTML = `
		<div class="shell" id="shell">
			<aside class="side">
				<div class="brand" style="padding:4px 10px 8px"><span class="mark">${icon("posts")}</span> blog2</div>
				${nav}
			</aside>
			<div class="backdrop" id="backdrop"></div>
			<div class="main-col">
				<header class="topbar">
					<button class="btn ghost icon-btn menu-btn" id="menu" type="button" title="菜单">${icon("menu")}</button>
					<h1 id="crumb">${esc(state.title)}</h1>
					<div class="top-actions">
						<span class="user">${esc(state.user)}</span>
						<button class="btn ghost icon-btn" id="theme" type="button" title="切换深色">${icon("theme")}</button>
						<button class="btn" id="logout" type="button">${icon("logout")}退出</button>
					</div>
				</header>
				<div class="content" id="panel"></div>
			</div>
		</div>`;
	app.querySelectorAll("[data-nav]").forEach((button) => {
		button.onclick = () => open(button.dataset.nav);
	});
	app.querySelector("#theme").onclick = toggleTheme;
	app.querySelector("#logout").onclick = () => {
		sessionStorage.removeItem(TOKEN_KEY);
		state.dirty = false;
		renderLogin();
	};
	const shellNode = app.querySelector("#shell");
	app.querySelector("#menu").onclick = () => shellNode.classList.toggle("nav-open");
	app.querySelector("#backdrop").onclick = () => shellNode.classList.remove("nav-open");
	return app.querySelector("#panel");
}

function renderLogin(message = "") {
	app.innerHTML = `
		<div class="login-wrap">
			<button class="btn ghost icon-btn" id="theme" type="button" title="切换深色" style="position:fixed;top:16px;right:16px">${icon("theme")}</button>
			<form class="login-card" id="login">
				<div class="brand"><span class="mark">${icon("posts")}</span> blog2</div>
				<h1>登录后台</h1>
				<p class="muted">本地管理。保存后写入主题正在读的文件。</p>
				<div class="field"><label>用户名</label><input name="username" autocomplete="username" value="admin"></div>
				<div class="field"><label>密码</label><input name="password" type="password" autocomplete="current-password"></div>
				<div style="margin-top:16px"><button class="btn primary" type="submit">登录</button></div>
				<p class="err">${esc(message)}</p>
			</form>
		</div>`;
	app.querySelector("#theme").onclick = toggleTheme;
	app.querySelector("#login").onsubmit = async (event) => {
		event.preventDefault();
		const button = event.target.querySelector("button");
		const data = new FormData(event.target);
		try {
			await withButton(button, async () => {
				const result = await api("/api/admin/login", {
					method: "POST",
					body: { username: data.get("username"), password: data.get("password") },
				});
				sessionStorage.setItem(TOKEN_KEY, result.token);
				const me = await api("/api/admin/me");
				state.user = me.username;
				open("posts");
			});
		} catch (error) {
			const err = app.querySelector(".err");
			if (err) err.textContent = error.message;
		}
	};
}

async function open(id) {
	if (!(await leaveOk())) return;
	state.view = id;
	state.title = NAV.find((item) => item.id === id)?.label || "后台";
	const panel = shell();
	try {
		if (id === "posts") return await renderPosts(panel);
		if (id === "about") return await renderAbout(panel);
		if (id === "comments") return await renderComments(panel);
		if (id === "diary") return await renderDiary(panel);
		if (id === "anime") return await renderAnime(panel);
		if (id === "albums") return await renderAlbums(panel);
		if (id === "profile") return await renderProfile(panel);
		if (id === "announcement") return await renderAnnouncement(panel);
		if (id === "banner") return await renderBanner(panel);
		if (id === "music") return await renderMusic(panel);
		if (id === "pio") return await renderPio(panel);
		if (id === "features") return await renderFeatures(panel);
		if (id === "devices") return await renderDevices(panel);
		if (LISTS[id]) return await renderList(panel, id);
	} catch (error) {
		panel.innerHTML = `<p class="err">${esc(error.message)}</p>`;
	}
}

function pageHead(panel, title, hint, actions) {
	panel.innerHTML = `<div class="page-head"><div><h2>${esc(title)}</h2><p class="muted">${hint || ""}</p></div><div id="actions"></div></div><div id="body"></div>`;
	if (actions) panel.querySelector("#actions").append(actions);
	return panel.querySelector("#body");
}

async function renderPosts(panel) {
	const button = Object.assign(document.createElement("button"), {
		className: "btn primary",
		textContent: "新建文章",
		type: "button",
	});
	button.onclick = () => renderPostEditor(null);
	const body = pageHead(panel, "文章", "列表来自 Markdown 文件。筛选按文件里的分类和标签。", button);
	const data = await api("/api/admin/content/posts");
	const posts = data.posts || [];
	const categories = [...new Set(posts.map((post) => post.category).filter(Boolean))];
	const tags = [...new Set(posts.flatMap((post) => post.tags || []))];
	body.innerHTML = `
		<div class="filters">
			<input id="q" type="search" placeholder="搜索标题">
			<select id="cat"><option value="">全部分类</option>${categories.map((item) => `<option>${esc(item)}</option>`).join("")}</select>
			<select id="tag"><option value="">全部标签</option>${tags.map((item) => `<option>${esc(item)}</option>`).join("")}</select>
			<select id="status"><option value="">全部状态</option><option value="pub">已发布</option><option value="draft">草稿</option></select>
		</div>
		<div id="rows"></div>`;
	const draw = () => {
		const q = body.querySelector("#q").value.trim().toLowerCase();
		const cat = body.querySelector("#cat").value;
		const tag = body.querySelector("#tag").value;
		const status = body.querySelector("#status").value;
		const rows = posts.filter((post) => {
			if (q && !String(post.title).toLowerCase().includes(q)) return false;
			if (cat && post.category !== cat) return false;
			if (tag && !(post.tags || []).includes(tag)) return false;
			if (status === "draft" && !post.draft) return false;
			if (status === "pub" && post.draft) return false;
			return true;
		});
		body.querySelector("#rows").innerHTML = `<div class="mini-grid">${rows
			.map(
				(post) => `<div class="mini">
			${pic(post.image)}
			<div class="body">
				<h3>${esc(post.title)}</h3>
				<div class="meta">${esc(String(post.published || "").slice(0, 10))}${post.category ? ` · ${esc(post.category)}` : ""}</div>
				<div class="meta">${esc(post.slug)}</div>
				<div><span class="badge ${post.draft ? "warn" : "ok"}">${post.draft ? "草稿" : "已发布"}</span>${post.pinned ? ` <span class="badge">置顶</span>` : ""}</div>
				<div class="ops"><button class="btn" type="button" data-edit="${esc(post.slug)}">编辑</button> <button class="btn danger" type="button" data-del="${esc(post.slug)}">删除</button></div>
			</div>
		</div>`,
			)
			.join("")}</div>${rows.length ? "" : `<p class="muted">没有匹配的文章</p>`}`;
		body.querySelectorAll("[data-edit]").forEach((node) => {
			node.onclick = () => renderPostEditor(node.dataset.edit);
		});
		body.querySelectorAll("[data-del]").forEach((node) => {
			node.onclick = async () => {
				if (!(await confirmBox("删除文章", `删除「${node.dataset.del}」？Markdown 和数据库记录都会去掉。`))) return;
				await withButton(node, () =>
					api("/api/admin/content/posts?slug=" + encodeURIComponent(node.dataset.del), { method: "DELETE" }),
				);
				toast("已删除");
				renderPosts(document.querySelector("#panel"));
			};
		});
	};
	body.querySelectorAll(".filters > *").forEach((node) => node.addEventListener("input", draw));
	draw();
}

function publishedValue(date, time) {
	if (!date) return "";
	if (!time) return date;
	const clock = time.length === 5 ? time + ":00" : time;
	return `${date}T${clock}+08:00`;
}

function splitPublished(value) {
	const text = String(value || "");
	const date = text.slice(0, 10);
	const time = text.match(/T(\d{2}:\d{2})/)?.[1] || "";
	return { date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "", time: text.includes("T") ? time : "" };
}

function mdPreview(source) {
	const escaped = esc(source).replaceAll("\r\n", "\n");
	const blocks = [];
	const text = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
		blocks.push(`<pre><code>${code.replace(/^\n/, "")}</code></pre>`);
		return `\n@@${blocks.length - 1}@@\n`;
	});
	const html = text
		.split(/\n{2,}/)
		.map((part) => {
			if (/^@@\d+@@$/.test(part.trim())) return part.trim();
			let line = part;
			line = line
				.replace(/^###### (.*)$/gm, "<h6>$1</h6>")
				.replace(/^##### (.*)$/gm, "<h5>$1</h5>")
				.replace(/^#### (.*)$/gm, "<h4>$1</h4>")
				.replace(/^### (.*)$/gm, "<h3>$1</h3>")
				.replace(/^## (.*)$/gm, "<h2>$1</h2>")
				.replace(/^# (.*)$/gm, "<h1>$1</h1>");
			line = line.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");
			line = line.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" referrerpolicy="no-referrer">');
			line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
			line = line.replace(/`([^`]+)`/g, "<code>$1</code>");
			line = line.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
			if (/^(?:- |\d+\. )/m.test(line)) {
				const ordered = /^\d+\. /m.test(line);
				const items = line
					.split("\n")
					.map((item) => `<li>${item.replace(/^(- |\d+\. )/, "")}</li>`)
					.join("");
				return ordered ? `<ol>${items}</ol>` : `<ul>${items}</ul>`;
			}
			if (/^<h\d/.test(line) || line.startsWith("<blockquote")) return line;
			return `<p>${line.replaceAll("\n", "<br>")}</p>`;
		})
		.join("\n");
	return html.replace(/@@(\d+)@@/g, (_, index) => blocks[Number(index)] || "");
}

function insertAt(textarea, before, after = "") {
	const start = textarea.selectionStart;
	const end = textarea.selectionEnd;
	const selected = textarea.value.slice(start, end) || "文本";
	textarea.setRangeText(before + selected + after, start, end, "end");
	textarea.focus();
	textarea.dispatchEvent(new Event("input"));
}

async function renderPostEditor(slug) {
	if (!(await leaveOk())) return;
	state.view = "posts";
	state.title = slug ? "编辑文章" : "新建文章";
	const panel = shell();
	let file = { data: {}, body: "" };
	if (slug) file = await api("/api/admin/content/posts/file?slug=" + encodeURIComponent(slug));
	const listed = await api("/api/admin/content/posts");
	const categories = [...new Set((listed.posts || []).map((post) => post.category).filter(Boolean))];
	const fm = file.data || {};
	const when = splitPublished(fm.published);
	const updated = splitPublished(fm.updated);
	const tags = Array.isArray(fm.tags) ? [...fm.tags] : [];
	panel.innerHTML = `
		<form id="post">
			<div class="card">
				<div class="row">
					<div class="field"><label>标题</label><input name="title" value="${esc(fm.title || "")}"></div>
					<div class="field"><label>slug（文件名）</label><input name="slug" value="${esc(file.slug || "")}"></div>
				</div>
				<div class="row">
					<div class="field"><label>发布日期</label><input name="pdate" type="date" value="${esc(when.date)}"></div>
					<div class="field"><label>发布时间（空则只写日期）</label><input name="ptime" type="time" value="${esc(when.time)}"></div>
					<div class="field"><label>更新日期</label><input name="udate" type="date" value="${esc(updated.date)}"></div>
					<div class="field"><label>更新时间</label><input name="utime" type="time" value="${esc(updated.time)}"></div>
				</div>
				<div class="row">
					<div class="field"><label>分类</label><select name="category"><option value="">未分类</option>${categories.map((item) => `<option ${item === fm.category ? "selected" : ""}>${esc(item)}</option>`).join("")}<option value="__new">新建分类</option></select><input name="categoryNew" placeholder="新分类" style="margin-top:8px;display:none"></div>
					<div class="field"><label>标签（回车或逗号确认，中文逗号会拆开）</label><div class="chips" id="chips"></div><input id="tag-input" placeholder="算法，周赛"></div>
					<div class="field"><label>排序 priority</label><input name="priority" type="number" value="${fm.priority ?? ""}"></div>
				</div>
				<div class="field"><label>摘要</label><textarea name="description">${esc(fm.description || "")}</textarea></div>
				<div class="field"><label>封面</label><div class="shot-row"><div class="shot" data-shot="image"></div><div class="shot-fields"><input name="image" data-key="image" value="${esc(fm.image || "")}"><div class="drop" id="cover-drop">拖拽图片到这里，或点击选择<input type="file" accept="image/*" id="cover-file" hidden></div></div></div></div>
				<div class="row">
					<label class="switch"><input name="draft" type="checkbox" ${fm.draft ? "checked" : ""}> 草稿</label>
					<label class="switch"><input name="pinned" type="checkbox" ${fm.pinned ? "checked" : ""}> 置顶</label>
					<label class="switch"><input name="comment" type="checkbox" ${fm.comment === false ? "" : "checked"}> 允许评论</label>
				</div>
			</div>
			<div class="card">
				<div class="toolbar">
					<button class="btn" type="button" data-wrap="**">加粗</button>
					<button class="btn" type="button" data-wrap="*">斜体</button>
					<button class="btn" type="button" data-wrap="## ">标题</button>
					<button class="btn" type="button" data-wrap="\`">代码</button>
					<button class="btn" type="button" data-link>链接</button>
					<button class="btn" type="button" id="md-image">图片</button>
					<input id="md-file" type="file" accept="image/*" hidden>
				</div>
				<div class="editor">
					<textarea name="body">${esc(file.body || "")}</textarea>
					<div class="preview" id="preview"></div>
				</div>
				<p class="muted">阅读量 ${file.views ?? 0} 保存在数据库。表单没展示的 frontmatter 会保留。</p>
				<button class="btn primary" type="submit">保存</button>
				<button class="btn" type="button" id="back">返回</button>
			</div>
		</form>`;
	const form = panel.querySelector("#post");
	const bodyBox = form.elements.body;
	const preview = panel.querySelector("#preview");
	const paint = () => {
		preview.innerHTML = mdPreview(bodyBox.value);
	};
	bodyBox.addEventListener("input", paint);
	paint();
	form.querySelectorAll("[data-wrap]").forEach((button) => {
		button.onclick = () => {
			const wrap = button.dataset.wrap;
			if (wrap === "## ") insertAt(bodyBox, "## ", "");
			else if (wrap === "`") insertAt(bodyBox, "`", "`");
			else insertAt(bodyBox, wrap, wrap);
		};
	});
	form.querySelector("[data-link]").onclick = () => insertAt(bodyBox, "[", "](https://)");
	panel.querySelector("#md-image").onclick = () => panel.querySelector("#md-file").click();
	panel.querySelector("#md-file").onchange = async (event) => {
		const picked = event.target.files?.[0];
		if (!picked) return;
		try {
			const url = await uploadFile(picked, "");
			insertAt(bodyBox, `![](${url})`, "");
			toast("图片已插入");
		} catch (error) {
			toast(error.message, "err");
		}
	};
	const cover = form.elements.image;
	bindImagePreview(form);
	const drop = panel.querySelector("#cover-drop");
	drop.onclick = () => panel.querySelector("#cover-file").click();
	const setCover = async (picked) => {
		try {
			cover.value = await uploadFile(picked, "");
			cover.dispatchEvent(new Event("input", { bubbles: true }));
			state.dirty = true;
			toast("封面已上传");
		} catch (error) {
			toast(error.message, "err");
		}
	};
	panel.querySelector("#cover-file").onchange = (event) => {
		if (event.target.files?.[0]) setCover(event.target.files[0]);
	};
	bindDrop(drop, setCover);
	const category = form.elements.category;
	const categoryNew = form.elements.categoryNew;
	category.onchange = () => {
		categoryNew.style.display = category.value === "__new" ? "" : "none";
	};
	const chipBox = panel.querySelector("#chips");
	const tagInput = panel.querySelector("#tag-input");
	const drawTags = () => {
		chipBox.innerHTML = tags
			.map((tag, index) => `<span class="chip">${esc(tag)}<button type="button" data-i="${index}">×</button></span>`)
			.join("");
		chipBox.querySelectorAll("button").forEach((node) => {
			node.onclick = () => {
				tags.splice(Number(node.dataset.i), 1);
				state.dirty = true;
				drawTags();
			};
		});
	};
	drawTags();
	const commitTagInput = () => {
		if (!tagInput.value.trim()) return;
		splitList(tagInput.value).forEach((tag) => {
			if (!tags.includes(tag)) tags.push(tag);
		});
		tagInput.value = "";
		state.dirty = true;
		drawTags();
	};
	tagInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === "," || event.key === "，") {
			event.preventDefault();
			commitTagInput();
		}
	});
	tagInput.addEventListener("blur", commitTagInput);
	markDirty(form);
	panel.querySelector("#back").onclick = () => open("posts");
	form.onsubmit = async (event) => {
		event.preventDefault();
		commitTagInput();
		if (!requireFields(form, ["title", "slug", "pdate"])) {
			toast("请填写标题、slug 和发布日期", "err");
			return;
		}
		const button = form.querySelector("[type=submit]");
		const data = new FormData(form);
		try {
			const saved = await withButton(button, () =>
				api("/api/admin/content/posts", {
					method: "PUT",
					body: {
						previousSlug: slug || "",
						slug: data.get("slug"),
						title: data.get("title"),
						published: publishedValue(data.get("pdate"), data.get("ptime")),
						updated: data.get("udate") ? publishedValue(data.get("udate"), data.get("utime")) : "",
						category: data.get("category") === "__new" ? data.get("categoryNew") : data.get("category"),
						tags,
						priority: data.get("priority"),
						description: data.get("description"),
						image: data.get("image"),
						draft: data.get("draft") === "on",
						pinned: data.get("pinned") === "on",
						comment: data.get("comment") === "on",
						body: data.get("body"),
					},
				}),
			);
			state.dirty = false;
			slug = saved.slug;
			toast("已保存");
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

function presentItem(item) {
	const next = { ...item };
	for (const key of ["tags", "techStack", "genre", "skills", "projects"]) {
		if (Array.isArray(next[key])) next[key] = next[key].join(", ");
	}
	if (Array.isArray(next.images)) {
		next.images = next.images
			.map((image) => (typeof image === "string" ? image : image?.url || image?.image || ""))
			.filter(Boolean);
	}
	if (next.experience && typeof next.experience === "object") {
		next.expYears = Number(next.experience.years || 0);
		next.expMonths = Number(next.experience.months || 0);
	}
	return next;
}

function commitItem(original, draft, fields) {
	const next = { ...original };
	fields.forEach(([key, , type]) => {
		if (key === "expYears" || key === "expMonths") return;
		const value = draft[key];
		if (type === "tags") next[key] = splitList(value);
		else if (type === "bool") next[key] = Boolean(value);
		else if (type === "number") next[key] = value === "" || value === undefined ? 0 : Number(value);
		else if (type === "images") next[key] = Array.isArray(value) ? value : [];
		else next[key] = value ?? "";
	});
	if (fields.some(([key]) => key === "expYears")) {
		next.experience = { years: Number(draft.expYears || 0), months: Number(draft.expMonths || 0) };
		delete next.expYears;
		delete next.expMonths;
	}
	return next;
}

function readCard(card, fields, current) {
	const draft = { ...current };
	fields.forEach(([key, , type]) => {
		if (type === "images") return;
		const node = card.querySelector(`[data-key="${key}"]`);
		if (!node) return;
		draft[key] = type === "bool" ? node.checked : node.value;
	});
	return draft;
}

function selectOptions(options, current) {
	const known = options.some(([value]) => value === current);
	const extra = current && !known ? `<option value="${esc(current)}" selected>${esc(current)}（现有）</option>` : "";
	return extra + options.map(([value, text]) => `<option value="${esc(value)}" ${value === current ? "selected" : ""}>${esc(text)}</option>`).join("");
}

function bindColors(root) {
	root.querySelectorAll("[data-color-picker]").forEach((picker) => {
		const text = picker.parentElement.querySelector("[data-key]");
		const toHex = (value) => {
			const raw = String(value || "").trim();
			if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw;
			if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw}`;
			return "";
		};
		picker.addEventListener("input", () => {
			text.value = picker.value.toUpperCase();
			text.dispatchEvent(new Event("input", { bubbles: true }));
		});
		text.addEventListener("input", () => {
			const hex = toHex(text.value);
			if (hex) picker.value = hex;
		});
		const hex = toHex(text.value);
		if (hex) picker.value = hex;
	});
}

function fieldHtml(field, value) {
	const [key, label, type] = field;
	if (type === "textarea") {
		return `<div class="field"><label>${esc(label)}</label><textarea data-key="${key}">${esc(value ?? "")}</textarea></div>`;
	}
	if (type === "bool") {
		return `<label class="switch"><input data-key="${key}" type="checkbox" ${value ? "checked" : ""}> ${esc(label)}</label>`;
	}
	if (type === "select") {
		return `<div class="field"><label>${esc(label)}</label><select data-key="${key}">${selectOptions(field[3] || [], value ?? "")}</select></div>`;
	}
	if (type === "color") {
		const current = value || "#3B82F6";
		return `<div class="field"><label>${esc(label)}</label><div class="color-row"><input type="color" data-color-picker value="${esc(/^#[0-9a-fA-F]{6}$/.test(current) ? current : "#3B82F6")}"><input data-key="${key}" value="${esc(current)}"></div></div>`;
	}
	if (type === "date") {
		return `<div class="field"><label>${esc(label)}</label><input data-key="${key}" type="date" value="${esc(String(value || "").slice(0, 10))}"></div>`;
	}
	if (type === "images") {
		const list = Array.isArray(value) ? value : [];
		return `<div class="field" data-images="${key}"><label>${esc(label)}</label><div class="thumbs">${list.map((url) => `<figure><img src="${esc(img(url))}" alt="" referrerpolicy="no-referrer"><button class="btn danger" type="button" data-rm="${esc(url)}">移除</button></figure>`).join("")}</div><div class="drop" data-drop>拖拽或点击上传<input type="file" accept="image/*" hidden data-file></div></div>`;
	}
	if (type === "image") {
		const poster = field[4] === "poster" ? ' data-poster="1"' : "";
		return `<div class="field"><label>${esc(label)}</label><div class="shot-row"><div class="shot"${poster} data-shot="${key}"></div><div class="shot-fields"><input data-key="${key}" value="${esc(value ?? "")}"><input data-file="${key}" type="file" accept="image/*" hidden><button class="btn" type="button" data-pick="${key}" data-folder="${esc(field[3] || "")}">选择图片</button></div></div></div>`;
	}
	return `<div class="field"><label>${esc(label)}</label><input data-key="${key}" type="${type === "number" ? "number" : "text"}" value="${esc(value ?? "")}"></div>`;
}

async function renderDiary(panel) {
	const file = await api("/api/admin/content/boards/diary");
	const originals = Array.isArray(file.data.items) ? file.data.items : [];
	let items = originals.map(presentItem);
	let editing = -1;
	const fields = [
		["id", "序号", "text"],
		["content", "内容", "textarea"],
		["date", "时间（保持无时区，如 2026-07-17T06:04:00）", "text"],
		["mood", "心情", "select", MOODS],
		["location", "地点", "text"],
		["images", "图片", "images"],
		["tags", "标签", "tags"],
	];
	const button = Object.assign(document.createElement("button"), {
		className: "btn primary",
		textContent: "写一条",
		type: "button",
	});
	const body = pageHead(panel, "日记", "保存到 diary.yml。没在表单里的字段会留着。", button);
	const save = async () => {
		await api("/api/admin/content/boards/diary", { method: "PUT", body: { data: { ...file.data, items: originals } } });
		toast("日记已保存");
	};
	const draw = () => {
		if (editing < 0) {
			body.innerHTML = `<div class="mini-grid">${items
				.map(
					(item, index) => `<div class="mini">
				${pic(Array.isArray(item.images) ? item.images[0] : "")}
				<div class="body">
					<h3>${esc(String(item.content || "").slice(0, 42) || "（无内容）")}</h3>
					<div class="meta">${[item.date, item.mood, item.location].filter(Boolean).map((text) => esc(text)).join(" · ")}</div>
					${item.tags ? `<div class="meta">${esc(item.tags)}</div>` : ""}
					<div class="ops"><button class="btn" type="button" data-edit="${index}">编辑</button> <button class="btn danger" type="button" data-del="${index}">删除</button></div>
				</div>
			</div>`,
				)
				.join("")}</div>${items.length ? "" : `<p class="muted">还没有日记</p>`}`;
			body.querySelectorAll("[data-edit]").forEach((node) => {
				node.onclick = () => {
					editing = Number(node.dataset.edit);
					draw();
				};
			});
			body.querySelectorAll("[data-del]").forEach((node) => {
				node.onclick = async () => {
					if (!(await confirmBox("删除日记", "只去掉这一条，其他条目保留。"))) return;
					const index = Number(node.dataset.del);
					items.splice(index, 1);
					originals.splice(index, 1);
					await save();
					draw();
				};
			});
			return;
		}
		const item = items[editing] || {};
		body.innerHTML = `<form class="card" id="one">${fields.map((field) => fieldHtml(field, item[field[0]])).join("")}<div class="toolbar"><button class="btn primary" type="submit">保存</button><button class="btn" type="button" id="cancel">返回</button></div></form>`;
		const form = body.querySelector("#one");
		const images = Array.isArray(item.images) ? [...item.images] : [];
		const zone = form.querySelector("[data-images]");
		const refreshImages = () => {
			zone.querySelector(".thumbs").innerHTML = images
				.map((url) => `<figure><img src="${esc(img(url))}" alt="" referrerpolicy="no-referrer"><button class="btn danger" type="button" data-rm="${esc(url)}">移除</button></figure>`)
				.join("");
			zone.querySelectorAll("[data-rm]").forEach((node) => {
				node.onclick = () => {
					images.splice(images.indexOf(node.dataset.rm), 1);
					state.dirty = true;
					refreshImages();
				};
			});
		};
		const addImages = async (list) => {
			try {
				for (const picked of list) images.push(await uploadFile(picked, "diary"));
				state.dirty = true;
				refreshImages();
				toast("图片已上传");
			} catch (error) {
				toast(error.message, "err");
			}
		};
		zone.querySelector("[data-drop]").onclick = () => zone.querySelector("[data-file]").click();
		zone.querySelector("[data-file]").onchange = (event) => addImages([...event.target.files]);
		bindDrop(zone.querySelector("[data-drop]"), (picked) => addImages([picked]));
		form.querySelector("#cancel").onclick = () => {
			state.dirty = false;
			editing = -1;
			draw();
		};
		markDirty(form);
		form.onsubmit = async (event) => {
			event.preventDefault();
			const draft = readCard(form, fields, item);
			draft.images = images;
			const next = commitItem(originals[editing] || {}, draft, fields);
			if (editing >= originals.length) originals.push(next);
			else originals[editing] = next;
			items = originals.map(presentItem);
			const button = form.querySelector("[type=submit]");
			await withButton(button, save);
			state.dirty = false;
			editing = -1;
			draw();
		};
	};
	button.onclick = () => {
		items.push({ id: "", content: "", date: "", mood: "", location: "", images: [], tags: "" });
		editing = items.length - 1;
		draw();
	};
	draw();
}

async function renderAnime(panel) {
	const file = await api("/api/admin/content/boards/anime");
	const originals = Array.isArray(file.data.items) ? file.data.items : [];
	let items = originals.map(presentItem);
	let editing = -1;
	const fields = [
		["title", "标题", "text"],
		["status", "状态", "select", ANIME_STATUS],
		["rating", "评分", "number"],
		["cover", "封面", "image", "anime", "poster"],
		["description", "简介", "textarea"],
		["episodes", "话数说明", "text"],
		["year", "年份", "text"],
		["genre", "类型", "tags"],
		["studio", "制作", "text"],
		["link", "链接", "text"],
		["progress", "进度", "number"],
		["totalEpisodes", "总集数", "number"],
		["startDate", "开始日期", "date"],
		["endDate", "结束日期", "date"],
	];
	const button = Object.assign(document.createElement("button"), {
		className: "btn primary",
		textContent: "添加",
		type: "button",
	});
	const body = pageHead(panel, "追番", "保存到 anime.yml。可以从 B 站链接填入。", button);
	const draw = () => {
		if (editing < 0) {
			const statusText = (value) => ANIME_STATUS.find(([key]) => key === value)?.[1] || value || "";
			body.innerHTML = `<div class="mini-grid">${items
				.map(
					(item, index) => `<div class="mini">
				${pic(item.cover, true)}
				<div class="body">
					<h3>${esc(item.title || "")}</h3>
					<div class="meta">${esc(statusText(item.status))}${item.rating ? ` · ${esc(item.rating)} 分` : ""}${item.year ? ` · ${esc(item.year)}` : ""}</div>
					<div class="meta">${esc(item.progress ?? 0)} / ${esc(item.totalEpisodes ?? "?")} 集</div>
					<div class="ops"><button class="btn" type="button" data-edit="${index}">编辑</button> <button class="btn danger" type="button" data-del="${index}">删除</button></div>
				</div>
			</div>`,
				)
				.join("")}</div>${items.length ? "" : `<p class="muted">还没有追番</p>`}`;
			body.querySelectorAll("[data-edit]").forEach((node) => {
				node.onclick = () => {
					editing = Number(node.dataset.edit);
					draw();
				};
			});
			body.querySelectorAll("[data-del]").forEach((node) => {
				node.onclick = async () => {
					if (!(await confirmBox("删除番剧", "去掉这一条后会立刻保存。"))) return;
					originals.splice(Number(node.dataset.del), 1);
					items = originals.map(presentItem);
					await api("/api/admin/content/boards/anime", { method: "PUT", body: { data: { ...file.data, items: originals } } });
					toast("已删除");
					draw();
				};
			});
			return;
		}
		const item = items[editing] || {};
		body.innerHTML = `<form class="card" id="one"><div class="row"><div class="field"><label>B 站链接或 media id</label><input id="bili"></div><div class="field"><label>&nbsp;</label><button class="btn" id="fill" type="button">抓取并填入</button></div></div>${fields.map((field) => fieldHtml(field, item[field[0]])).join("")}<div class="toolbar"><button class="btn primary" type="submit">保存</button><button class="btn" type="button" id="cancel">返回</button></div></form>`;
		const form = body.querySelector("#one");
		bindImageFields(form);
		form.querySelector("#fill").onclick = async () => {
			const fill = form.querySelector("#fill");
			try {
				await withButton(fill, async () => {
					const filled = await api("/api/admin/bilibili", { method: "POST", body: { url: form.querySelector("#bili").value } });
					Object.entries(presentItem(filled)).forEach(([key, value]) => {
						const node = form.querySelector(`[data-key="${key}"]`);
						if (node) {
							node.value = Array.isArray(value) ? value.join(", ") : value ?? "";
							node.dispatchEvent(new Event("input", { bubbles: true }));
						}
					});
				});
				state.dirty = true;
				toast("已填入，记得保存");
			} catch (error) {
				toast(error.message, "err");
			}
		};
		form.querySelector("#cancel").onclick = () => {
			state.dirty = false;
			editing = -1;
			draw();
		};
		markDirty(form);
		form.onsubmit = async (event) => {
			event.preventDefault();
			if (!form.querySelector('[data-key="title"]').value.trim()) {
				toast("标题不能为空", "err");
				return;
			}
			const next = commitItem(originals[editing] || {}, readCard(form, fields, item), fields);
			if (editing >= originals.length) originals.push(next);
			else originals[editing] = next;
			const submit = form.querySelector("[type=submit]");
			await withButton(submit, () =>
				api("/api/admin/content/boards/anime", { method: "PUT", body: { data: { ...file.data, items: originals } } }),
			);
			items = originals.map(presentItem);
			state.dirty = false;
			toast("番剧已保存");
			editing = -1;
			draw();
		};
	};
	button.onclick = () => {
		items.push({ title: "", status: "planned", rating: 0, progress: 0, totalEpisodes: 0, genre: "" });
		editing = items.length - 1;
		draw();
	};
	draw();
}

const STATUS = { pending: "待审", visible: "已通过", hidden: "已隐藏" };
const NEXT = { pending: "visible", visible: "hidden", hidden: "pending" };

async function renderComments(panel) {
	const posts = await api("/api/admin/content/posts");
	const body = pageHead(panel, "评论", "前台只显示已通过。新评论默认待审。");
	body.innerHTML = `<div class="filters">
		<select id="post"><option value="">全部文章</option>${(posts.posts || []).filter((post) => post.id).map((post) => `<option value="${post.id}">${esc(post.title)}</option>`).join("")}</select>
		<select id="status"><option value="">全部状态</option><option value="pending">待审</option><option value="visible">已通过</option><option value="hidden">已隐藏</option></select>
		<input id="q" type="search" placeholder="搜索内容">
	</div><div id="list"></div>`;
	const load = async () => {
		const params = new URLSearchParams();
		const postId = body.querySelector("#post").value;
		const status = body.querySelector("#status").value;
		const q = body.querySelector("#q").value.trim();
		if (postId) params.set("postId", postId);
		if (status) params.set("status", status);
		if (q) params.set("q", q);
		const data = await api("/api/admin/comments?" + params.toString());
		body.querySelector("#list").innerHTML = `<div class="table-wrap"><table><thead><tr><th>文章</th><th>内容</th><th>时间</th><th>状态</th><th></th></tr></thead><tbody>
			${(data.comments || [])
				.map(
					(item) => `<tr>
				<td>${esc(item.post_title || item.slug)}${item.parent_id ? "<br><span class='muted'>回复</span>" : ""}</td>
				<td><strong>${esc(item.author)}</strong>${item.is_admin ? " · 管理员" : ""}<br>${esc(item.content)}</td>
				<td>${esc(item.created_at)}</td>
				<td><span class="badge">${STATUS[item.status] || esc(item.status)}</span></td>
				<td>
					<button class="btn" type="button" data-status="${item.id}" data-next="${NEXT[item.status] || "visible"}">${STATUS[NEXT[item.status]] || "切换"}</button>
					<button class="btn" type="button" data-reply="${item.id}">回复</button>
					<button class="btn danger" type="button" data-del="${item.id}">删除</button>
				</td>
			</tr>`,
				)
				.join("") || `<tr><td colspan="5" class="muted">没有评论</td></tr>`}
		</tbody></table></div>`;
		body.querySelectorAll("[data-status]").forEach((node) => {
			node.onclick = async () => {
				await withButton(node, () =>
					api("/api/admin/comments/" + node.dataset.status, { method: "PATCH", body: { status: node.dataset.next } }),
				);
				toast("状态已更新");
				load();
			};
		});
		body.querySelectorAll("[data-reply]").forEach((node) => {
			node.onclick = async () => {
				const content = await promptBox("回复评论", "回复会直接显示，并标成管理员");
				if (!content) return;
				await api("/api/admin/comments/" + node.dataset.reply + "/reply", { method: "POST", body: { content } });
				toast("已回复");
				load();
			};
		});
		body.querySelectorAll("[data-del]").forEach((node) => {
			node.onclick = async () => {
				if (!(await confirmBox("删除评论", "这条评论会从数据库删掉。"))) return;
				await api("/api/admin/comments/" + node.dataset.del, { method: "DELETE" });
				toast("已删除");
				load();
			};
		});
	};
	body.querySelectorAll(".filters > *").forEach((node) => node.addEventListener("input", load));
	load();
}

async function renderList(panel, id) {
	const spec = LISTS[id];
	const file = await api("/api/admin/content/boards/" + id);
	const originals = Array.isArray(file.data[spec.key]) ? file.data[spec.key] : [];
	let items = originals.map(presentItem);
	let editing = -1;
	const button = Object.assign(document.createElement("button"), {
		className: "btn primary",
		textContent: "添加一条",
		type: "button",
	});
	const body = pageHead(panel, state.title, file.file + "。点小卡片上的编辑修改这一条。", button);
	const save = async () => {
		await api("/api/admin/content/boards/" + id, { method: "PUT", body: { data: { ...file.data, [spec.key]: originals } } });
		toast("已保存");
	};
	const mini = (item, index) => {
		const metas = [];
		if (id === "friends") {
			metas.push(String(item.desc || "").slice(0, 40), item.siteurl || "", item.tags || "");
		} else if (id === "projects") {
			metas.push(
				PROJECT_STATUS.find(([value]) => value === item.status)?.[1] || item.status || "",
				item.category || "",
				item.featured ? "精选" : "",
			);
		} else if (id === "skills") {
			metas.push(
				SKILL_CATEGORIES.find(([value]) => value === item.category)?.[1] || item.category || "",
				SKILL_LEVELS.find(([value]) => value === item.level)?.[1] || item.level || "",
				Number(item.expYears) || Number(item.expMonths) ? `${item.expYears || 0} 年 ${item.expMonths || 0} 月` : "",
			);
		} else if (id === "timeline") {
			metas.push(
				TIMELINE_TYPES.find(([value]) => value === item.type)?.[1] || item.type || "",
				[item.startDate, item.endDate].filter(Boolean).join(" ~ "),
				[item.organization, item.position].filter(Boolean).join(" · "),
			);
		}
		const url = id === "friends" ? item.imgurl : id === "projects" ? item.image : "";
		return `<div class="mini">${url ? pic(url) : ""}<div class="body">
			<h3>${esc(item.title || item.name || "（未命名）")}</h3>
			${metas.filter(Boolean).map((text) => `<div class="meta">${esc(text)}</div>`).join("")}
			<div class="ops"><button class="btn" type="button" data-edit="${index}">编辑</button> <button class="btn danger" type="button" data-del="${index}">删除</button></div>
		</div></div>`;
	};
	const draw = () => {
		if (editing < 0) {
			body.innerHTML = `<div class="mini-grid">${items.map(mini).join("")}</div>${items.length ? "" : `<p class="muted">还没有条目</p>`}`;
			body.querySelectorAll("[data-edit]").forEach((node) => {
				node.onclick = () => {
					editing = Number(node.dataset.edit);
					draw();
				};
			});
			body.querySelectorAll("[data-del]").forEach((node) => {
				node.onclick = async () => {
					if (!(await confirmBox("删除这一条", "删掉后会立刻写入文件。"))) return;
					const index = Number(node.dataset.del);
					items.splice(index, 1);
					originals.splice(index, 1);
					await save();
					draw();
				};
			});
			return;
		}
		const item = items[editing] || {};
		const card = document.createElement("form");
		card.className = "card item";
		card.innerHTML =
			`<div class="page-head"><strong>#${editing + 1} ${esc(item.title || item.name || "")}</strong></div>` +
			spec.fields.map((field) => fieldHtml(field, item[field[0]])).join("") +
			`<div class="toolbar"><button class="btn primary" type="submit">保存</button><button class="btn" type="button" id="cancel">返回</button></div>`;
		card.addEventListener("input", () => {
			state.dirty = true;
		});
		bindColors(card);
		bindImageFields(card);
		card.querySelector("#cancel").onclick = () => {
			state.dirty = false;
			editing = -1;
			draw();
		};
		card.onsubmit = async (event) => {
			event.preventDefault();
			const next = commitItem(originals[editing] || {}, readCard(card, spec.fields, item), spec.fields);
			originals[editing] = next;
			items = originals.map(presentItem);
			await withButton(card.querySelector("[type=submit]"), save);
			state.dirty = false;
			editing = -1;
			draw();
		};
		body.innerHTML = "";
		body.append(card);
	};
	button.onclick = () => {
		originals.push({});
		items = originals.map(presentItem);
		editing = items.length - 1;
		draw();
	};
	draw();
}

async function renderAbout(panel) {
	const data = await api("/api/admin/content/about");
	const body = pageHead(panel, "关于我", "写入 src/content/spec/about.md，只保存正文。");
	body.innerHTML = `<form class="card" id="form"><textarea name="body" style="min-height:320px">${esc(data.body || "")}</textarea><div class="toolbar"><button class="btn primary" type="submit">保存</button></div></form>`;
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		const submit = form.querySelector("[type=submit]");
		try {
			await withButton(submit, () => api("/api/admin/content/about", { method: "PUT", body: { body: new FormData(form).get("body") } }));
			state.dirty = false;
			toast("已保存");
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function saveBoard(id, data) {
	await api("/api/admin/content/boards/" + id, { method: "PUT", body: { data } });
	state.dirty = false;
	toast("已保存");
}

async function renderProfile(panel) {
	const file = await api("/api/admin/content/boards/profile");
	const data = file.data || {};
	const body = pageHead(panel, "个人资料", file.file);
	body.innerHTML = `<form class="card" id="form">
		<div class="row"><div class="field"><label>名字</label><input name="name" value="${esc(data.name || "")}"></div><div class="field"><label>头像</label><div class="shot-row"><div class="shot" data-shot="avatar"></div><div class="shot-fields"><input name="avatar" data-key="avatar" value="${esc(data.avatar || "")}"><input id="file" type="file" accept="image/*" hidden></div></div></div></div>
		<div class="field"><label>简介</label><textarea name="bio">${esc(data.bio || "")}</textarea></div>
		<label class="switch"><input name="tw" type="checkbox" ${data.typewriter?.enable !== false ? "checked" : ""}> 打字机</label>
		<div class="field"><label>速度</label><input name="speed" type="number" value="${Number(data.typewriter?.speed || 80)}"></div>
		<div class="field"><label>链接，每行：名称 | 图标 | 网址</label><textarea name="links">${esc((data.links || []).map((link) => [link.name, link.icon, link.url].join(" | ")).join("\n"))}</textarea></div>
		<button class="btn primary" type="submit">保存</button></form>`;
	bindImagePreview(body.querySelector("#form"));
	body.querySelector("#file").onchange = async (event) => {
		try {
			const input = body.querySelector("[name=avatar]");
			input.value = await uploadFile(event.target.files[0], "");
			input.dispatchEvent(new Event("input", { bubbles: true }));
			state.dirty = true;
			toast("头像已上传");
		} catch (error) {
			toast(error.message, "err");
		}
	};
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		const input = new FormData(form);
		try {
			await withButton(form.querySelector("[type=submit]"), () =>
				saveBoard("profile", {
					...data,
					name: input.get("name"),
					bio: input.get("bio"),
					avatar: input.get("avatar"),
					typewriter: { ...(data.typewriter || {}), enable: input.get("tw") === "on", speed: Number(input.get("speed") || 80) },
					links: lines(input.get("links")).map((line) => {
						const [name, icon, url] = line.split("|").map((part) => part.trim());
						return { name, icon, url };
					}),
				}),
			);
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function renderAnnouncement(panel) {
	const file = await api("/api/admin/content/boards/announcement");
	const data = file.data || {};
	const link = data.link || {};
	const body = pageHead(panel, "公告", file.file);
	body.innerHTML = `<form class="card" id="form">
		<label class="switch"><input name="enable" type="checkbox" ${data.enable ? "checked" : ""}> 显示</label>
		<div class="field"><label>标题</label><input name="title" value="${esc(data.title || "")}"></div>
		<div class="field"><label>内容</label><textarea name="content">${esc(data.content || "")}</textarea></div>
		<label class="switch"><input name="closable" type="checkbox" ${data.closable ? "checked" : ""}> 可关闭</label>
		<label class="switch"><input name="linkEnable" type="checkbox" ${link.enable ? "checked" : ""}> 链接</label>
		<div class="row"><div class="field"><label>文字</label><input name="text" value="${esc(link.text || "")}"></div><div class="field"><label>地址</label><input name="url" value="${esc(link.url || "")}"></div></div>
		<label class="switch"><input name="external" type="checkbox" ${link.external ? "checked" : ""}> 外部链接</label>
		<button class="btn primary" type="submit">保存</button></form>`;
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		const input = new FormData(form);
		try {
			await withButton(form.querySelector("[type=submit]"), () =>
				saveBoard("announcement", {
					...data,
					enable: input.get("enable") === "on",
					title: input.get("title"),
					content: input.get("content"),
					closable: input.get("closable") === "on",
					link: {
						...link,
						enable: input.get("linkEnable") === "on",
						text: input.get("text"),
						url: input.get("url"),
						external: input.get("external") === "on",
					},
				}),
			);
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function renderBanner(panel) {
	const file = await api("/api/admin/content/boards/banner");
	const data = file.data || {};
	const desktop = Array.isArray(data.desktop) ? [...data.desktop] : [];
	const mobile = Array.isArray(data.mobile) ? [...data.mobile] : [];
	const body = pageHead(panel, "横幅", file.file);
	const draw = () => {
		const list = (name, arr) =>
			arr
				.map(
					(url, index) =>
						`<div class="card"><div class="shot-row"><div class="shot" data-shot="${name[0]}${index}"></div><div class="shot-fields"><input data-${name}="${index}" data-key="${name[0]}${index}" value="${esc(url)}"><div class="toolbar"><button class="btn" type="button" data-up="${name}:${index}">上传替换</button><button class="btn danger" type="button" data-rm="${name}:${index}">删除</button></div></div></div></div>`,
				)
				.join("");
		body.innerHTML = `<h3>桌面</h3>${list("desktop", desktop)}<button class="btn" id="add-d" type="button">添加</button><h3>移动</h3>${list("mobile", mobile)}<button class="btn" id="add-m" type="button">添加</button>
			<div class="card"><label class="switch"><input id="car" type="checkbox" ${data.carousel?.enable !== false ? "checked" : ""}> 轮播</label>
			<div class="field"><label>间隔秒</label><input id="interval" type="number" value="${Number(data.carousel?.interval || 3)}"></div>
			<div class="field"><label>主标题</label><input id="title" value="${esc(data.homeText?.title || "")}"></div>
			<div class="field"><label>副标题，每行一句</label><textarea id="sub">${esc((data.homeText?.subtitle || []).map((item) => (typeof item === "string" ? item : item?.line || "")).join("\n"))}</textarea></div>
			<button class="btn primary" id="save" type="button">保存</button></div><input id="file" type="file" accept="image/*" hidden>`;
		bindImagePreview(body);
		body.querySelectorAll("[data-rm]").forEach((node) => {
			node.onclick = async () => {
				if (!(await confirmBox("删除这张图", "从列表去掉，保存后才写入文件。"))) return;
				const [name, index] = node.dataset.rm.split(":");
				(name === "desktop" ? desktop : mobile).splice(Number(index), 1);
				state.dirty = true;
				draw();
			};
		});
		let target = null;
		body.querySelectorAll("[data-up]").forEach((node) => {
			node.onclick = () => {
				target = node.dataset.up;
				body.querySelector("#file").click();
			};
		});
		body.querySelector("#file").onchange = async (event) => {
			if (!target || !event.target.files[0]) return;
			try {
				const [name, index] = target.split(":");
				(name === "desktop" ? desktop : mobile)[Number(index)] = await uploadFile(event.target.files[0], "banners");
				state.dirty = true;
				draw();
			} catch (error) {
				toast(error.message, "err");
			}
		};
		body.querySelector("#add-d").onclick = () => {
			desktop.push("");
			draw();
		};
		body.querySelector("#add-m").onclick = () => {
			mobile.push("");
			draw();
		};
		body.querySelector("#save").onclick = async () => {
			body.querySelectorAll("[data-desktop]").forEach((input) => {
				desktop[input.dataset.desktop] = input.value;
			});
			body.querySelectorAll("[data-mobile]").forEach((input) => {
				mobile[input.dataset.mobile] = input.value;
			});
			try {
				await withButton(body.querySelector("#save"), () =>
					saveBoard("banner", {
						...data,
						desktop: desktop.filter(Boolean),
						mobile: mobile.filter(Boolean),
						carousel: {
							...(data.carousel || {}),
							enable: body.querySelector("#car").checked,
							interval: Number(body.querySelector("#interval").value || 3),
						},
						homeText: {
							...(data.homeText || {}),
							enable: data.homeText?.enable !== false,
							title: body.querySelector("#title").value,
							subtitle: lines(body.querySelector("#sub").value),
							typewriter: data.homeText?.typewriter || { enable: true, speed: 100, deleteSpeed: 50, pauseTime: 2000 },
						},
					}),
				);
			} catch (error) {
				toast(error.message, "err");
			}
		};
	};
	draw();
}

async function renderMusic(panel) {
	const file = await api("/api/admin/content/boards/music");
	const data = file.data || {};
	const body = pageHead(panel, "音乐", file.file);
	body.innerHTML = `<form class="card" id="form">
		<label class="switch"><input name="enable" type="checkbox" ${data.enable ? "checked" : ""}> 启用</label>
		<label class="switch"><input name="float" type="checkbox" ${data.showFloatingPlayer ? "checked" : ""}> 悬浮播放器</label>
		<div class="field"><label>入口</label><select name="floatingEntryMode">${selectOptions([["default", "默认"], ["fab", "悬浮按钮"]], data.floatingEntryMode || "")}</select></div>
		<div class="field"><label>模式</label><select name="mode">${selectOptions([["local", "本地"], ["meting", "Meting"]], data.mode || "")}</select></div>
		<div class="field"><label>Meting API</label><input name="meting_api" value="${esc(data.meting_api || "")}"></div>
		<div class="row"><div class="field"><label>歌单 ID</label><input name="id" value="${esc(data.id || "")}"></div><div class="field"><label>服务</label><select name="server">${selectOptions([["netease", "网易云"], ["tencent", "QQ 音乐"], ["kugou", "酷狗"], ["xiami", "虾米"], ["baidu", "百度"]], data.server || "")}</select></div><div class="field"><label>类型</label><select name="type">${selectOptions([["playlist", "歌单"], ["song", "单曲"], ["album", "专辑"], ["artist", "歌手"], ["search", "搜索"]], data.type || "")}</select></div></div>
		<button class="btn primary" type="submit">保存</button></form>`;
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		const input = new FormData(form);
		try {
			await withButton(form.querySelector("[type=submit]"), () =>
				saveBoard("music", {
					...data,
					enable: input.get("enable") === "on",
					showFloatingPlayer: input.get("float") === "on",
					floatingEntryMode: input.get("floatingEntryMode"),
					mode: input.get("mode"),
					meting_api: input.get("meting_api"),
					id: input.get("id"),
					server: input.get("server"),
					type: input.get("type"),
				}),
			);
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function renderPio(panel) {
	const file = await api("/api/admin/content/boards/pio");
	const data = file.data || {};
	const dialog = data.dialog || {};
	const body = pageHead(panel, "看板娘", file.file);
	body.innerHTML = `<form class="card" id="form">
		<label class="switch"><input name="enable" type="checkbox" ${data.enable ? "checked" : ""}> 启用</label>
		<div class="row"><div class="field"><label>位置</label><select name="position">${selectOptions([["left", "左侧"], ["right", "右侧"]], data.position || "")}</select></div><div class="field"><label>模式</label><select name="mode">${selectOptions([["static", "静止"], ["fixed", "固定"], ["draggable", "可拖动"]], data.mode || "")}</select></div><div class="field"><label>宽</label><input name="width" type="number" value="${Number(data.width || 280)}"></div><div class="field"><label>高</label><input name="height" type="number" value="${Number(data.height || 250)}"></div></div>
		<label class="switch"><input name="hiddenOnMobile" type="checkbox" ${data.hiddenOnMobile ? "checked" : ""}> 移动端隐藏</label>
		<div class="field"><label>模型，每行一个</label><textarea name="models">${esc((data.models || []).join("\n"))}</textarea></div>
		<div class="field"><label>欢迎</label><input name="welcome" value="${esc(dialog.welcome || "")}"></div>
		<div class="field"><label>首页</label><input name="home" value="${esc(dialog.home || "")}"></div>
		<div class="field"><label>关闭</label><input name="close" value="${esc(dialog.close || "")}"></div>
		<div class="field"><label>链接</label><input name="link" value="${esc(dialog.link || "")}"></div>
		<div class="field"><label>点击台词</label><textarea name="touch">${esc((dialog.touch || []).join("\n"))}</textarea></div>
		<div class="field"><label>换装台词</label><textarea name="skin">${esc((dialog.skin || []).join("\n"))}</textarea></div>
		<button class="btn primary" type="submit">保存</button></form>`;
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		const input = new FormData(form);
		try {
			await withButton(form.querySelector("[type=submit]"), () =>
				saveBoard("pio", {
					...data,
					enable: input.get("enable") === "on",
					position: input.get("position"),
					mode: input.get("mode"),
					width: Number(input.get("width") || 280),
					height: Number(input.get("height") || 250),
					hiddenOnMobile: input.get("hiddenOnMobile") === "on",
					models: lines(input.get("models")),
					dialog: {
						...dialog,
						welcome: input.get("welcome"),
						home: input.get("home"),
						close: input.get("close"),
						link: input.get("link"),
						touch: lines(input.get("touch")),
						skin: lines(input.get("skin")),
					},
				}),
			);
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function renderFeatures(panel) {
	const file = await api("/api/admin/content/boards/features");
	const data = file.data || {};
	const keys = Object.keys(data);
	const body = pageHead(panel, "模块开关", file.file);
	body.innerHTML = `<form class="card" id="form">${keys.map((key) => `<label class="switch"><input name="${esc(key)}" type="checkbox" ${data[key] ? "checked" : ""}> ${esc(key)}</label>`).join("")}<button class="btn primary" type="submit">保存</button></form>`;
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		const input = new FormData(form);
		const next = { ...data };
		keys.forEach((key) => {
			next[key] = input.get(key) === "on";
		});
		try {
			await withButton(form.querySelector("[type=submit]"), () => saveBoard("features", next));
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function renderDevices(panel) {
	const file = await api("/api/admin/content/boards/devices");
	const data = file.data || {};
	const body = pageHead(panel, "设备", "分类仍是 JSON，避免丢掉未展示字段。");
	body.innerHTML = `<form class="card" id="form"><textarea name="categories" style="min-height:280px">${esc(JSON.stringify(data.categories || [], null, 2))}</textarea><button class="btn primary" type="submit">保存</button></form>`;
	const form = body.querySelector("#form");
	markDirty(form);
	form.onsubmit = async (event) => {
		event.preventDefault();
		try {
			const categories = JSON.parse(new FormData(form).get("categories") || "[]");
			if (!Array.isArray(categories)) throw new Error("必须是数组");
			await withButton(form.querySelector("[type=submit]"), () => saveBoard("devices", { ...data, categories }));
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

async function renderAlbums(panel) {
	const data = await api("/api/admin/albums");
	const body = pageHead(panel, "相册", "每个相册是 public/images/albums 里的一个文件夹。");
	body.innerHTML = `<form class="card" id="create"><div class="row"><div class="field"><label>文件夹名</label><input name="id" required></div><div class="field"><label>标题</label><input name="title"></div></div><button class="btn primary" type="submit">创建</button></form><div id="list"></div>`;
	(data.albums || []).forEach((album) => {
		const info = album.info || {};
		const card = document.createElement("form");
		card.className = "card";
		card.innerHTML = `<h3>${esc(info.title || album.id)}</h3><p class="muted">${esc(album.id)}</p>
			<div class="row"><div class="field"><label>标题</label><input name="title" value="${esc(info.title || "")}"></div><div class="field"><label>日期</label><input name="date" type="date" value="${esc(String(info.date || "").slice(0, 10))}"></div><div class="field"><label>地点</label><input name="location" value="${esc(info.location || "")}"></div></div>
			<div class="field"><label>排版</label><select name="layout">${selectOptions([["grid", "网格"]], info.layout || "grid")}</select></div>
			<div class="field"><label>简介</label><textarea name="description">${esc(info.description || "")}</textarea></div>
			<div class="field"><label>标签</label><input name="tags" value="${esc((info.tags || []).join(", "))}"></div>
			<div class="thumbs">${(album.photos || []).map((photo) => `<figure><img src="${esc(img(photo.url))}" alt="" referrerpolicy="no-referrer"><button class="btn danger" type="button" data-photo="${esc(photo.name)}">删除</button></figure>`).join("")}</div>
			<div class="drop">拖拽或点击添加照片<input type="file" accept="image/*" multiple hidden data-file></div>
			<div class="toolbar"><button class="btn primary" type="submit">保存信息</button><button class="btn danger" type="button" data-drop>删除相册</button></div>`;
		const drop = card.querySelector(".drop");
		drop.onclick = () => card.querySelector("[data-file]").click();
		const send = async (list) => {
			try {
				for (const picked of list) {
					const payload = new FormData();
					payload.append("file", picked);
					await api("/api/admin/albums/" + encodeURIComponent(album.id) + "/photos", { method: "POST", body: payload });
				}
				toast("照片已上传");
				open("albums");
			} catch (error) {
				toast(error.message, "err");
			}
		};
		card.querySelector("[data-file]").onchange = (event) => send([...event.target.files]);
		bindDrop(drop, (picked) => send([picked]));
		card.onsubmit = async (event) => {
			event.preventDefault();
			const input = new FormData(card);
			try {
				await withButton(card.querySelector("[type=submit]"), () =>
					api("/api/admin/albums/" + encodeURIComponent(album.id), {
						method: "PUT",
						body: {
							info: {
								title: input.get("title"),
								description: input.get("description"),
								date: input.get("date"),
								location: input.get("location"),
								tags: splitList(input.get("tags")),
								layout: input.get("layout") || info.layout || "grid",
								columns: Number(info.columns || 3),
								hidden: Boolean(info.hidden),
							},
						},
					}),
				);
				toast("已保存");
			} catch (error) {
				toast(error.message, "err");
			}
		};
		card.querySelectorAll("[data-photo]").forEach((node) => {
			node.onclick = async () => {
				if (!(await confirmBox("删除照片", node.dataset.photo))) return;
				await api(`/api/admin/albums/${encodeURIComponent(album.id)}/photos?name=${encodeURIComponent(node.dataset.photo)}`, {
					method: "DELETE",
				});
				open("albums");
			};
		});
		card.querySelector("[data-drop]").onclick = async () => {
			if (!(await confirmBox("删除相册", album.id))) return;
			await api("/api/admin/albums/" + encodeURIComponent(album.id), { method: "DELETE" });
			open("albums");
		};
		body.querySelector("#list").append(card);
	});
	body.querySelector("#create").onsubmit = async (event) => {
		event.preventDefault();
		const input = new FormData(event.target);
		try {
			await withButton(event.target.querySelector("[type=submit]"), () =>
				api("/api/admin/albums", { method: "POST", body: { id: input.get("id"), info: { title: input.get("title") } } }),
			);
			open("albums");
		} catch (error) {
			toast(error.message, "err");
		}
	};
}

if (token()) {
	api("/api/admin/me")
		.then((me) => {
			state.user = me.username;
			open("posts");
		})
		.catch(() => renderLogin());
} else {
	renderLogin();
}
