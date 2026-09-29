/**
 * pandac 博客管理台
 * - UI 对齐博客视觉变量
 * - Markdown 实时预览（marked + sanitize-html）
 * - 本地读写工作区；可选一键 git push 到 GitHub
 */
import { marked } from "/admin/vendor/marked.esm.js";
import { parse as parseYaml, stringify as stringifyYaml } from "/admin/vendor/yaml/index.js";

const REPO = "pandaC222/pandaC222.github.io";
const BRANCH = "master";
const TOKEN_KEY = "pandac_admin_gh_token";
const API = `https://api.github.com/repos/${REPO}/contents`;
const LOCAL_API = "/api/admin";
const MODE_KEY = "pandac_admin_mode"; // local | github
const DRAFT_KEY = "pandac_admin_post_draft";

function isLocalHost() {
	const h = location.hostname;
	return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}
function getMode() {
	// 已取消 GitHub 直连编辑模式：本机后台固定本地读写
	return "local";
}
function setMode(mode) {
	state.mode = "local";
	try {
		localStorage.setItem(MODE_KEY, "local");
	} catch {
		/* ignore */
	}
	void mode;
}

async function fetchGitStatus() {
	const res = await fetch(`${LOCAL_API}/git/status`, { cache: "no-store" });
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw new Error(data.error || `获取 git 状态失败 ${res.status}`);
	return data;
}

async function pushToGitHub(message) {
	const res = await fetch(`${LOCAL_API}/git/push`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ message: message || "" }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || data.ok === false) {
		throw new Error(data.error || `推送失败 ${res.status}`);
	}
	return data;
}

async function refreshPushButton() {
	const btn = document.querySelector("#push-github");
	const meta = document.querySelector("#git-meta");
	if (!btn) return;
	try {
		const st = await fetchGitStatus();
		const n = st.count || 0;
		const ahead = st.ahead || 0;
		if (n > 0) {
			btn.textContent = `推送到 GitHub（${n}）`;
			btn.disabled = false;
		} else if (ahead > 0) {
			btn.textContent = `推送到 GitHub（未推送 ${ahead}）`;
			btn.disabled = false;
		} else {
			btn.textContent = "推送到 GitHub";
			btn.disabled = false;
		}
		if (meta) {
			meta.textContent = st.branch
				? `${st.branch}${st.dirty ? " · 有未提交更改" : " · 工作区干净"}`
				: "";
		}
	} catch (e) {
		btn.textContent = "推送到 GitHub";
		if (meta) meta.textContent = e.message || "git 状态不可用";
	}
}

async function probeLocalApi() {
	try {
		const res = await fetch(`${LOCAL_API}/ping`, { cache: "no-store" });
		if (!res.ok) return false;
		const data = await res.json();
		return !!data?.ok;
	} catch {
		return false;
	}
}


function decodeGithubContent(b64) {
	const bin = atob(String(b64 || "").replace(/\n/g, ""));
	const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
	return new TextDecoder("utf-8").decode(bytes);
}

function encodeGithubContent(text) {
	const bytes = new TextEncoder().encode(String(text ?? ""));
	let bin = "";
	bytes.forEach((b) => {
		bin += String.fromCharCode(b);
	});
	return btoa(bin);
}

function missingRemoteHint(path) {
	if (state.mode === "local") return `本地找不到 ${path}`;
	return (
		"远程仓库还没有 " +
		path +
		"。原因：后台通过 GitHub API 读写，但 pandaC222/pandaC222.github.io 尚未推送博客文件。处理：在本地 E:\\AAAXM 执行 git add / commit / push 后再刷新后台。"
	);
}

function publicUrl(path) {
	if (!path) return "";
	if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
	const raw = path.startsWith("/") ? path : `/${path}`;
	// 中文文件名需要分段 encode，否则预览/前台可能 404
	return raw
		.split("/")
		.map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg)))
		.join("/")
		.replace(/%2F/gi, "/");
}
function tagsToText(v) {
	if (Array.isArray(v)) {
		return v
			.map((x) => (typeof x === "string" ? x : x?.tag || x?.line || ""))
			.filter(Boolean)
			.join(", ");
	}
	return v ? String(v) : "";
}
function textToTags(s) {
	return String(s || "")
		.split(/[,，]/)
		.map((x) => x.trim())
		.filter(Boolean);
}
function encodeBytes(bytes) {
	// 分块转二进制串，避免大图 btoa/参数栈溢出；兼容 Uint8Array
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
	const chunk = 0x2000; // 8k 参数以内更稳
	let bin = "";
	for (let i = 0; i < view.length; i += chunk) {
		const slice = view.subarray(i, i + chunk);
		// 不用 spread 大数组，逐字节拼（图片通常不大，可接受）
		let part = "";
		for (let j = 0; j < slice.length; j++) part += String.fromCharCode(slice[j]);
		bin += part;
	}
	return btoa(bin);
}
async function ghDelete(path, sha, message) {
	if (state.mode === "local") {
		const res = await fetch(`${LOCAL_API}/file?path=${encodeURIComponent(path)}`, { method: "DELETE" });
		if (!res.ok) throw new Error(`本地删除失败 ${res.status}: ${(await res.text()).slice(0, 160)}`);
		return;
	}
	const url = `${API}/${path.split("/").map(encodeURIComponent).join("/")}`;
	const res = await fetch(url, {
		method: "DELETE",
		headers: { ...headers(), "Content-Type": "application/json" },
		body: JSON.stringify({ message, sha, branch: BRANCH }),
	});
	if (!res.ok) throw new Error(`删除失败 ${res.status}`);
}
/** 二进制写入：本地走 /api/admin，远程走 GitHub Contents API */
async function ghPutBinary(path, bytesB64, message, sha) {
	if (state.mode === "local") {
		// 与 ghPut(..., binary=true) 一致：contentBase64 原样落盘
		const res = await fetch(`${LOCAL_API}/file`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				path,
				message: message || "local upload",
				contentBase64: bytesB64,
			}),
		});
		if (!res.ok) {
			throw new Error(`本地上传失败 ${res.status}: ${(await res.text()).slice(0, 200)}`);
		}
		return res.json();
	}
	const url = `${API}/${path.split("/").map(encodeURIComponent).join("/")}`;
	const body = { message, content: bytesB64, branch: BRANCH };
	if (sha) body.sha = sha;
	const res = await fetch(url, {
		method: "PUT",
		headers: { ...headers(), "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`上传失败 ${res.status}: ${(await res.text()).slice(0, 160)}`);
	return res.json();
}
async function uploadImageFile(file, folder = "uploads") {
	if (!file) throw new Error("未选择文件");
	const rawName = String(file.name || "image.bin");
	// 扩展名只保留安全 ascii；主名不用中文（Vite/部分环境对 public 中文文件名不友好）
	const extMatch = rawName.match(/(\.[a-zA-Z0-9]{1,8})$/);
	const ext = (extMatch ? extMatch[1] : ".bin").toLowerCase();
	const base = rawName
		.replace(/(\.[a-zA-Z0-9]{1,8})$/, "")
		.replace(/[^\w.\-]+/g, "_")
		.replace(/^_+|_+$/g, "")
		.slice(0, 40);
	const safe = `${base || "image"}${ext}`;
	const folderSafe = String(folder || "uploads").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
	const repoPath = `public/${folderSafe}/${Date.now()}-${safe}`;
	const buf = new Uint8Array(await file.arrayBuffer());
	if (!buf.length) throw new Error("图片文件为空");
	const existing = await ghGet(repoPath);
	const result = await ghPutBinary(
		repoPath,
		encodeBytes(buf),
		`admin: upload ${repoPath}`,
		existing?.sha,
	);
	const publicPath = repoPath.replace(/^public\//, "/");
	const sha = result?.content?.sha || result?.sha || "";
	return { publicPath, sha, repoPath };
}
// 兼容旧调用名
async function uploadImage(file, folder = "uploads") {
	return uploadImageFile(file, folder);
}
async function deleteImageByPublicPath(publicPath) {
	if (!publicPath?.startsWith("/uploads/")) {
		throw new Error("只能删除 /uploads/ 下的图片");
	}
	const repoPath = `public${publicPath}`;
	const file = await ghGet(repoPath);
	if (!file?.sha && state.mode !== "local") throw new Error("远程找不到该图片");
	if (!file && state.mode === "local") throw new Error("本地找不到该图片");
	await ghDelete(repoPath, file?.sha, `admin: delete ${repoPath}`);
}
function imageFieldHtml(id, value, { wide = false, folder = "uploads" } = {}) {
	const has = !!value;
	return `
    <div class="img-field" data-img-field="${id}" data-folder="${folder}">
      <img class="img-preview ${wide ? "wide" : ""} ${has ? "" : "hidden"}" data-role="preview" src="${escapeAttr(publicUrl(value))}" alt="预览" />
      <div class="img-empty ${wide ? "wide" : ""} ${has ? "hidden" : ""}" data-role="empty">暂无图片</div>
      <div class="img-actions">
        <button type="button" class="btn btn-primary" data-role="pick">上传图片</button>
        <button type="button" class="btn" data-role="clear">清除</button>
        <button type="button" class="btn btn-danger" data-role="delete" ${has && String(value).startsWith("/uploads/") ? "" : "disabled"}>从仓库删除</button>
        <input type="file" accept="image/*" data-role="file" />
      </div>
      <input class="img-path" type="text" data-role="path" value="${escapeAttr(value || "")}" placeholder="/uploads/... 或 https://..." />
      <span class="hint">可上传到 public/${folder}/，也可粘贴路径</span>
    </div>`;
}

function colorFieldHtml(id, value) {
	const v = value || "#4f6ef7";
	return `<div class="color-row" data-color-field="${id}">
      <input type="color" data-role="picker" value="${escapeAttr(v.startsWith("#") ? v : "#4f6ef7")}" />
      <input type="text" data-role="text" value="${escapeAttr(v)}" placeholder="#4f6ef7" />
    </div>`;
}
function bindColorField(scope, id, onChange) {
	const box = scope.querySelector(`[data-color-field="${id}"]`);
	if (!box) return;
	const picker = box.querySelector('[data-role="picker"]');
	const text = box.querySelector('[data-role="text"]');
	const emit = (v) => onChange?.(v);
	picker.addEventListener("input", () => {
		text.value = picker.value;
		emit(picker.value);
	});
	text.addEventListener("input", () => {
		const v = text.value.trim();
		if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v)) picker.value = v;
		emit(v);
	});
}

function bindImageField(scope, id, onChange) {
	const box = scope.querySelector(`[data-img-field="${id}"]`);
	if (!box) return;
	const preview = box.querySelector('[data-role="preview"]');
	const empty = box.querySelector('[data-role="empty"]');
	const pathInput = box.querySelector('[data-role="path"]');
	const fileInput = box.querySelector('[data-role="file"]');
	const folder = box.getAttribute("data-folder") || "uploads";
	const sync = (val) => {
		const v = val || "";
		pathInput.value = v;
		if (v) {
			preview.src = publicUrl(v);
			preview.classList.remove("hidden");
			empty.classList.add("hidden");
		} else {
			preview.removeAttribute("src");
			preview.classList.add("hidden");
			empty.classList.remove("hidden");
		}
		box.querySelector('[data-role="delete"]').disabled = !(v && v.startsWith("/uploads/"));
		onChange?.(v);
		// 封面变更时同步草稿，避免 Vite 因 public 文件刷新丢状态
		if (id === "cover" && (state.postMode === "new" || state.postMode === "edit")) {
			const form = collectPostFormFromDom(scope, v) || { ...state.postForm, image: v };
			state.postForm = form;
			savePostDraft({ postForm: form });
		}
	};
	const pickBtn = box.querySelector('[data-role="pick"]');
	if (pickBtn) {
		pickBtn.setAttribute("type", "button");
		pickBtn.onclick = (ev) => {
			ev?.preventDefault?.();
			ev?.stopPropagation?.();
			if (state.postMode === "new" || state.postMode === "edit") {
				const form = collectPostFormFromDom(scope, pathInput.value.trim()) || state.postForm;
				state.postForm = form;
				savePostDraft({
					postForm: form,
					postMode: state.postMode,
					postPath: state.postPath,
				});
			}
			fileInput.click();
		};
	}
	fileInput.onchange = async () => {
		const file = fileInput.files?.[0];
		if (!file) return;
		try {
			if (state.postMode === "new" || state.postMode === "edit") {
				const form = collectPostFormFromDom(scope, pathInput.value.trim()) || state.postForm;
				state.postForm = form;
				savePostDraft({ postForm: form });
			}
			setStatus(`上传 ${file.name}…`);
			const up = await uploadImageFile(file, folder);
			sync(up.publicPath);
			setStatus(`已上传 ${up.publicPath}`, "ok");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		} finally {
			fileInput.value = "";
		}
	};
	const clearBtn = box.querySelector('[data-role="clear"]');
	if (clearBtn) {
		clearBtn.setAttribute("type", "button");
		clearBtn.onclick = (ev) => {
			ev?.preventDefault?.();
			sync("");
			setStatus("已清除图片路径", "ok");
		};
	}
	const delBtn = box.querySelector('[data-role="delete"]');
	if (delBtn) {
		delBtn.setAttribute("type", "button");
		delBtn.onclick = async (ev) => {
			ev?.preventDefault?.();
			const v = pathInput.value.trim();
			if (!v || !confirm(`确定删除 ${v}？`)) return;
			try {
				setStatus("删除中…");
				await deleteImageByPublicPath(v);
				sync("");
				setStatus("图片已删除", "ok");
			} catch (e) {
				setStatus(e.message || String(e), "err");
			}
		};
	}
	pathInput.addEventListener("change", () => sync(pathInput.value.trim()));
	pathInput.addEventListener("input", () => {
		const v = pathInput.value.trim();
		if (v) {
			preview.src = publicUrl(v);
			preview.classList.remove("hidden");
			empty.classList.add("hidden");
		}
	});
}

function multiImageFieldHtml(id, values, folder = "uploads/diary") {
	const list = Array.isArray(values) ? values.filter(Boolean) : [];
	const thumbs = list
		.map(
			(src, i) => `
      <div class="multi-img-item" data-idx="${i}">
        <img src="${escapeAttr(publicUrl(src))}" alt="img" />
        <button type="button" class="btn btn-danger multi-img-del" data-del-idx="${i}">删除</button>
        <input type="text" class="img-path" data-path-idx="${i}" value="${escapeAttr(src)}" placeholder="/uploads/..." />
      </div>`,
		)
		.join("");
	return `
    <div class="multi-img-field" data-multi-img="${id}" data-folder="${folder}">
      <div class="multi-img-list">${thumbs || '<div class="img-empty">暂无图片</div>'}</div>
      <div class="img-actions" style="margin-top:0.5rem">
        <button type="button" class="btn btn-primary" data-role="add">上传图片</button>
        <input type="file" accept="image/*" multiple data-role="file" style="display:none" />
      </div>
      <span class="hint">可多选上传；也可改路径。保存后前台日记卡片会显示图片。</span>
    </div>`;
}

function bindMultiImageField(scope, id, getList, setList) {
	const box = scope.querySelector(`[data-multi-img="${id}"]`);
	if (!box) return;
	const folder = box.getAttribute("data-folder") || "uploads/diary";
	const fileInput = box.querySelector('[data-role="file"]');
	const addBtn = box.querySelector('[data-role="add"]');

	const repaint = () => {
		const list = getList() || [];
		const listBox = box.querySelector(".multi-img-list");
		if (!list.length) {
			listBox.innerHTML = '<div class="img-empty">暂无图片</div>';
		} else {
			listBox.innerHTML = list
				.map(
					(src, i) => `
        <div class="multi-img-item" data-idx="${i}">
          <img src="${escapeAttr(publicUrl(src))}" alt="img" />
          <button type="button" class="btn btn-danger multi-img-del" data-del-idx="${i}">删除</button>
          <input type="text" class="img-path" data-path-idx="${i}" value="${escapeAttr(src)}" placeholder="/uploads/..." />
        </div>`,
				)
				.join("");
		}
		listBox.querySelectorAll("[data-del-idx]").forEach((btn) => {
			btn.onclick = () => {
				const i = Number(btn.getAttribute("data-del-idx"));
				const next = [...(getList() || [])];
				next.splice(i, 1);
				setList(next);
				repaint();
			};
		});
		listBox.querySelectorAll("[data-path-idx]").forEach((input) => {
			input.onchange = () => {
				const i = Number(input.getAttribute("data-path-idx"));
				const next = [...(getList() || [])];
				next[i] = input.value.trim();
				setList(next.filter(Boolean));
				repaint();
			};
		});
	};

	if (addBtn && fileInput) {
		addBtn.onclick = (ev) => {
			ev?.preventDefault?.();
			fileInput.click();
		};
		fileInput.onchange = async () => {
			const files = [...(fileInput.files || [])];
			if (!files.length) return;
			try {
				setStatus(`上传 ${files.length} 张图片…`);
				const uploaded = [];
				for (const file of files) {
					const up = await uploadImageFile(file, folder);
					uploaded.push(up.publicPath);
				}
				setList([...(getList() || []), ...uploaded]);
				repaint();
				setStatus(`已上传 ${uploaded.length} 张`, "ok");
			} catch (e) {
				setStatus(e.message || String(e), "err");
			} finally {
				fileInput.value = "";
			}
		};
	}
	repaint();
}



const MODULES = [
	{
		group: "内容",
		items: [
			{ id: "posts", label: "写文章" },
			{ id: "about", label: "关于我" },
		],
	},
	{
		group: "站点",
		items: [
			{ id: "profile", label: "个人资料" },
			{ id: "announcement", label: "公告" },
			{ id: "banner", label: "首页横幅" },
			{ id: "music", label: "音乐播放器" },
			{ id: "pio", label: "看板娘" },
		],
	},
	{
		group: "功能模块",
		items: [
			{ id: "features", label: "模块开关" },
			{ id: "friends", label: "友链" },
			{ id: "projects", label: "项目" },
			{ id: "skills", label: "技能" },
			{ id: "timeline", label: "时间线" },
			{ id: "diary", label: "日记" },
			{ id: "anime", label: "番剧" },
			{ id: "albums", label: "相册" },
			{ id: "devices", label: "设备" },
		],
	},
];

const FILE_MAP = {
	profile: "src/content/admin/profile.yml",
	announcement: "src/content/admin/announcement.yml",
	banner: "src/content/admin/banner.yml",
	features: "src/content/admin/features.yml",
	friends: "src/content/admin/friends.yml",
	projects: "src/content/admin/projects.yml",
	skills: "src/content/admin/skills.yml",
	timeline: "src/content/admin/timeline.yml",
	diary: "src/content/admin/diary.yml",
	anime: "src/content/admin/anime.yml",
	devices: "src/content/admin/devices.yml",
	albums: "src/content/admin/albums.yml",
	music: "src/content/admin/music.yml",
	pio: "src/content/admin/pio.yml",
	about: "src/content/spec/about.md",
};

const FEATURE_LABELS = {
	anime: "番剧",
	diary: "日记",
	friends: "友链",
	projects: "项目",
	skills: "技能",
	timeline: "时间线",
	albums: "相册",
	devices: "设备",
};

const state = {
	token: localStorage.getItem(TOKEN_KEY) || "",
	user: null,
	avatarUrl: "/uploads/avatar.webp",
	remoteReady: null,
	module: "posts",
	status: "",
	statusType: "",
	// posts
	posts: [],
	postMode: "list", // list | edit | new
	postPath: "",
	postSha: "",
	postForm: emptyPostForm(),
	metaOpen: false,
	previewOpen: true,
	albums: [],
	albumMode: "list",
	albumCurrent: null,
	// yaml modules
	yamlCache: {}, // path -> { sha, data, raw }
	// about
	aboutBody: "",
	aboutSha: "",
};

/* restore post draft
 * 不要仅因草稿里 postMode=edit 就强制进编辑页。
 * 否则在其它模块保存触发整页重载时，会“弹回”上次编辑的文章。
 */
(() => {
	const d = loadPostDraft();
	if (!d) return;
	if (d.module) state.module = d.module;
	if (d.postForm && typeof d.postForm === "object") {
		state.postForm = { ...emptyPostForm(), ...d.postForm };
	}
	if (d.postPath) state.postPath = d.postPath || "";
	if (d.postSha) state.postSha = d.postSha || "";
	if (typeof d.metaOpen === "boolean") state.metaOpen = d.metaOpen;
	if (typeof d.previewOpen === "boolean") state.previewOpen = d.previewOpen;
	if (d.resumeEdit && (d.postMode === "new" || d.postMode === "edit") && state.module === "posts") {
		state.postMode = d.postMode;
	} else if (state.module === "posts") {
		state.postMode = "list";
	}
})();



function savePostDraft(patch = {}) {
	try {
		const postMode = patch.postMode !== undefined ? patch.postMode : state.postMode;
		const module = patch.module !== undefined ? patch.module : state.module;
		const resumeEdit =
			patch.resumeEdit !== undefined
				? !!patch.resumeEdit
				: module === "posts" && (postMode === "edit" || postMode === "new");
		const draft = {
			module,
			postMode,
			postPath: patch.postPath !== undefined ? patch.postPath : state.postPath,
			postSha: patch.postSha !== undefined ? patch.postSha : state.postSha,
			postForm: patch.postForm !== undefined ? patch.postForm : state.postForm,
			metaOpen: patch.metaOpen !== undefined ? patch.metaOpen : state.metaOpen,
			previewOpen: patch.previewOpen !== undefined ? patch.previewOpen : state.previewOpen,
			resumeEdit,
			ts: Date.now(),
		};
		sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
	} catch {
		/* ignore quota */
	}
}
function loadPostDraft() {
	try {
		const raw = sessionStorage.getItem(DRAFT_KEY);
		if (!raw) return null;
		const d = JSON.parse(raw);
		if (!d || typeof d !== "object") return null;
		if (d.ts && Date.now() - d.ts > 12 * 60 * 60 * 1000) {
			sessionStorage.removeItem(DRAFT_KEY);
			return null;
		}
		return d;
	} catch {
		return null;
	}
}
function clearPostDraft() {
	try {
		sessionStorage.removeItem(DRAFT_KEY);
	} catch {
		/* ignore */
	}
}
function collectPostFormFromDom(scope, coverPath) {
	if (!scope) return null;
	const q = (sel) => scope.querySelector(sel);
	if (!q("#f-title") && !q("#f-body")) return null;
	return {
		title: q("#f-title")?.value?.trim?.() ?? state.postForm.title,
		published: q("#f-published")?.value ? fromDateTimeLocalValue(q("#f-published").value) : state.postForm.published,
		category: q("#f-category")?.value?.trim?.() ?? state.postForm.category,
		tags: q("#f-tags")?.value ?? state.postForm.tags,
		description: q("#f-desc")?.value?.trim?.() ?? state.postForm.description,
		image: coverPath !== undefined ? coverPath : state.postForm.image,
		pinned: !!q("#f-pinned")?.checked,
		draft: !!q("#f-draft")?.checked,
		priority: state.postForm.priority,
		body: q("#f-body")?.value ?? state.postForm.body,
	};
}

function pad2(n) {
	return String(n).padStart(2, "0");
}
/** 站点时区偏移（小时），与 src/config.ts SITE_TIMEZONE 保持一致 */
const SITE_TZ_OFFSET_HOURS = 8;
function siteTzSuffix() {
	const sign = SITE_TZ_OFFSET_HOURS >= 0 ? "+" : "-";
	const abs = Math.abs(SITE_TZ_OFFSET_HOURS);
	return `${sign}${pad2(abs)}:00`;
}
/** 本地当前日期 YYYY-MM-DD（兼容旧调用） */
function todayLocal() {
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
/** 本地当前日期时间，供 datetime-local 使用：YYYY-MM-DDTHH:mm */
function nowLocalDateTime() {
	const d = new Date();
	return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
/** 任意日期值 -> datetime-local 输入值（按站点时区墙钟显示） */
function toDateTimeLocalValue(v) {
	if (v == null || v === "") return nowLocalDateTime();
	const s = String(v).trim();
	// 无时区或已是本地墙钟：直接取前 16 位
	if (
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) &&
		!/([zZ]|[+-]\d{2}:?\d{2})$/.test(s.slice(0, 25))
	) {
		return s.slice(0, 16);
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00`;
	if (/^\d{4}-\d{2}-\d{2}[ ]\d{2}:\d{2}/.test(s)) return s.replace(" ", "T").slice(0, 16);
	// 带时区 / Date：换算到站点时区墙钟
	const d = new Date(s);
	if (Number.isNaN(d.getTime())) return nowLocalDateTime();
	const shifted = new Date(d.getTime() + SITE_TZ_OFFSET_HOURS * 3600 * 1000);
	return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}T${pad2(shifted.getUTCHours())}:${pad2(shifted.getUTCMinutes())}`;
}
/** datetime-local 值 -> 写入 YAML 的本地时间（显式 +08:00，避免被当成 UTC） */
function fromDateTimeLocalValue(v) {
	const tz = siteTzSuffix();
	if (!v) return `${nowLocalDateTime()}:00${tz}`;
	const s = String(v).trim();
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) return `${s}:00${tz}`;
	if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)) {
		const head = s.slice(0, 19);
		if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) return s;
		return `${head}${tz}`;
	}
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s}T00:00:00${tz}`;
	return s;
}


function emptyPostForm() {
	return {
		title: "",
		published: nowLocalDateTime(),
		description: "",
		image: "",
		category: "",
		tags: "",
		pinned: false,
		draft: false,
		priority: "",
		body: "",
	};
}

function el(html) {
	const t = document.createElement("template");
	t.innerHTML = html.trim();
	return t.content.firstElementChild;
}


function saveLabel(action = "保存") {
	return `${action}到本地`;
}

function ensureToastHost() {
	let host = document.getElementById("save-toast");
	if (host) return host;
	host = document.createElement("div");
	host.id = "save-toast";
	host.className = "save-toast";
	host.innerHTML = `
      <h4 id="toast-title">已更新</h4>
      <p id="toast-desc">内容已写入本地，可在前台查看。</p>
      <div class="toast-actions">
        <a class="btn btn-primary" id="toast-open" href="/" target="_blank" rel="noopener">点击查看前台</a>
        <button type="button" class="btn" id="toast-close">关闭</button>
      </div>`;
	document.body.appendChild(host);
	host.querySelector("#toast-close").onclick = () => hideSaveToast();
	return host;
}

let toastTimer = null;
function hideSaveToast() {
	const host = document.getElementById("save-toast");
	if (host) host.classList.remove("show");
	if (toastTimer) {
		clearTimeout(toastTimer);
		toastTimer = null;
	}
}


function bumpFrontPreview() {
	// 通知其它标签页的前台刷新（同浏览器）
	// 文章 Content Layer 同步可能稍慢，延迟写入避免前台过早 reload 读到旧 store
	try {
		const key = "pandac_admin_content_bump";
		const fire = () => {
			try {
				localStorage.setItem(key, String(Date.now()));
			} catch {
				/* ignore */
			}
		};
		// 立即一次 + 稍后一次，覆盖竞态
		fire();
		setTimeout(fire, 400);
		setTimeout(fire, 900);
	} catch {
		/* ignore */
	}
}

function showSaveToast(message = "", type = "ok") {
	const host = ensureToastHost();
	const title = host.querySelector("#toast-title");
	const desc = host.querySelector("#toast-desc");
	const open = host.querySelector("#toast-open");
	host.classList.toggle("err", type === "err");
	if (type === "err") {
		title.textContent = "保存失败";
		desc.textContent = message || "请查看状态栏错误信息";
		open.href = "#";
		open.textContent = "知道了";
		open.onclick = (e) => {
			e.preventDefault();
			hideSaveToast();
		};
	} else if (state.mode === "local") {
		title.textContent = "已保存到本地";
		desc.textContent =
			message ||
			"文件已写入。已打开的前台页会自动刷新；也可点「打开文章页」。不必清缓存。";
		open.href = "/";
		open.target = "_blank";
		open.textContent = "打开前台查看";
		open.onclick = null;
	} else {
		title.textContent = "已提交 GitHub";
		desc.textContent = message || "已保存到仓库。打开前台并等待构建完成后刷新。";
		open.href = "/";
		open.target = "_blank";
		open.textContent = "打开前台";
		open.onclick = null;
	}
	host.classList.add("show");
	if (toastTimer) clearTimeout(toastTimer);
	toastTimer = setTimeout(() => hideSaveToast(), type === "err" ? 12000 : 10000);
}

function setStatus(msg, type = "") {
	state.status = msg;
	state.statusType = type;
	const node = document.querySelector("#status");
	if (node) {
		node.textContent = msg;
		node.className = `status ${type}`;
	}
}

function headers() {
	return {
		Accept: "application/vnd.github+json",
		Authorization: `Bearer ${state.token}`,
		"X-GitHub-Api-Version": "2022-11-28",
	};
}

async function ghGet(path) {
	if (state.mode === "local") {
		const res = await fetch(`${LOCAL_API}/file?path=${encodeURIComponent(path)}`, { cache: "no-store" });
		if (res.status === 404) return null;
		if (!res.ok) throw new Error(`本地读取失败 ${res.status}`);
		return res.json();
	}
	const url = `${API}/${path.split("/").map(encodeURIComponent).join("/")}?ref=${BRANCH}`;
	const res = await fetch(url, { headers: headers() });
	if (res.status === 404) return null;
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`读取失败 ${res.status}: ${t}`);
	}
	return res.json();
}

async function ghPut(path, content, message, sha, binary = false) {
	if (state.mode === "local") {
		const payload = { path, message: message || "local save" };
		if (binary) payload.contentBase64 = content;
		else payload.content = content;
		const res = await fetch(`${LOCAL_API}/file`, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		const rawText = await res.text();
		let data = null;
		try {
			data = rawText ? JSON.parse(rawText) : null;
		} catch {
			data = null;
		}
		if (!res.ok) {
			const detail = (data && (data.error || data.message)) || rawText || "";
			throw new Error(`本地保存失败 ${res.status}: ${String(detail).slice(0, 220)}`);
		}
		// 回读确认真正落盘（避免“接口 200 但文件没写上”的假成功）
		try {
			const check = await ghGet(path);
			if (!check) throw new Error("写入后回读为空");
		} catch (e) {
			throw new Error(`本地保存后校验失败: ${e.message || e}`);
		}
		return data || { content: { path, sha: "" } };
	}
	const url = `${API}/${path.split("/").map(encodeURIComponent).join("/")}`;
	const body = {
		message,
		content: binary ? content : encodeGithubContent(content),
		branch: BRANCH,
	};
	if (sha) body.sha = sha;
	const res = await fetch(url, {
		method: "PUT",
		headers: { ...headers(), "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	if (!res.ok) {
		const t = await res.text();
		throw new Error(`保存失败 ${res.status}: ${t}`);
	}
	return res.json();
}

async function ghListPosts() {
	if (state.mode === "local") {
		const res = await fetch(`${LOCAL_API}/list?path=${encodeURIComponent("src/content/posts")}`, { cache: "no-store" });
		if (!res.ok) throw new Error(`本地列出文章失败 ${res.status}`);
		const data = await res.json();
		if (!Array.isArray(data)) throw new Error("本地列出文章返回异常");
		return data
			.filter((f) => f.type === "file" && f.name.endsWith(".md"))
			.map((f) => ({
				name: f.name,
				path: f.path,
				sha: f.sha,
				size: f.size || 0,
				mtimeMs: f.mtimeMs || 0,
			}))
			.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
	}
	const url = `${API}/src/content/posts?ref=${BRANCH}`;
	const res = await fetch(url, { headers: headers() });
	if (res.status === 404) throw new Error(missingRemoteHint("src/content/posts"));
	if (!res.ok) throw new Error(`列出文章失败 ${res.status}`);
	const data = await res.json();
	if (!Array.isArray(data)) throw new Error(missingRemoteHint("src/content/posts"));
	return data
		.filter((f) => f.type === "file" && f.name.endsWith(".md"))
		.map((f) => ({
			name: f.name,
			path: f.path,
			sha: f.sha,
			size: f.size || 0,
			mtimeMs: 0,
		}))
		.sort((a, b) => a.name.localeCompare(b.name, "zh"));
}

function parseFrontmatter(md) {
	const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { data: {}, body: md };
	let data = {};
	try {
		data = parseYaml(m[1]) || {};
	} catch {
		data = {};
	}
	return { data, body: m[2] || "" };
}

function buildFrontmatter(form) {
	const data = {
		title: form.title || "未命名",
		published: fromDateTimeLocalValue(form.published || nowLocalDateTime()),
	};
	if (form.description) data.description = form.description;
	if (form.image) data.image = form.image;
	if (form.category) data.category = form.category;
	const tags = String(form.tags || "")
		.split(/[,，]/)
		.map((s) => s.trim())
		.filter(Boolean);
	if (tags.length) data.tags = tags;
	if (form.pinned) data.pinned = true;
	// 显式写出 draft：true 前台隐藏；false 正常发布
	data.draft = !!form.draft;
	if (form.priority !== "" && form.priority != null && form.priority !== undefined) {
		const n = Number(form.priority);
		if (!Number.isNaN(n)) data.priority = n;
	}
	return `---
${stringifyYaml(data).trim()}
---

${form.body || ""}
`;
}



function renderMarkdown(src) {
	const html = marked.parse(src || "", { async: false, gfm: true, breaks: true });
	// 轻量消毒：去掉 script
	return String(html).replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function postPublicUrl(repoPathOrTitle) {
	// src/content/posts/xxx.md -> /posts/xxx/ （站点要求尾斜杠）
	let slug = String(repoPathOrTitle || "").replace(/\\/g, "/");
	if (slug.includes("/")) slug = slug.split("/").pop() || slug;
	slug = slug.replace(/\.md$/i, "");
	const parts = slug.split("/").map((s) => encodeURIComponent(s));
	return "/posts/" + parts.join("/") + "/";
}

function slugify(title) {
	const s = String(title || "post")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, "-")
		.replace(/[^\w一-鿿-]+/g, "")
		.replace(/-+/g, "-")
		.replace(/^-|-$/g, "");
	return s || `post-${Date.now()}`;
}

async function loadYamlModule(id) {
	const path = FILE_MAP[id];
	if (!path) return null;
	if (state.yamlCache[path]?.data) return state.yamlCache[path];
	const file = await ghGet(path);
	if (!file) throw new Error(missingRemoteHint(path));
	if (!file.content) throw new Error(missingRemoteHint(path));
	const raw = decodeGithubContent(file.content);
	const data = parseYaml(raw) || {};
	state.yamlCache[path] = { sha: file.sha, raw, data };
	return state.yamlCache[path];
}

async function saveYamlModule(id, data, message) {
	const path = FILE_MAP[id];
	const cached = state.yamlCache[path] || (await loadYamlModule(id));
	const content = stringifyYaml(data);
	const result = await ghPut(path, content, message, cached.sha);
	state.yamlCache[path] = {
		sha: result.content?.sha || result?.sha || cached.sha,
		raw: content,
		data,
	};
	// 保存非文章模块时，避免草稿把下次启动带回文章编辑页
	savePostDraft({
		module: state.module,
		resumeEdit: false,
		postMode: state.module === "posts" ? state.postMode : "list",
	});
}

function root() {
	return document.getElementById("admin-root");
}

async function syncAvatarFromRemote() {
	try {
		const file = await ghGet(FILE_MAP.profile);
		if (!file?.content) return;
		const raw = decodeGithubContent(file.content);
		const data = parseYaml(raw) || {};
		if (data.avatar) {
			state.avatarUrl = data.avatar;
			state.yamlCache[FILE_MAP.profile] = { sha: file.sha, raw, data };
		}
	} catch {
		/* ignore until remote ready */
	}
}

async function checkRemoteReady() {
	const probe = await ghGet(FILE_MAP.profile);
	state.remoteReady = !!probe?.content;
	return state.remoteReady;
}

function remoteBannerHtml() {
	if (state.remoteReady !== false) return "";
	return `
      <div class="card" style="border-color:#f59e0b;margin-bottom:1rem">
        <h2 style="margin-top:0">远程仓库还没有博客文件</h2>
        <p class="desc" style="margin:0">
          后台通过 GitHub API 读写 <code>${REPO}</code>，但远程目前几乎是空的，所以模块会 404 / 文件不存在。<br/>
          请先把本地 <code>E:\\AAAXM</code> 的代码 <strong>commit + push</strong> 到 GitHub，再刷新本页。
        </p>
      </div>`;
}

function renderLogin() {
	// 已废弃：仅本地模式
	bootLocal();
}

function shell() {
	const groups = MODULES.map((g) => {
		const items = g.items
			.map(
				(it) => `
        <button class="nav-item ${state.module === it.id ? "active" : ""}" data-mod="${it.id}">
          <span>${it.label}</span>
        </button>`,
			)
			.join("");
		return `<div class="nav-group"><h3>${g.group}</h3>${items}</div>`;
	}).join("");

	return el(`
    <div class="app">
      <header class="header">
        <div class="brand">
          <img src="${state.avatarUrl || "/uploads/avatar.webp"}" alt="avatar" id="brand-avatar" />
          <span>管理后台 · pandac <small id="mode-badge" style="font-weight:500;opacity:.8"></small></span>
        </div>
        <div class="header-actions">
          <span class="status ${state.statusType}" id="status">${state.status || (state.user ? `已登录：${state.user.login}` : "")}</span>
          <span class="hint" id="git-meta" style="margin-right:0.4rem"></span>
          <button type="button" class="btn btn-primary" id="push-github" title="把本地内容变更 commit 并 push 到 GitHub">推送到 GitHub</button>
          <a class="btn" href="/" target="_blank">前台</a>
          <button class="btn" id="logout">退出</button>
        </div>
      </header>
      <aside class="sidebar">${groups}</aside>
      <main class="main" id="main"></main>
    </div>
  `);
}

async function renderApp() {
	const r0 = root();
	if (r0) r0.dataset.ready = "1";
	root().innerHTML = "";
	const app = shell();
	root().appendChild(app);
	const badge = app.querySelector("#mode-badge");
	if (badge) badge.textContent = "· 本地模式";

	app.querySelector("#logout").onclick = () => {
		localStorage.removeItem(TOKEN_KEY);
		localStorage.removeItem(MODE_KEY);
		state.token = "";
		state.user = null;
		state.mode = "local";
		state.yamlCache = {};
		hideSaveToast?.();
		// 本地模式无登录页：重新探测 API
		bootLocal();
	};

	const btnPush = app.querySelector("#push-github");
	if (btnPush) {
		btnPush.onclick = async () => {
			try {
				btnPush.disabled = true;
				const old = btnPush.textContent;
				btnPush.textContent = "推送中…";
				setStatus("正在提交并推送到 GitHub…");
				const result = await pushToGitHub();
				if (result.noop) {
					setStatus(result.message || "没有可推送的内容变更", "ok");
					showSaveToast(result.message || "没有可推送的内容变更", "ok");
				} else {
					setStatus(result.message || "已推送到 GitHub", "ok");
					showSaveToast((result.message || "已推送到 GitHub。请等1-2分钟后打开正式站并 Ctrl+F5") , "ok");
						const toastOpen = document.querySelector("#toast-open");
						if (toastOpen) { toastOpen.href = "https://github.com/pandaC222/pandaC222.github.io/actions"; toastOpen.textContent = "查看构建进度"; toastOpen.target = "_blank"; }
				}
				btnPush.textContent = old;
				btnPush.disabled = false;
				await refreshPushButton();
			} catch (e) {
				const msg = e?.message || String(e);
				setStatus(msg, "err");
				showSaveToast(msg, "err");
				btnPush.disabled = false;
				btnPush.textContent = "推送到 GitHub";
			}
		};
		refreshPushButton();
	}

	app.querySelectorAll("[data-mod]").forEach((btn) => {
		btn.onclick = async () => {
			const next = btn.getAttribute("data-mod");
			state.module = next;
			// 离开写文章时，不要把“正在编辑”草稿当成下次启动入口
			if (next === "posts") {
				state.postMode = "list";
				savePostDraft({ module: "posts", postMode: "list", resumeEdit: false });
			} else {
				savePostDraft({ module: next, resumeEdit: false });
			}
			await renderApp();
		};
	});
	await renderModule(app.querySelector("#main"));
}

async function bootLocal() {
	try {
		state.mode = "local";
		setMode("local");
		if (!isLocalHost()) {
			const rootEl = document.getElementById("admin-root");
			if (rootEl) {
				rootEl.dataset.ready = "1";
				rootEl.innerHTML = `
				<div class="admin-gate" style="max-width:720px;margin:3rem auto;padding:2rem;font-family:system-ui,sans-serif;line-height:1.7">
					<h1 style="margin:0 0 0.75rem;font-size:1.5rem">管理后台仅支持本地使用</h1>
					<p style="color:#475569;margin:0 0 1rem">
						线上是 <b>GitHub Pages 静态站</b>，不能在浏览器里直接改仓库文件，因此这里无法登录编辑。
					</p>
					<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:1rem 1.1rem;margin:0 0 1rem">
						<p style="margin:0 0 0.5rem"><b>正确用法：</b></p>
						<ol style="margin:0;padding-left:1.2rem">
							<li>在本机打开仓库目录</li>
							<li>执行 <code>pnpm install</code>（首次）和 <code>pnpm dev</code></li>
							<li>浏览器打开 <code>http://localhost:4321/admin/</code></li>
							<li>本地修改并保存，确认前台效果</li>
							<li>点「推送到 GitHub」或手动 push，等待 Pages 构建</li>
						</ol>
					</div>
					<p style="margin:0 0 1rem">
						<a href="/" style="color:#4f6ef7">返回博客首页</a>
					</p>
					<p style="margin:0;color:#94a3b8;font-size:0.9rem">仓库：pandaC222/pandaC222.github.io</p>
				</div>`;
			}
			return;
		}
		const ok = await probeLocalApi();
		if (!ok) {
			const rootEl = document.getElementById("admin-root");
			if (rootEl) {
				rootEl.dataset.ready = "1";
				rootEl.innerHTML =
					'<div style="padding:2rem;font-family:system-ui"><h2>本地 API 不可用</h2><p>请在本机仓库目录执行 <code>pnpm dev</code> 后访问 <code>http://localhost:4321/admin/</code>。</p></div>';
			}
			return;
		}
		state.token = "local";
		state.user = { login: "本地模式" };
		state.remoteReady = true;
		try {
			const file = await ghGet(FILE_MAP.profile);
			if (file?.content) {
				const raw = decodeGithubContent(file.content);
				const data = parseYaml(raw) || {};
				if (data.avatar) state.avatarUrl = data.avatar;
				state.yamlCache[FILE_MAP.profile] = { sha: file.sha, raw, data };
			}
		} catch {}
		await renderApp();
	} catch (e) {
		const rootEl = document.getElementById("admin-root");
		if (rootEl) {
			rootEl.dataset.ready = "1";
			rootEl.innerHTML = `<div style="padding:2rem;font-family:system-ui"><h2>管理台启动失败</h2><pre style="white-space:pre-wrap;color:#b91c1c">${String((e && e.stack) || e)}</pre></div>`;
		}
		console.error(e);
	}
}

async function renderModule(main) {
	main.innerHTML = `${remoteBannerHtml()}<div class="card"><p class="desc">加载中…</p></div>`;
	try {
		if (state.module === "posts") await renderPosts(main);
		else if (state.module === "about") await renderAbout(main);
		else if (state.module === "features") await renderFeatures(main);
		else if (state.module === "profile") await renderProfile(main);
		else if (state.module === "announcement") await renderAnnouncement(main);
		else if (state.module === "banner") await renderBanner(main);
		else if (state.module === "music") await renderMusic(main);
		else if (state.module === "pio") await renderPio(main);
		else if (state.module === "friends") await renderFriends(main);
		else if (state.module === "projects") await renderItemList(main, "projects", "项目", "items", projectFields);
		else if (state.module === "skills") await renderItemList(main, "skills", "技能", "items", skillFields);
		else if (state.module === "timeline") await renderItemList(main, "timeline", "时间线", "items", timelineFields);
		else if (state.module === "diary") await renderItemList(main, "diary", "日记", "items", diaryFields);
		else if (state.module === "anime") await renderAnime(main);
		else if (state.module === "albums") await renderAlbums(main);
		else if (state.module === "devices") await renderDevices(main);
		else main.innerHTML = `<div class="card"><p>未知模块</p></div>`;
	} catch (e) {
		main.innerHTML = `${remoteBannerHtml()}<div class="card"><p class="status err">${escapeText(e.message || String(e))}</p><p class="desc">若提示文件不存在，请先 push 到 GitHub（${REPO}@${BRANCH}）。</p></div>`;
	}
}

/* -------------------- Posts -------------------- */
async function renderPosts(main) {
	if (state.postMode === "list") {
		setStatus("加载文章列表…");
		state.posts = await ghListPosts();
		setStatus(`共 ${state.posts.length} 篇文章`, "ok");
		main.innerHTML = "";
		const card = el(`
      <div class="card">
        <h2>写文章</h2>
        <p class="desc">正文默认放大。草稿开启后前台不显示；新建日期默认今天。</p>
        <div class="toolbar">
          <button type="button" class="btn btn-primary" id="new-post">新建文章</button>
          <button type="button" class="btn" id="reload-posts">刷新列表</button>
        </div>
        <div class="list" id="post-list"></div>
      </div>
    `);
		main.appendChild(card);
		const list = card.querySelector("#post-list");
		if (!state.posts.length) {
			list.innerHTML = `<div class="empty">暂无文章</div>`;
		} else {
			const fmtTime = (ms) => {
				if (!ms) return "";
				try {
					const d = new Date(ms);
					const p = (n) => String(n).padStart(2, "0");
					return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
				} catch {
					return "";
				}
			};
			state.posts.forEach((p) => {
				const when = fmtTime(p.mtimeMs);
				const item = el(`
          <div class="list-item">
            <div>
              <strong>${escapeText(p.name)}</strong>
              <span>${escapeText(p.path)}${when ? ` · 修改 ${when}` : ""}</span>
            </div>
            <div style="display:flex;gap:0.4rem;flex-shrink:0">
              <button type="button" class="btn" data-role="edit">编辑</button>
              <button type="button" class="btn btn-danger" data-role="del">删除</button>
            </div>
          </div>
        `);
				item.querySelector('[data-role="edit"]').onclick = async () => {
					await openPost(p.path, p.sha);
				};
				item.querySelector('[data-role="del"]').onclick = async () => {
					if (!confirm("确定删除文章？\n" + p.path + "\n此操作不可恢复。")) return;
					try {
						setStatus(`删除 ${p.name}…`);
						await ghDelete(p.path, p.sha, `admin: delete ${p.path}`);
						if (state.postPath === p.path) {
							state.postMode = "list";
							state.postPath = "";
							state.postSha = "";
							state.postForm = emptyPostForm();
							clearPostDraft();
						}
						setStatus(`已删除 ${p.name}`, "ok");
						showSaveToast(`已删除 ${p.path}`, "ok");
						bumpFrontPreview();
			refreshPushButton?.();
						await renderPosts(main);
					} catch (e) {
						const msg = e?.message || String(e);
						setStatus(msg, "err");
						showSaveToast(msg, "err");
					}
				};
				list.appendChild(item);
			});
		}
		card.querySelector("#new-post").onclick = () => {
			state.postMode = "new";
			state.postPath = "";
			state.postSha = "";
			state.postForm = emptyPostForm();
			state.postForm.published = nowLocalDateTime();
			state.postForm.published = nowLocalDateTime();
			state.metaOpen = true;
			savePostDraft({
				module: "posts",
				postMode: "new",
				postPath: "",
				postSha: "",
				postForm: state.postForm,
				resumeEdit: true,
			});
			renderPosts(main);
		};
		card.querySelector("#reload-posts").onclick = () => renderPosts(main);
		return;
	}

	// edit / new — 元信息/预览可折叠，正文放大，1:1 预览
	const form = state.postForm;
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const wrap = el(`
    <div class="post-workspace">
      <div class="card">
        <div class="toolbar">
          <button type="button" class="btn" id="back-list">← 返回列表</button>
          <button type="button" class="btn btn-primary" id="save-post">${saveLabel("保存")}</button>
          <button type="button" class="btn" id="insert-image" title="上传图片并插入到正文光标处">插入图片</button>
          <input type="file" id="insert-image-file" accept="image/*" style="display:none" />
          <button type="button" class="btn" id="toggle-meta">${state.metaOpen ? "收起标题信息" : "展开标题信息"}</button>
          <button type="button" class="btn" id="toggle-preview">${state.previewOpen ? "收起预览" : "展开预览"}</button>
          <span class="status">${state.postPath ? escapeText(state.postPath) : "新文章"}</span>
        </div>

        <details class="fold post-meta-fold" id="meta-fold" ${state.metaOpen ? "open" : ""}>
          <summary>标题 / 分类 / 封面等（默认收起，给正文腾地方）</summary>
          <div class="fold-body post-meta">
            <div class="field-row">
              <div class="field"><label>标题</label><input id="f-title" type="text" value="${escapeAttr(form.title)}" /></div>
              <div class="field"><label>发布时间（默认现在，精确到分）</label><div style="display:flex;gap:0.4rem;align-items:center">
                <input id="f-published" type="datetime-local" value="${escapeAttr(toDateTimeLocalValue(form.published || nowLocalDateTime()))}" style="flex:1" />
                <button type="button" class="btn" id="f-published-now" title="填入当前时间">现在</button>
              </div></div>
            </div>
            <div class="field-row">
              <div class="field"><label>分类</label><input id="f-category" type="text" value="${escapeAttr(form.category)}" /></div>
              <div class="field"><label>标签（逗号分隔）</label><input id="f-tags" type="text" value="${escapeAttr(form.tags)}" /></div>
            </div>
            <div class="field"><label>摘要</label><input id="f-desc" type="text" value="${escapeAttr(form.description)}" /></div>
            <div class="field"><label>封面图</label>${imageFieldHtml("cover", form.image, { wide: true, folder: "uploads" })}</div>
            <div class="field-row">
              <label class="switch"><span>置顶</span><input id="f-pinned" type="checkbox" ${form.pinned ? "checked" : ""} /></label>
              <label class="switch" title="开启后前台列表与文章页均不显示"><span>草稿（前台隐藏）</span><input id="f-draft" type="checkbox" ${form.draft ? "checked" : ""} /></label>
            </div>
          </div>
        </details>

        <div class="split ${state.previewOpen ? "" : "preview-collapsed"}" id="editor-split">
          <div class="editor-pane">
            <label>正文 Markdown（主编辑区，本栏独立滚动）</label>
            <textarea id="f-body">${escapeText(form.body)}</textarea>
          </div>
          <div class="preview-panel" id="preview-panel">
            <div class="preview-panel-head">
              <span>实时预览（1:1，可收起）</span>
            </div>
            <div class="preview-pane" id="preview-pane">
              <div class="preview-title" id="preview-title"></div>
              <div class="md-body" id="preview-body"></div>
            </div>
          </div>
        </div>
      </div>
    </div>`);
	main.appendChild(wrap);

	let coverPath = form.image || "";
		const pubNowBtn = wrap.querySelector("#f-published-now");
		const pubInputEl = wrap.querySelector("#f-published");
		if (pubNowBtn && pubInputEl) {
			if (!pubInputEl.value) pubInputEl.value = nowLocalDateTime();
			pubNowBtn.onclick = () => {
				pubInputEl.value = nowLocalDateTime();
				pubInputEl.dispatchEvent(new Event("input", { bubbles: true }));
				pubInputEl.dispatchEvent(new Event("change", { bubbles: true }));
				setStatus("已填入当前时间", "ok");
			};
		}

	bindImageField(wrap, "cover", (v) => {
		coverPath = v;
	});

	const metaFold = wrap.querySelector("#meta-fold");
	const split = wrap.querySelector("#editor-split");
	const previewPanel = wrap.querySelector("#preview-panel");
	const btnMeta = wrap.querySelector("#toggle-meta");
	const btnPrev = wrap.querySelector("#toggle-preview");

	const syncFoldButtons = () => {
		state.metaOpen = !!(metaFold && metaFold.open);
		btnMeta.textContent = state.metaOpen ? "收起标题信息" : "展开标题信息";
		btnPrev.textContent = state.previewOpen ? "收起预览" : "展开预览";
		split.classList.toggle("preview-collapsed", !state.previewOpen);
		if (previewPanel) previewPanel.style.display = state.previewOpen ? "" : "none";
	};
	if (metaFold) metaFold.addEventListener("toggle", syncFoldButtons);
	btnMeta.onclick = () => {
		if (metaFold) metaFold.open = !metaFold.open;
		syncFoldButtons();
	};
	btnPrev.onclick = () => {
		state.previewOpen = !state.previewOpen;
		syncFoldButtons();
	};
	syncFoldButtons();

	const syncPreview = () => {
		wrap.querySelector("#preview-title").textContent =
			wrap.querySelector("#f-title").value || "（无标题）";
		wrap.querySelector("#preview-body").innerHTML = renderMarkdown(
			wrap.querySelector("#f-body").value,
		);
	};
	const persistDraftFromDom = () => {
		const form = collectPostFormFromDom(wrap, coverPath);
		if (!form) return;
		state.postForm = form;
		savePostDraft({
			postForm: form,
			postMode: state.postMode,
			postPath: state.postPath,
			postSha: state.postSha,
			metaOpen: state.metaOpen,
			previewOpen: state.previewOpen,
		});
	};
	wrap.querySelector("#f-title").addEventListener("input", () => {
		syncPreview();
		persistDraftFromDom();
	});
	wrap.querySelector("#f-body").addEventListener("input", () => {
		syncPreview();
		persistDraftFromDom();
	});
	["#f-published", "#f-category", "#f-tags", "#f-desc", "#f-pinned", "#f-draft"].forEach((sel) => {
		const node = wrap.querySelector(sel);
		if (!node) return;
		node.addEventListener("change", persistDraftFromDom);
		node.addEventListener("input", persistDraftFromDom);
	});
	syncPreview();
	persistDraftFromDom();
	setTimeout(() => wrap.querySelector("#f-body")?.focus(), 0);

	const bodyTa = wrap.querySelector("#f-body");
	const insertFile = wrap.querySelector("#insert-image-file");
	const insertBtn = wrap.querySelector("#insert-image");
	if (insertBtn && insertFile) {
			insertBtn.onclick = (ev) => {
		ev?.preventDefault?.();
		persistDraftFromDom();
		insertFile.click();
	};
	insertFile.onchange = async () => {
		const file = insertFile.files?.[0];
		if (!file || !bodyTa) return;
		try {
			persistDraftFromDom();
			setStatus(`上传正文图片 ${file.name}…`);
				const up = await uploadImageFile(file, "uploads");
				const alt = String(file.name || "image").replace(/[\[\]]/g, "");
				const md = `![${alt}](${up.publicPath})`;
				const start = bodyTa.selectionStart ?? bodyTa.value.length;
				const end = bodyTa.selectionEnd ?? start;
				const before = bodyTa.value.slice(0, start);
				const after = bodyTa.value.slice(end);
				const needNlBefore = before && !before.endsWith("\n") ? "\n" : "";
				const needNlAfter = after && !after.startsWith("\n") ? "\n" : "";
				const insert = `${needNlBefore}${md}${needNlAfter}`;
				bodyTa.value = before + insert + after;
				const caret = (before + insert).length;
				bodyTa.focus();
				bodyTa.setSelectionRange(caret, caret);
				bodyTa.dispatchEvent(new Event("input"));
				setStatus(`已插入 ${up.publicPath}`, "ok");
			} catch (e) {
				setStatus(e.message || String(e), "err");
			} finally {
				insertFile.value = "";
			}
		};
	}

	wrap.querySelector("#back-list").onclick = () => {
		state.postMode = "list";
		savePostDraft({ module: "posts", postMode: "list", resumeEdit: false });
		renderPosts(main);
	};
	wrap.querySelector("#save-post").onclick = async () => {
		const btn = wrap.querySelector("#save-post");
		const next = {
			title: wrap.querySelector("#f-title").value.trim(),
			published: fromDateTimeLocalValue(wrap.querySelector("#f-published").value),
			category: wrap.querySelector("#f-category").value.trim(),
			tags: wrap.querySelector("#f-tags").value,
			description: wrap.querySelector("#f-desc").value.trim(),
			image: coverPath,
			pinned: wrap.querySelector("#f-pinned").checked,
			draft: wrap.querySelector("#f-draft").checked,
			priority: state.postForm.priority,
			body: wrap.querySelector("#f-body").value,
		};
		if (!next.published) next.published = fromDateTimeLocalValue(nowLocalDateTime());
		if (!next.title) {
			setStatus("请填写标题后再保存", "err");
			showSaveToast("请填写标题后再保存", "err");
			wrap.querySelector("#f-title")?.focus();
			return;
		}
		if (btn) {
			btn.disabled = true;
			btn.dataset.label = btn.textContent;
			btn.textContent = state.mode === "local" ? "正在写入本地…" : "正在提交…";
		}
		try {
			setStatus(state.mode === "local" ? "正在保存到本地…" : "正在保存到 GitHub…");
			const content = buildFrontmatter(next);
			let path = state.postPath;
			let sha = state.postSha;
			if (state.postMode === "new" || !path) {
				path = `src/content/posts/${slugify(next.title)}.md`;
				sha = undefined;
			}
			const result = await ghPut(path, content, `admin: update ${path}`, sha);
			state.postPath = path;
			state.postSha = result.content?.sha || result?.sha || "";
			state.postForm = next;
			state.postMode = "edit";
			const modeTip =
				state.mode === "local"
					? "已写入本地"
					: "已提交 GitHub";
			const postUrl = postPublicUrl(path);
			setStatus("OK " + modeTip + "：" + path, "ok");
			showSaveToast(modeTip + "：" + path, "ok");
			bumpFrontPreview();
			const toastOpen = document.querySelector("#toast-open");
			if (toastOpen) {
				toastOpen.href = postUrl;
				toastOpen.textContent = "打开文章页";
				toastOpen.target = "_blank";
			}
			savePostDraft({
				module: "posts",
				postMode: "edit",
				postPath: path,
				postSha: state.postSha,
				postForm: next,
				resumeEdit: true,
			});
			// 同步工具栏路径显示
			const st = wrap.querySelector(".toolbar .status");
			if (st) st.textContent = path;
		} catch (e) {
			const msg = e?.message || String(e);
			setStatus(msg, "err");
			showSaveToast(msg, "err");
			console.error("[admin save-post]", e);
		} finally {
			if (btn) {
				btn.disabled = false;
				btn.textContent = btn.dataset.label || saveLabel("保存");
			}
		}
	};

}

async function openPost(path, sha) {
	setStatus(`加载 ${path}…`);
	const file = await ghGet(path);
	if (!file?.content) throw new Error(missingRemoteHint(path));
	const raw = decodeGithubContent(file.content);
	const { data, body } = parseFrontmatter(raw);
	state.postMode = "edit";
	state.postPath = path;
	state.postSha = file.sha || sha;
	state.postForm = {
		title: data.title || "",
		published: data.published ? toDateTimeLocalValue(data.published) : nowLocalDateTime(),
		description: data.description || "",
		image: data.image || "",
		category: data.category || "",
		tags: Array.isArray(data.tags) ? data.tags.join(", ") : data.tags || "",
		pinned: !!data.pinned,
		draft: !!data.draft,
		priority: data.priority ?? "",
		body,
	};
	setStatus(`已打开 ${path}`, "ok");
	savePostDraft({
		module: "posts",
		postMode: "edit",
		postPath: path,
		postSha: state.postSha,
		postForm: state.postForm,
		resumeEdit: true,
	});
	await renderApp();
}

/* -------------------- About -------------------- */
async function renderAbout(main) {
	const file = await ghGet(FILE_MAP.about);
	if (!file?.content) throw new Error(missingRemoteHint(FILE_MAP.about));
	const raw = decodeGithubContent(file.content);
	// about may be pure markdown without frontmatter
	const parsed = parseFrontmatter(raw);
	state.aboutBody = Object.keys(parsed.data || {}).length ? parsed.body : raw;
	state.aboutSha = file.sha;
	main.innerHTML = "";
	const card = el(`
    <div class="card">
      <h2>关于我</h2>
      <p class="desc">左侧编辑，右侧实时预览。</p>
      <div class="toolbar">
        <button class="btn btn-primary" id="save-about">${saveLabel("保存")}</button>
      </div>
      <div class="split">
        <div class="field editor-pane">
          <label>Markdown</label>
          <textarea id="about-body">${escapeText(state.aboutBody)}</textarea>
        </div>
        <div>
          <label style="font-size:0.85rem;font-weight:600;display:block;margin-bottom:0.35rem">预览</label>
          <div class="preview-pane"><div class="md-body" id="about-preview"></div></div>
        </div>
      </div>
    </div>
  `);
	main.appendChild(card);
	const ta = card.querySelector("#about-body");
	const pv = card.querySelector("#about-preview");
	const sync = () => {
		pv.innerHTML = renderMarkdown(ta.value);
	};
	ta.addEventListener("input", sync);
	sync();
	card.querySelector("#save-about").onclick = async () => {
		try {
			setStatus("保存中…");
			const content = ta.value.endsWith("\n") ? ta.value : ta.value + "\n";
			const result = await ghPut(FILE_MAP.about, content, "admin: update about", state.aboutSha);
			state.aboutSha = result.content.sha;
			setStatus("关于页已保存", "ok");
			showSaveToast("关于页已更新");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

/* -------------------- Features -------------------- */
async function renderFeatures(main) {
	const { data } = await loadYamlModule("features");
	const keys = Object.keys(FEATURE_LABELS);
	main.innerHTML = "";
	const card = el(`
    <div class="card">
      <h2>模块开关</h2>
      <p class="desc">控制前台特色页是否可访问，并同步导航「My」菜单。关闭后对应路径会 404；开启后可从导航进入。保存后请看前台（会自动刷新）。</p>
      <div id="feature-list"></div>
      <div class="toolbar" style="margin-top:1rem">
        <button type="button" class="btn btn-primary" id="save-features">${saveLabel("保存开关")}</button>
      </div>
    </div>
  `);
	main.appendChild(card);
	const list = card.querySelector("#feature-list");
	keys.forEach((k) => {
		const row = el(`
      <label class="switch">
        <span>${FEATURE_LABELS[k]} <span class="badge">${k}</span></span>
        <input type="checkbox" data-key="${k}" ${data[k] ? "checked" : ""} />
      </label>
    `);
		list.appendChild(row);
	});
	card.querySelector("#save-features").onclick = async () => {
		const next = { ...data };
		list.querySelectorAll("input[data-key]").forEach((input) => {
			next[input.getAttribute("data-key")] = input.checked;
		});
		try {
			setStatus("保存中…");
			await saveYamlModule("features", next, "admin: update feature toggles");
			setStatus("模块开关已保存（前台导航会同步）", "ok");
			showSaveToast("模块开关已更新。前台导航/页面访问已按开关生效。", "ok");
			if (typeof bumpFrontPreview === "function") bumpFrontPreview();
			if (typeof refreshPushButton === "function") refreshPushButton();
		} catch (e) {
			const msg = e?.message || String(e);
			setStatus(msg, "err");
			showSaveToast(msg, "err");
		}
	};
}


/* -------------------- Profile / Announcement / Banner -------------------- */
async function renderProfile(main) {
	const { data } = await loadYamlModule("profile");
	const linkState = (Array.isArray(data.links) ? data.links : []).map((l) => ({
		name: l.name || "",
		icon: l.icon || "fa7-brands:github",
		url: l.url || "",
	}));

	const PRESETS = [
		{ name: "GitHub", icon: "fa7-brands:github", url: "https://github.com/" },
		{ name: "Bilibili", icon: "fa7-brands:bilibili", url: "https://space.bilibili.com/" },
		{ name: "微博", icon: "fa7-brands:weibo", url: "https://weibo.com/" },
		{ name: "知乎", icon: "simple-icons:zhihu", url: "https://www.zhihu.com/people/" },
		{ name: "Twitter/X", icon: "fa7-brands:x-twitter", url: "https://x.com/" },
		{ name: "邮箱", icon: "fa7-solid:envelope", url: "mailto:" },
		{ name: "QQ", icon: "fa7-brands:qq", url: "" },
		{ name: "自定义", icon: "fa7-solid:link", url: "https://" },
	];

	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>个人资料</h2>
      <p class="desc">头像可上传预览；社交链接用表单添加，不用写 YAML。</p>
      <div class="field"><label>昵称</label><input id="name" type="text" value="${escapeAttr(data.name || "")}" /></div>
      <div class="field"><label>签名 Bio</label><textarea id="bio">${escapeText(data.bio || "")}</textarea></div>
      <div class="field"><label>头像</label>${imageFieldHtml("avatar", data.avatar || "", { folder: "uploads" })}</div>
      <div class="field-row">
        <label class="switch"><span>打字机效果</span><input id="tw-enable" type="checkbox" ${data.typewriter?.enable !== false ? "checked" : ""} /></label>
        <div class="field"><label>速度 ms</label><input id="tw-speed" type="number" value="${Number(data.typewriter?.speed || 80)}" /></div>
      </div>

      <div style="margin-top:1rem">
        <div class="item-card-head" style="margin-bottom:0.5rem">
          <strong>社交链接</strong>
          <span class="status">共 <span id="link-count">${linkState.length}</span> 个</span>
        </div>
        <div class="toolbar" id="preset-bar"></div>
        <div id="links-box"></div>
        <div class="toolbar">
          <button class="btn" id="add-link">添加空白链接</button>
          <button class="btn btn-primary" id="save">${saveLabel("保存")}</button>
        </div>
      </div>
    </div>`);
	main.appendChild(card);

	let avatarPath = data.avatar || "";
	bindImageField(card, "avatar", (v) => {
		avatarPath = v;
	});

	const presetBar = card.querySelector("#preset-bar");
	PRESETS.forEach((p) => {
		const b = el(`<button type="button" class="btn" data-preset>${escapeText(p.name)}</button>`);
		b.onclick = () => {
			linkState.push({ name: p.name === "自定义" ? "" : p.name, icon: p.icon, url: p.url });
			renderLinks();
		};
		presetBar.appendChild(b);
	});

	const linksBox = card.querySelector("#links-box");
	const renderLinks = () => {
		linksBox.innerHTML = "";
		card.querySelector("#link-count").textContent = String(linkState.length);
		if (!linkState.length) {
			linksBox.innerHTML = `<div class="empty">还没有社交链接。可点上方平台快捷添加。</div>`;
			return;
		}
		linkState.forEach((l, i) => {
			const row = el(`
        <div class="item-card">
          <div class="item-card-head">
            <strong>#${i + 1} ${escapeText(l.name || "未命名")}</strong>
            <div style="display:flex;gap:0.35rem">
              <button type="button" class="btn" data-up ${i === 0 ? "disabled" : ""}>上移</button>
              <button type="button" class="btn" data-down ${i === linkState.length - 1 ? "disabled" : ""}>下移</button>
              <button type="button" class="btn btn-danger" data-del>删除</button>
            </div>
          </div>
          <div class="field-row">
            <div class="field"><label>显示名称</label><input data-k="name" type="text" value="${escapeAttr(l.name)}" placeholder="GitHub" /></div>
            <div class="field">
              <label>图标（可快捷选择）</label>
              <div style="display:flex;gap:0.4rem;align-items:center">
                <select data-role="icon-preset" style="max-width:42%">
                  ${PRESETS.map((p) => `<option value="${escapeAttr(p.icon)}" ${l.icon === p.icon ? "selected" : ""}>${escapeText(p.name)}</option>`).join("")}
                  <option value="__custom__" ${PRESETS.every((p) => p.icon !== l.icon) ? "selected" : ""}>自定义…</option>
                </select>
                <input data-k="icon" type="text" value="${escapeAttr(l.icon)}" placeholder="fa7-brands:github" />
              </div>
              <span class="hint">常用 Iconify：fa7-brands:github / fa7-brands:bilibili / fa7-solid:envelope</span>
            </div>
          </div>
          <div class="field"><label>链接 URL</label><input data-k="url" type="text" value="${escapeAttr(l.url)}" placeholder="https://" /></div>
        </div>`);
			row.querySelectorAll("input[data-k]").forEach((input) => {
				const k = input.getAttribute("data-k");
				input.addEventListener("input", () => {
					linkState[i][k] = input.value;
					if (k === "name") {
						const strong = row.querySelector(".item-card-head strong");
						if (strong) strong.textContent = `#${i + 1} ${input.value || "未命名"}`;
					}
				});
			});
			const iconPreset = row.querySelector('[data-role="icon-preset"]');
			const iconInput = row.querySelector('input[data-k="icon"]');
			iconPreset.addEventListener("change", () => {
				if (iconPreset.value !== "__custom__") {
					iconInput.value = iconPreset.value;
					linkState[i].icon = iconPreset.value;
				}
			});
			row.querySelector("[data-del]").onclick = () => {
				linkState.splice(i, 1);
				renderLinks();
			};
			row.querySelector("[data-up]").onclick = () => {
				if (i <= 0) return;
				const t = linkState[i - 1];
				linkState[i - 1] = linkState[i];
				linkState[i] = t;
				renderLinks();
			};
			row.querySelector("[data-down]").onclick = () => {
				if (i >= linkState.length - 1) return;
				const t = linkState[i + 1];
				linkState[i + 1] = linkState[i];
				linkState[i] = t;
				renderLinks();
			};
			linksBox.appendChild(row);
		});
	};
	renderLinks();

	card.querySelector("#add-link").onclick = () => {
		linkState.push({ name: "", icon: "fa7-solid:link", url: "https://" });
		renderLinks();
	};

	card.querySelector("#save").onclick = async () => {
		const next = {
			name: card.querySelector("#name").value.trim(),
			bio: card.querySelector("#bio").value,
			avatar: avatarPath,
			typewriter: {
				enable: card.querySelector("#tw-enable").checked,
				speed: Number(card.querySelector("#tw-speed").value || 80),
			},
			links: linkState
				.map((l) => ({
					name: (l.name || "").trim(),
					icon: (l.icon || "fa7-solid:link").trim(),
					url: (l.url || "").trim(),
				}))
				.filter((l) => l.name || l.url),
		};
		try {
			setStatus("保存中…");
			await saveYamlModule("profile", next, "admin: update profile");
			if (next.avatar) {
				state.avatarUrl = next.avatar;
				const img = document.querySelector("#brand-avatar");
				if (img) img.src = next.avatar;
			}
			setStatus("个人资料已保存", "ok");
			showSaveToast("个人资料已更新");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

async function renderAnnouncement(main) {
	const { data } = await loadYamlModule("announcement");
	main.innerHTML = "";
	const card = el(`
    <div class="card">
      <h2>公告</h2>
      <p class="desc">侧栏公告卡片。保存后写入本地；前台 <code>pnpm dev</code> 刷新即可预览。上线请点右上角「推送到 GitHub」。</p>
      <label class="switch"><span>显示公告</span><input id="enable" type="checkbox" ${data.enable !== false ? "checked" : ""} /></label>
      <div class="field"><label>标题</label><input id="title" type="text" value="${escapeAttr(data.title || "公告")}" /></div>
      <div class="field"><label>内容</label><textarea id="content" rows="5">${escapeText(data.content || "")}</textarea></div>
      <label class="switch"><span>允许访客关闭</span><input id="closable" type="checkbox" ${data.closable ? "checked" : ""} /></label>
      <p class="desc" style="margin-top:-0.25rem">开启后访客可点 × 关闭；内容变更后会自动重新显示。关闭此开关时始终显示，并忽略浏览器里旧的关闭记录。</p>
      <label class="switch"><span>显示链接按钮</span><input id="link-enable" type="checkbox" ${data.link?.enable ? "checked" : ""} /></label>
      <div class="field-row">
        <div class="field"><label>按钮文字</label><input id="link-text" type="text" value="${escapeAttr(data.link?.text || "")}" /></div>
        <div class="field"><label>链接</label><input id="link-url" type="text" value="${escapeAttr(data.link?.url || "/about/")}" /></div>
      </div>
      <label class="switch"><span>在新标签打开</span><input id="link-external" type="checkbox" ${data.link?.external ? "checked" : ""} /></label>
      <div class="card" style="margin-top:1rem;background:var(--surface-2, #f8fafc);border-style:dashed">
        <h3 style="margin:0 0 0.5rem;font-size:0.95rem">预览</h3>
        <div id="ann-preview" style="font-size:0.95rem;line-height:1.6"></div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" id="save">${saveLabel("保存")}</button>
        <button class="btn" type="button" id="open-front" title="新标签打开前台首页">打开前台</button>
      </div>
    </div>
  `);
	main.appendChild(card);

	const preview = card.querySelector("#ann-preview");
	const refreshPreview = () => {
		const enabled = card.querySelector("#enable").checked;
		const title = card.querySelector("#title").value.trim() || "公告";
		const content = card.querySelector("#content").value;
		const linkOn = card.querySelector("#link-enable").checked;
		const linkText = card.querySelector("#link-text").value.trim() || "了解更多";
		const linkUrl = card.querySelector("#link-url").value.trim() || "#";
		const external = card.querySelector("#link-external").checked;
		if (!enabled) {
			preview.innerHTML = `<span style="color:#94a3b8">已关闭显示，前台不会渲染公告卡片。</span>`;
			return;
		}
		if (!content.trim()) {
			preview.innerHTML = `<span style="color:#94a3b8">内容为空时前台也不显示公告。</span>`;
			return;
		}
		const linkHtml = linkOn
			? `<div style="margin-top:0.5rem"><a href="${escapeAttr(linkUrl)}" ${external ? 'target="_blank" rel="noopener noreferrer"' : ""} style="color:var(--primary,#4f6ef7)">${escapeText(linkText)}</a></div>`
			: "";
		preview.innerHTML = `
      <div style="font-weight:700;margin-bottom:0.35rem">${escapeText(title)}</div>
      <div style="white-space:pre-wrap;color:#475569">${escapeText(content)}</div>
      ${linkHtml}
    `;
	};

	["#enable", "#title", "#content", "#link-enable", "#link-text", "#link-url", "#link-external"].forEach((sel) => {
		const node = card.querySelector(sel);
		if (!node) return;
		node.addEventListener("input", refreshPreview);
		node.addEventListener("change", refreshPreview);
	});
	refreshPreview();

	card.querySelector("#open-front").onclick = () => {
		window.open("/", "_blank", "noopener");
	};

	card.querySelector("#save").onclick = async () => {
		const next = {
			enable: card.querySelector("#enable").checked,
			title: card.querySelector("#title").value.trim() || "公告",
			content: card.querySelector("#content").value,
			closable: card.querySelector("#closable").checked,
			link: {
				enable: card.querySelector("#link-enable").checked,
				text: card.querySelector("#link-text").value,
				url: card.querySelector("#link-url").value || "/about/",
				external: card.querySelector("#link-external").checked,
			},
		};
		try {
			setStatus("保存中…");
			await saveYamlModule("announcement", next, "admin: update announcement");
			setStatus("公告已保存到本地", "ok");
			showSaveToast("公告已更新。本地刷新前台预览；上线请推送到 GitHub");
			await refreshPushButton();
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

async function renderBanner(main) {
	const { data } = await loadYamlModule("banner");
	const norm = (v) => !Array.isArray(v) ? [] : v.map((i) => typeof i === "string" ? i : (i?.image || "")).filter((x) => x !== undefined);
	let desktop = norm(data.desktop);
	let mobile = norm(data.mobile);
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>首页横幅</h2>
      <p class="desc">每张图可上传、预览、清除；保存写入 banner.yml。</p>
      <h3 style="margin:0.5rem 0">桌面端</h3>
      <div id="desktop-list"></div>
      <div class="toolbar"><button class="btn" id="add-desktop">添加桌面图</button></div>
      <h3 style="margin:1rem 0 0.5rem">移动端</h3>
      <div id="mobile-list"></div>
      <div class="toolbar"><button class="btn" id="add-mobile">添加移动图</button></div>
      <div class="field-row" style="margin-top:1rem">
        <label class="switch"><span>轮播</span><input id="car-enable" type="checkbox" ${data.carousel?.enable !== false ? "checked" : ""} /></label>
        <div class="field"><label>间隔秒</label><input id="car-interval" type="number" value="${Number(data.carousel?.interval || 3)}" /></div>
      </div>
      <div class="field"><label>主标题</label><input id="ht-title" type="text" value="${escapeAttr(data.homeText?.title || "")}" /></div>
      <div class="field"><label>副标题（每行一句）</label><textarea id="ht-sub">${escapeText((Array.isArray(data.homeText?.subtitle) ? data.homeText.subtitle : []).map((x) => typeof x === "string" ? x : x?.line || "").join("\n"))}</textarea></div>
      <div class="toolbar"><button class="btn btn-primary" id="save">${saveLabel("保存")}</button></div>
    </div>`);
	main.appendChild(card);
	const renderList = (box, arr) => {
		box.innerHTML = "";
		if (!arr.length) { box.innerHTML = `<div class="empty">暂无图片</div>`; return; }
		arr.forEach((src, i) => {
			const row = el(`<div class="item-card"><div class="item-card-head"><strong>图片 ${i + 1}</strong><button class="btn btn-danger" data-del>删除此项</button></div>${imageFieldHtml(`bn-${box.id}-${i}`, src, { wide: true, folder: "uploads/banners" })}</div>`);
			bindImageField(row, `bn-${box.id}-${i}`, (v) => { arr[i] = v; });
			row.querySelector("[data-del]").onclick = () => { arr.splice(i, 1); renderList(box, arr); };
			box.appendChild(row);
		});
	};
	const dBox = card.querySelector("#desktop-list");
	const mBox = card.querySelector("#mobile-list");
	renderList(dBox, desktop);
	renderList(mBox, mobile);
	card.querySelector("#add-desktop").onclick = () => { desktop.push(""); renderList(dBox, desktop); };
	card.querySelector("#add-mobile").onclick = () => { mobile.push(""); renderList(mBox, mobile); };
	card.querySelector("#save").onclick = async () => {
		const sub = card.querySelector("#ht-sub").value.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
		const next = {
			desktop: desktop.filter(Boolean),
			mobile: mobile.filter(Boolean),
			carousel: { enable: card.querySelector("#car-enable").checked, interval: Number(card.querySelector("#car-interval").value || 3) },
			homeText: {
				enable: data.homeText?.enable !== false,
				title: card.querySelector("#ht-title").value,
				subtitle: sub,
				typewriter: data.homeText?.typewriter || { enable: true, speed: 100, deleteSpeed: 50, pauseTime: 2000 },
			},
		};
		try {
			setStatus("保存中…");
			await saveYamlModule("banner", next, "admin: update banner");
			setStatus("横幅已保存", "ok");
			showSaveToast("首页横幅已更新");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

const friendFields = [
	["id", "序号"],
	["title", "站点名称"],
	["imgurl", "头像 URL"],
	["desc", "简介"],
	["siteurl", "网址"],
	["tags", "标签（逗号分隔）"],
];
const projectFields = [
	["id", "ID"],
	["title", "标题"],
	["description", "简介"],
	["image", "封面"],
	["category", "分类"],
	["status", "状态"],
	["techStack", "技术栈（逗号分隔）"],
	["sourceCode", "源码链接"],
	["visitUrl", "演示链接"],
	["startDate", "开始时间"],
	["endDate", "结束时间"],
	["featured", "精选"],
];
const skillFields = [
	["id", "ID"],
	["name", "名称"],
	["description", "简介"],
	["icon", "图标（如 logos:python）"],
	["category", "分类"],
	["level", "等级"],
	["expYears", "经验（年）"],
	["expMonths", "经验（月）"],
	["projects", "相关项目（逗号分隔，可选）"],
	["color", "颜色"],
];
const timelineFields = [
	["id", "ID"],
	["title", "标题"],
	["description", "描述"],
	["type", "类型"],
	["startDate", "开始时间"],
	["endDate", "结束时间"],
	["organization", "组织/学校"],
	["position", "职位/角色（可选）"],
	["location", "地点（可选）"],
	["skills", "相关技能（逗号分隔，可选）"],
	["color", "颜色"],
	["featured", "精选"],
];
const diaryFields = [
	["id", "序号"],
	["content", "内容"],
	["date", "时间"],
	["mood", "心情"],
	["location", "地点"],
	["images", "图片"],
	["tags", "标签（逗号分隔，可选）"],
];
const animeFields = [
	["title", "标题"],
	["status", "状态 watching/completed/planned"],
	["rating", "评分"],
	["cover", "封面"],
	["description", "简介"],
	["year", "年份"],
	["studio", "制作"],
	["link", "链接"],
	["progress", "进度"],
	["totalEpisodes", "总集数"],
];

/** 条目列表表单编辑器 */
async function renderItemList(main, moduleId, title, listKey, fields) {
	// 表单化列表编辑（替代纯 YAML）
	const file = await loadYamlModule(moduleId);
	const items = JSON.parse(JSON.stringify(Array.isArray(file.data[listKey]) ? file.data[listKey] : []));
	// tags array -> string for inputs
	items.forEach((it) => {
		if (Array.isArray(it.tags)) it.tags = tagsToText(it.tags);
		if (Array.isArray(it.techStack)) it.techStack = tagsToText(it.techStack);
		if (Array.isArray(it.genre)) it.genre = tagsToText(it.genre);
		if (Array.isArray(it.skills)) it.skills = tagsToText(it.skills);
		if (Array.isArray(it.projects)) it.projects = tagsToText(it.projects);
		if (Array.isArray(it.images)) {
			it.images = it.images
				.map((x) => (typeof x === "string" ? x : x?.image || x?.url || ""))
				.filter(Boolean);
		} else if (typeof it.images === "string" && it.images.trim()) {
			it.images = textToTags(it.images);
		} else if (!it.images) {
			it.images = [];
		}
		// skills experience object -> flat fields for form
		if (it.experience && typeof it.experience === "object") {
			it.expYears = Number(it.experience.years || 0);
			it.expMonths = Number(it.experience.months || 0);
		} else {
			if (it.expYears == null) it.expYears = 0;
			if (it.expMonths == null) it.expMonths = 0;
		}
	});
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>${title}管理</h2>
      <p class="desc">表单编辑。技能请用下拉选择分类/等级，并填写经验年/月；图片字段支持上传预览。</p>
      <div class="toolbar">
        <button class="btn" id="add-item">添加一条</button>
        <button class="btn btn-primary" id="save-all">${saveLabel("保存")}</button>
        <span class="status">共 <span id="count">${items.length}</span> 条</span>
      </div>
      <div id="items"></div>
    </div>`);
	main.appendChild(card);
	const box = card.querySelector("#items");
	const imageKeys = new Set(["imgurl", "image", "cover"]);
	const render = () => {
		box.innerHTML = "";
		card.querySelector("#count").textContent = String(items.length);
		if (!items.length) {
			box.innerHTML = `<div class="empty">暂无数据</div>`;
			return;
		}
		items.forEach((item, index) => {
			const block = el(`<div class="item-card"><div class="item-card-head"><strong>#${index + 1} ${escapeText(item.title || item.name || item.content || "")}</strong><button class="btn btn-danger" data-del>删除</button></div><div data-fields></div></div>`);
			const fieldsBox = block.querySelector("[data-fields]");
			(fields || []).forEach(([key, label]) => {
				const val = item[key] ?? "";
				if (key === "color") {
					const node = el(`<div class="field"><label>${label}</label>${colorFieldHtml(`${moduleId}-${index}-color`, val)}</div>`);
					fieldsBox.appendChild(node);
					bindColorField(block, `${moduleId}-${index}-color`, (v) => { items[index][key] = v; });
				} else if (key === "images") {
					if (!Array.isArray(items[index].images)) items[index].images = [];
					const node = el(`<div class="field"><label>${label}</label>${multiImageFieldHtml(`${moduleId}-${index}-images`, items[index].images, "uploads/diary")}</div>`);
					fieldsBox.appendChild(node);
					bindMultiImageField(
						block,
						`${moduleId}-${index}-images`,
						() => items[index].images || [],
						(list) => {
							items[index].images = list;
						},
					);
				} else if (imageKeys.has(key)) {
					const node = el(`<div class="field"><label>${label}</label>${imageFieldHtml(`${moduleId}-${index}-${key}`, val, { wide: key !== "imgurl", folder: key === "imgurl" ? "uploads/friends" : key === "cover" ? "uploads/anime" : "uploads/projects" })}</div>`);
					fieldsBox.appendChild(node);
					bindImageField(block, `${moduleId}-${index}-${key}`, (v) => { items[index][key] = v; });
				} else if (key === "category" && moduleId === "skills") {
					const opts = [
						["frontend", "前端 frontend"],
						["backend", "后端 backend"],
						["database", "数据库 database"],
						["tools", "工具 tools"],
						["other", "其他 other"],
					];
					const node = el(`<div class="field"><label>${label}</label>
            <select data-k="${key}">
              ${opts.map(([v, lab]) => `<option value="${v}" ${String(val) === v ? "selected" : ""}>${lab}</option>`).join("")}
            </select></div>`);
					fieldsBox.appendChild(node);
				} else if (key === "level" && moduleId === "skills") {
					const opts = [
						["beginner", "入门 beginner"],
						["intermediate", "熟练 intermediate"],
						["advanced", "精通 advanced"],
						["expert", "专家 expert"],
					];
					const node = el(`<div class="field"><label>${label}</label>
            <select data-k="${key}">
              ${opts.map(([v, lab]) => `<option value="${v}" ${String(val) === v ? "selected" : ""}>${lab}</option>`).join("")}
            </select></div>`);
					fieldsBox.appendChild(node);
				} else if ((key === "expYears" || key === "expMonths") && moduleId === "skills") {
					const node = el(`<div class="field"><label>${label}</label><input data-k="${key}" type="number" min="0" step="1" value="${escapeAttr(val === "" || val == null ? 0 : val)}" /></div>`);
					fieldsBox.appendChild(node);
				} else if (key === "category" && moduleId === "projects") {
					const opts = [
						["web", "Web"],
						["mobile", "移动端 mobile"],
						["desktop", "桌面 desktop"],
						["other", "其他 other"],
					];
					const node = el(`<div class="field"><label>${label}</label>
            <select data-k="${key}">
              ${opts.map(([v, lab]) => `<option value="${v}" ${String(val) === v ? "selected" : ""}>${lab}</option>`).join("")}
            </select></div>`);
					fieldsBox.appendChild(node);
				} else if (key === "status" && moduleId === "projects") {
					const opts = [
						["completed", "已完成 completed"],
						["in-progress", "进行中 in-progress"],
						["planned", "计划中 planned"],
					];
					const node = el(`<div class="field"><label>${label}</label>
            <select data-k="${key}">
              ${opts.map(([v, lab]) => `<option value="${v}" ${String(val) === v ? "selected" : ""}>${lab}</option>`).join("")}
            </select></div>`);
					fieldsBox.appendChild(node);
				} else if (key === "type" && moduleId === "timeline") {
					const opts = [
						["education", "教育 education"],
						["work", "工作 work"],
						["project", "项目 project"],
						["achievement", "成就 achievement"],
					];
					const node = el(`<div class="field"><label>${label}</label>
            <select data-k="${key}">
              ${opts.map(([v, lab]) => `<option value="${v}" ${String(val) === v ? "selected" : ""}>${lab}</option>`).join("")}
            </select></div>`);
					fieldsBox.appendChild(node);
				} else if (key === "mood" && moduleId === "diary") {
					const opts = [
						["", "未设置"],
						["happy", "开心 happy"],
						["calm", "平静 calm"],
						["sad", "低落 sad"],
						["excited", "兴奋 excited"],
						["tired", "疲惫 tired"],
						["other", "其他 other"],
					];
					const node = el(`<div class="field"><label>${label}</label>
            <select data-k="${key}">
              ${opts.map(([v, lab]) => `<option value="${v}" ${String(val || "") === v ? "selected" : ""}>${lab}</option>`).join("")}
            </select></div>`);
					fieldsBox.appendChild(node);
				} else if (key === "startDate" || key === "endDate" || key === "date" || key === "published") {
					// endDate 可为空；其余空值默认当前时间
					const isEnd = key === "endDate";
					const v = val ? toDateTimeLocalValue(val) : isEnd ? "" : nowLocalDateTime();
					if (!isEnd && (val == null || val === "")) {
						items[index][key] = fromDateTimeLocalValue(v);
					}
					const node = el(`<div class="field"><label>${label}</label>
            <div style="display:flex;gap:0.4rem;align-items:center">
              <input data-k="${key}" type="datetime-local" value="${escapeAttr(v)}" style="flex:1" />
              <button type="button" class="btn" data-now-for="${key}" title="填入当前时间">现在</button>
            </div></div>`);
					fieldsBox.appendChild(node);
					const nowBtn = node.querySelector("[data-now-for]");
					const input = node.querySelector(`[data-k="${key}"]`);
					if (nowBtn && input) {
						nowBtn.onclick = (ev) => {
							ev?.preventDefault?.();
							input.value = nowLocalDateTime();
							items[index][key] = fromDateTimeLocalValue(input.value);
							input.dispatchEvent(new Event("input", { bubbles: true }));
							input.dispatchEvent(new Event("change", { bubbles: true }));
							setStatus("已填入当前时间", "ok");
						};
					}
				} else if (typeof val === "boolean" || key === "featured" || key === "showImage") {
					const node = el(`<label class="switch"><span>${label}</span><input data-k="${key}" type="checkbox" ${val ? "checked" : ""} /></label>`);
					fieldsBox.appendChild(node);
				} else if (String(label).includes("简介") || String(label).includes("描述") || String(label).includes("内容") || key === "description" || key === "content" || key === "desc") {
					const node = el(`<div class="field"><label>${label}</label><textarea data-k="${key}">${escapeText(val)}</textarea></div>`);
					fieldsBox.appendChild(node);
				} else {
					const node = el(`<div class="field"><label>${label}</label><input data-k="${key}" type="text" value="${escapeAttr(val)}" /></div>`);
					fieldsBox.appendChild(node);
				}
			});
			block.querySelectorAll("[data-k]").forEach((input) => {
				const k = input.getAttribute("data-k");
				const handler = () => {
					if (input.type === "checkbox") items[index][k] = input.checked;
					else items[index][k] = input.value;
				};
				input.addEventListener("input", handler);
				input.addEventListener("change", handler);
			});
			block.querySelector("[data-del]").onclick = () => { items.splice(index, 1); render(); };
			box.appendChild(block);
		});
	};
	render();
	card.querySelector("#add-item").onclick = () => {
		const blank = {};
		(fields || []).forEach(([key]) => {
			blank[key] = imageKeys.has(key) ? "" : "";
		});
		if (moduleId === "skills") {
			blank.category = "other";
			blank.level = "beginner";
			blank.expYears = 0;
			blank.expMonths = 0;
			blank.icon = "mdi:code-tags";
			blank.color = "#3B82F6";
			blank.projects = "";
		} else if (moduleId === "projects") {
			blank.category = "other";
			blank.status = "planned";
			blank.techStack = "";
			blank.featured = false;
			blank.startDate = nowLocalDateTime();
		} else if (moduleId === "timeline") {
			blank.type = "project";
			blank.featured = false;
			blank.skills = "";
			blank.color = "#3B82F6";
			blank.startDate = nowLocalDateTime();
		} else if (moduleId === "diary") {
			blank.date = nowLocalDateTime();
			blank.mood = "";
			blank.tags = "";
			blank.images = [];
		}
		items.push(blank);
		render();
	};
	card.querySelector("#save-all").onclick = async () => {
		const payload = items.map((raw, idx) => {
			const it = { ...raw };
			["tags", "techStack", "genre", "skills", "projects"].forEach((k) => {
				if (typeof it[k] === "string") it[k] = textToTags(it[k]);
			});
			["rating", "progress", "totalEpisodes", "expYears", "expMonths"].forEach((k) => {
				if (it[k] !== "" && it[k] != null && !Number.isNaN(Number(it[k]))) it[k] = Number(it[k]);
			});
			// 日期时间字段：datetime-local -> YAML 本地时间
			["startDate", "endDate", "date", "published"].forEach((k) => {
				if (it[k]) it[k] = fromDateTimeLocalValue(it[k]);
			});
			if (moduleId === "skills") {
				const years = Number(it.expYears || 0) || 0;
				const months = Number(it.expMonths || 0) || 0;
				it.experience = { years, months };
				delete it.expYears;
				delete it.expMonths;
				if (!it.id) {
					const base = String(it.name || `skill-${idx + 1}`)
						.toLowerCase()
						.replace(/\s+/g, "-");
					it.id = base.replace(/[^\w\-]+/g, "") || `skill-${idx + 1}`;
				}
				if (!it.category) it.category = "other";
				if (!it.level) it.level = "beginner";
				if (!it.icon) it.icon = "mdi:code-tags";
				if (!it.color) it.color = "#3B82F6";
				if (!Array.isArray(it.projects)) it.projects = [];
			}
			if (moduleId === "projects") {
				if (!it.id) {
					const base = String(it.title || `project-${idx + 1}`)
						.toLowerCase()
						.replace(/\s+/g, "-");
					it.id = base.replace(/[^\w\-]+/g, "") || `project-${idx + 1}`;
				}
				if (!it.category) it.category = "other";
				if (!it.status) it.status = "planned";
				if (!Array.isArray(it.techStack)) it.techStack = [];
				it.featured = !!it.featured;
			}
			if (moduleId === "timeline") {
				if (!it.id) {
					const base = String(it.title || `timeline-${idx + 1}`)
						.toLowerCase()
						.replace(/\s+/g, "-");
					it.id = base.replace(/[^\w\-]+/g, "") || `timeline-${idx + 1}`;
				}
				if (!it.type) it.type = "project";
				if (!Array.isArray(it.skills)) it.skills = [];
				it.featured = !!it.featured;
				if (!it.color) it.color = "#3B82F6";
			}
			if (moduleId === "diary") {
				if (it.id === "" || it.id == null) it.id = idx + 1;
				else it.id = Number(it.id) || idx + 1;
				if (!it.date) it.date = fromDateTimeLocalValue(nowLocalDateTime());
				if (!Array.isArray(it.tags)) {
					it.tags = typeof it.tags === "string" ? textToTags(it.tags) : [];
				}
				if (!Array.isArray(it.images)) {
					it.images =
						typeof it.images === "string" && it.images.trim()
							? textToTags(it.images)
							: [];
				} else {
					it.images = it.images
						.map((x) => (typeof x === "string" ? x : x?.image || x?.url || ""))
						.filter(Boolean);
				}
			}
			return it;
		});
		try {
			setStatus("保存中…");
			await saveYamlModule(moduleId, { [listKey]: payload }, `admin: update ${moduleId}`);
			setStatus(`${title}已保存（${payload.length} 条）`, "ok");
			showSaveToast(`${title}已更新（${payload.length} 条）`);
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

async function renderDevices(main) {
	const file = await loadYamlModule("devices");
	const categories = Array.isArray(file.data.categories)
		? file.data.categories.map((c) => ({
				key: c.key || "",
				devices: Array.isArray(c.devices) ? c.devices.map((d) => ({ ...d })) : [],
			}))
		: [];
	main.innerHTML = remoteBannerHtml();
	const card = el(`
    <div class="card">
      <h2>设备管理</h2>
      <p class="desc">按分类管理设备；每个设备支持图片上传 / 预览 / 清空 / 删除。</p>
      <div class="toolbar">
        <button type="button" class="btn" id="add-cat">添加分类</button>
        <button type="button" class="btn btn-primary" id="save">保存到 GitHub</button>
      </div>
      <div id="cat-list"></div>
    </div>
  `);
	main.appendChild(card);
	const catList = card.querySelector("#cat-list");

	function paint() {
		catList.innerHTML = "";
		if (!categories.length) {
			catList.innerHTML = `<div class="empty">暂无分类</div>`;
			return;
		}
		categories.forEach((cat, ci) => {
			const catCard = el(`
        <div class="item-card" data-ci="${ci}">
          <div class="item-card-head">
            <strong>分类 #${ci + 1}</strong>
            <div style="display:flex;gap:0.4rem">
              <button type="button" class="btn" data-role="add-dev">添加设备</button>
              <button type="button" class="btn btn-danger" data-role="del-cat">删除分类</button>
            </div>
          </div>
          <div class="field"><label>分类名 key</label><input data-role="cat-key" type="text" value="${escapeAttr(cat.key)}" placeholder="OnePlus" /></div>
          <div data-role="devices"></div>
        </div>
      `);
			const devWrap = catCard.querySelector('[data-role="devices"]');
			(cat.devices || []).forEach((dev, di) => {
				const d = el(`
          <div class="item-card" style="background:var(--card-bg)" data-di="${di}">
            <div class="item-card-head">
              <strong>设备 #${di + 1}</strong>
              <button type="button" class="btn btn-danger" data-role="del-dev">删除</button>
            </div>
            <div class="field-row">
              <div class="field"><label>名称</label><input data-k="name" type="text" value="${escapeAttr(dev.name || "")}" /></div>
              <div class="field"><label>规格</label><input data-k="specs" type="text" value="${escapeAttr(dev.specs || "")}" /></div>
            </div>
            <div class="field"><label>图片</label>${imageFieldHtml(`dev-${ci}-${di}`, dev.image || "", { folder: "uploads/devices" })}</div>
            <div class="field"><label>描述</label><textarea data-k="description">${escapeText(dev.description || "")}</textarea></div>
            <div class="field"><label>链接</label><input data-k="link" type="url" value="${escapeAttr(dev.link || "")}" /></div>
          </div>
        `);
				bindImageField(d, `dev-${ci}-${di}`, (p) => {
					dev.image = p;
				});
				d.querySelector('[data-role="del-dev"]').onclick = () => {
					readAll();
					categories[ci].devices.splice(di, 1);
					paint();
				};
				devWrap.appendChild(d);
			});
			catCard.querySelector('[data-role="del-cat"]').onclick = () => {
				readAll();
				categories.splice(ci, 1);
				paint();
			};
			catCard.querySelector('[data-role="add-dev"]').onclick = () => {
				readAll();
				categories[ci].devices.push({ name: "", image: "", specs: "", description: "", link: "" });
				paint();
			};
			catList.appendChild(catCard);
		});
	}

	function readAll() {
		[...catList.querySelectorAll(":scope > .item-card")].forEach((cc, ci) => {
			const cat = categories[ci] || { key: "", devices: [] };
			cat.key = cc.querySelector('[data-role="cat-key"]').value.trim();
			cat.devices = [...cc.querySelectorAll('[data-role="devices"] > .item-card')].map((dc) => {
				const o = {};
				dc.querySelectorAll("[data-k]").forEach((inp) => {
					o[inp.getAttribute("data-k")] = inp.value;
				});
				const path = dc.querySelector('[data-role="path"]');
				o.image = path ? path.value.trim() : "";
				return o;
			});
			categories[ci] = cat;
		});
	}

	card.querySelector("#add-cat").onclick = () => {
		readAll();
		categories.push({ key: "", devices: [] });
		paint();
	};
	card.querySelector("#save").onclick = async () => {
		try {
			readAll();
			const next = {
				categories: categories.map((c) => ({
					key: c.key || "未命名",
					devices: (c.devices || []).map((d) => ({
						name: d.name || "",
						image: d.image || "",
						specs: d.specs || "",
						description: d.description || "",
						link: d.link || "",
					})),
				})),
			};
			setStatus("保存中…");
			await saveYamlModule("devices", next, "admin: update devices");
			setStatus("设备已保存", "ok");
			showSaveToast("设备页已更新");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
	paint();
}

function escapeAttr(s) {
	return String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;");
}
function escapeText(s) {
	return String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;");
}

// boot
async function renderFriends(main) {
	const file = await loadYamlModule("friends");
	const items = JSON.parse(
		JSON.stringify(Array.isArray(file.data.items) ? file.data.items : []),
	);
	items.forEach((it) => {
		if (Array.isArray(it.tags)) it.tags = tagsToText(it.tags);
	});
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>友链管理</h2>
      <p class="desc">填写网址后可点「抓取头像」自动获取站点图标；抓不到再手动上传。名称/简介也会尽量自动填充。</p>
      <div class="toolbar">
        <button type="button" class="btn" id="add-friend">添加友链</button>
        <button type="button" class="btn btn-primary" id="save-friends">${saveLabel("保存")}</button>
        <span class="status">共 <span id="count">${items.length}</span> 条</span>
      </div>
      <div id="friend-list"></div>
    </div>`);
	main.appendChild(card);
	const box = card.querySelector("#friend-list");

	const fetchMeta = async (siteurl) => {
		const res = await fetch(`${LOCAL_API}/fetch-site-meta`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ url: siteurl }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || data.ok === false) {
			throw new Error(data.error || `抓取失败 ${res.status}`);
		}
		return data;
	};

	const render = () => {
		box.innerHTML = "";
		card.querySelector("#count").textContent = String(items.length);
		if (!items.length) {
			box.innerHTML = `<div class="empty">还没有友链，点「添加友链」</div>`;
			return;
		}
		items.forEach((item, index) => {
			const row = el(`
        <div class="item-card">
          <div class="item-card-head">
            <strong>#${index + 1} ${escapeText(item.title || "未命名")}</strong>
            <div style="display:flex;gap:0.4rem">
              <button type="button" class="btn" data-fetch title="根据网址抓取站点图标/标题">抓取头像</button>
              <button type="button" class="btn btn-danger" data-del>删除</button>
            </div>
          </div>
          <div class="friend-card">
            <div>${imageFieldHtml(`friend-avatar-${index}`, item.imgurl || "", { folder: "uploads/friends" })}</div>
            <div>
              <div class="field-row">
                <div class="field"><label>名称</label><input data-k="title" type="text" value="${escapeAttr(item.title || "")}" /></div>
                <div class="field"><label>网址</label><input data-k="siteurl" type="url" value="${escapeAttr(item.siteurl || "")}" placeholder="https://" /></div>
              </div>
              <div class="field"><label>简介</label><input data-k="desc" type="text" value="${escapeAttr(item.desc || "")}" /></div>
              <div class="field"><label>标签（可选，逗号分隔）</label><input data-k="tags" type="text" value="${escapeAttr(item.tags || "")}" /></div>
              <span class="hint">可先填网址 → 抓取头像；失败则右侧/上方手动上传图片。</span>
            </div>
          </div>
        </div>`);
			row.querySelectorAll("[data-k]").forEach((input) => {
				const k = input.getAttribute("data-k");
				input.addEventListener("input", () => {
					items[index][k] = input.value;
				});
			});
			bindImageField(row, `friend-avatar-${index}`, (v) => {
				items[index].imgurl = v;
			});
			row.querySelector("[data-del]").onclick = () => {
				items.splice(index, 1);
				render();
			};
			row.querySelector("[data-fetch]").onclick = async () => {
				const siteurl = (items[index].siteurl || row.querySelector('[data-k="siteurl"]').value || "").trim();
				if (!siteurl) {
					setStatus("请先填写网址", "err");
					return;
				}
				try {
					setStatus(`正在抓取 ${siteurl} …`);
					const meta = await fetchMeta(siteurl);
					items[index].siteurl = meta.url || siteurl;
					if (!items[index].title && meta.title) items[index].title = meta.title;
					if (!items[index].desc && meta.description) items[index].desc = meta.description;
					if (meta.icon) items[index].imgurl = meta.icon;
					// 若标题为空则用抓到的
					if (meta.title && (!items[index].title || items[index].title === "未命名")) {
						items[index].title = meta.title;
					}
					render();
					const warn = Array.isArray(meta.warnings) && meta.warnings.length
						? "；" + meta.warnings.join("；")
						: "";
					if (meta.iconLocal || meta.icon) {
						setStatus(`已抓取头像：${meta.iconLocal || meta.icon}${warn}`, "ok");
					} else {
						setStatus(`未抓到头像，请手动上传${warn}`, "err");
					}
				} catch (e) {
					setStatus(e.message || String(e), "err");
				}
			};
			// 网址失焦时若无头像，自动尝试一次（不覆盖已有图）
			const urlInput = row.querySelector('[data-k="siteurl"]');
			urlInput.addEventListener("change", async () => {
				const siteurl = urlInput.value.trim();
				items[index].siteurl = siteurl;
				if (!siteurl || items[index].imgurl) return;
				try {
					setStatus(`检测到新网址，尝试抓取头像…`);
					const meta = await fetchMeta(siteurl);
					items[index].siteurl = meta.url || siteurl;
					if (!items[index].title && meta.title) items[index].title = meta.title;
					if (!items[index].desc && meta.description) items[index].desc = meta.description;
					if (meta.icon) items[index].imgurl = meta.icon;
					render();
					setStatus(
						meta.icon
							? `已自动抓取头像：${meta.icon}`
							: "未抓到头像，请手动上传",
						meta.icon ? "ok" : "err",
					);
				} catch (e) {
					setStatus(`自动抓取失败：${e.message || e}（可手动上传）`, "err");
				}
			});
			box.appendChild(row);
		});
	};
	render();

	card.querySelector("#add-friend").onclick = () => {
		const maxId = items.reduce((m, it) => Math.max(m, Number(it.id) || 0), 0);
		items.push({
			id: maxId + 1,
			title: "",
			imgurl: "",
			desc: "",
			siteurl: "",
			tags: "",
		});
		render();
	};
	card.querySelector("#save-friends").onclick = async () => {
		const payload = items
			.map((it, i) => ({
				id: Number(it.id) || i + 1,
				title: (it.title || "").trim(),
				imgurl: it.imgurl || "",
				desc: it.desc || "",
				siteurl: (it.siteurl || "").trim(),
				tags: textToTags(it.tags),
			}))
			.filter((it) => it.title || it.siteurl);
		try {
			setStatus("保存中…");
			await saveYamlModule(
				"friends",
				{ items: payload },
				"admin: update friends",
			);
			setStatus(`友链已保存（${payload.length} 条）`, "ok");
			showSaveToast(`友链已更新（${payload.length} 条）`);
			if (typeof bumpFrontPreview === "function") bumpFrontPreview();
			if (typeof refreshPushButton === "function") refreshPushButton();
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}


async function renderAlbums(main) {
	setStatus("加载相册列表…");
	const base = "public/images/albums";
	const imageExts = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".avif", ".bmp"]);

	const listDir = async (rel) => {
		const res = await fetch(`${LOCAL_API}/list?path=${encodeURIComponent(rel)}`, {
			cache: "no-store",
		});
		if (res.status === 404) return [];
		if (!res.ok) throw new Error(`列出失败 ${res.status}: ${(await res.text()).slice(0, 160)}`);
		const data = await res.json();
		return Array.isArray(data) ? data : [];
	};

	const mkdirLocal = async (rel) => {
		const res = await fetch(`${LOCAL_API}/mkdir`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path: rel }),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || `创建目录失败 ${res.status}`);
		return data;
	};

	const isImageName = (name) => {
		const n = String(name || "").toLowerCase();
		const i = n.lastIndexOf(".");
		if (i < 0) return false;
		return imageExts.has(n.slice(i));
	};

	const entries = await listDir(base);
	const folders = entries.filter((e) => e.type === "dir");

	const albums = [];
	for (const f of folders) {
		const infoPath = `${base}/${f.name}/info.json`;
		const infoFile = await ghGet(infoPath);
		let info = {
			title: f.name,
			description: "",
			date: "",
			location: "",
			tags: [],
			layout: "grid",
			columns: 3,
			hidden: false,
		};
		let sha = "";
		if (infoFile?.content) {
			try {
				info = { ...info, ...JSON.parse(decodeGithubContent(infoFile.content)) };
			} catch {
				/* keep default */
			}
			sha = infoFile.sha || "";
		}
		const files = await listDir(`${base}/${f.name}`);
		const photos = files
			.filter((x) => x.type === "file" && isImageName(x.name))
			.map((x) => ({
				name: x.name,
				path: x.path,
				publicPath: `/images/albums/${f.name}/${x.name}`,
				size: x.size || 0,
				mtimeMs: x.mtimeMs || 0,
			}))
			.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
		const coverFile = photos.find((p) => /^cover\.(webp|jpg|jpeg|png)$/i.test(p.name));
		const cover = coverFile?.publicPath || photos[0]?.publicPath || "";
		albums.push({
			id: f.name,
			path: f.path || `${base}/${f.name}`,
			info,
			infoPath,
			sha,
			photos,
			cover,
		});
	}
	// newest first by info.date then id
	albums.sort((a, b) => String(b.info.date || "").localeCompare(String(a.info.date || "")) || b.id.localeCompare(a.id));

	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>相册管理</h2>
      <p class="desc">管理 public/images/albums/相册名/。可新建相册、改信息、多图上传、设封面、删除照片/相册。前台无 cover 时会用第一张图。</p>
      <div class="toolbar">
        <button type="button" class="btn btn-primary" id="add-album">新建相册</button>
        <button type="button" class="btn" id="reload-albums">刷新</button>
        <span class="status">共 <span id="album-count">${albums.length}</span> 个</span>
      </div>
      <div id="album-list" class="list"></div>
      <div id="album-editor"></div>
    </div>`);
	main.appendChild(card);
	const list = card.querySelector("#album-list");
	const editor = card.querySelector("#album-editor");

	const saveInfo = async (album, nextInfo) => {
		const content = JSON.stringify(nextInfo, null, 2) + "\n";
		const result = await ghPut(
			album.infoPath,
			content,
			`admin: update album ${album.id}`,
			album.sha || undefined,
		);
		album.sha = result.content?.sha || result?.sha || album.sha;
		album.info = nextInfo;
	};

	const openEditor = async (album) => {
		const info = { ...album.info };
		// refresh photos
		const files = await listDir(`${base}/${album.id}`);
		album.photos = files
			.filter((x) => x.type === "file" && isImageName(x.name))
			.map((x) => ({
				name: x.name,
				path: x.path,
				publicPath: `/images/albums/${album.id}/${x.name}`,
				size: x.size || 0,
				mtimeMs: x.mtimeMs || 0,
			}))
			.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
		const coverFile = album.photos.find((p) => /^cover\.(webp|jpg|jpeg|png)$/i.test(p.name));
		album.cover = coverFile?.publicPath || album.photos[0]?.publicPath || "";

		const photoThumbs = album.photos
			.map((p) => {
				const isCover = /^cover\./i.test(p.name);
				return `
          <div class="album-photo-item" data-photo="${escapeAttr(p.name)}">
            <img src="${escapeAttr(publicUrl(p.publicPath))}" alt="${escapeAttr(p.name)}" />
            <div style="display:flex;gap:0.25rem;flex-wrap:wrap">
              <button type="button" class="btn ${isCover ? "btn-primary" : ""}" data-set-cover="${escapeAttr(p.path)}" ${isCover ? "disabled" : ""}>${isCover ? "当前封面" : "设为封面"}</button>
              <button type="button" class="btn btn-danger" data-del-photo="${escapeAttr(p.path)}" data-del-name="${escapeAttr(p.name)}">删除</button>
            </div>
            <span class="hint" style="word-break:break-all">${escapeText(p.name)}</span>
          </div>`;
			})
			.join("");

		editor.innerHTML = `
      <div class="item-card" style="margin-top:1rem">
        <div class="item-card-head">
          <strong>编辑相册：${escapeText(album.info.title || album.id)}</strong>
          <button type="button" class="btn" id="close-editor">收起</button>
        </div>
        ${album.cover ? `<div class="field"><label>封面预览</label><img src="${escapeAttr(publicUrl(album.cover))}" alt="cover" style="max-width:160px;max-height:100px;object-fit:cover;border-radius:0.6rem;border:1px solid var(--line,#e5e7eb)" /></div>` : `<div class="hint">暂无封面：上传照片后可点「设为封面」</div>`}
        <div class="field"><label>标题</label><input id="a-title" type="text" value="${escapeAttr(info.title || album.id)}" /></div>
        <div class="field"><label>描述</label><textarea id="a-desc">${escapeText(info.description || "")}</textarea></div>
        <div class="field-row">
          <div class="field"><label>时间</label>
            <div style="display:flex;gap:0.4rem;align-items:center">
              <input id="a-date" type="datetime-local" value="${escapeAttr(toDateTimeLocalValue(info.date || nowLocalDateTime()))}" style="flex:1" />
              <button type="button" class="btn" id="a-date-now">现在</button>
            </div>
          </div>
          <div class="field"><label>地点</label><input id="a-loc" type="text" value="${escapeAttr(info.location || "")}" /></div>
        </div>
        <div class="field"><label>标签（逗号分隔）</label><input id="a-tags" type="text" value="${escapeAttr(tagsToText(info.tags || []))}" /></div>
        <div class="field-row">
          <div class="field"><label>布局</label>
            <select id="a-layout">
              <option value="grid" ${info.layout !== "masonry" ? "selected" : ""}>网格 grid</option>
              <option value="masonry" ${info.layout === "masonry" ? "selected" : ""}>瀑布流 masonry</option>
            </select>
          </div>
          <div class="field"><label>列数</label><input id="a-cols" type="number" min="1" max="6" value="${Number(info.columns || 3)}" /></div>
        </div>
        <label class="switch"><span>隐藏相册（前台不显示）</span><input id="a-hidden" type="checkbox" ${info.hidden ? "checked" : ""} /></label>

        <div class="field" style="margin-top:1rem">
          <label>上传照片（可多选）</label>
          <div class="img-actions">
            <button type="button" class="btn btn-primary" id="a-upload-btn">选择图片上传</button>
            <input type="file" id="a-upload-file" accept="image/*" multiple style="display:none" />
          </div>
          <span class="hint">保存到 public/images/albums/${escapeText(album.id)}/ 。第一张可自动作为封面（若还没有 cover）。</span>
        </div>

        <div class="field">
          <label>照片列表（${album.photos.length}）</label>
          <div class="album-photo-list" id="a-photo-list">${photoThumbs || '<div class="img-empty">暂无照片，请上传</div>'}</div>
        </div>

        <div class="toolbar" style="margin-top:0.75rem">
          <button type="button" class="btn btn-primary" id="save-album">${saveLabel("保存信息")}</button>
          <button type="button" class="btn btn-danger" id="del-album">删除整个相册</button>
        </div>
      </div>`;

		editor.querySelector("#close-editor").onclick = () => {
			editor.innerHTML = "";
		};
		editor.querySelector("#a-date-now").onclick = () => {
			const input = editor.querySelector("#a-date");
			input.value = nowLocalDateTime();
		};

		const collectInfo = () => ({
			title: editor.querySelector("#a-title").value.trim() || album.id,
			description: editor.querySelector("#a-desc").value,
			date: fromDateTimeLocalValue(editor.querySelector("#a-date").value || nowLocalDateTime()),
			location: editor.querySelector("#a-loc").value.trim(),
			tags: textToTags(editor.querySelector("#a-tags").value),
			layout: editor.querySelector("#a-layout").value,
			columns: Number(editor.querySelector("#a-cols").value || 3),
			hidden: editor.querySelector("#a-hidden").checked,
		});

		editor.querySelector("#save-album").onclick = async () => {
			try {
				setStatus("保存相册信息…");
				await saveInfo(album, collectInfo());
				setStatus(`相册 ${album.id} 信息已保存`, "ok");
				showSaveToast(`相册 ${album.id} 已更新`);
				if (typeof bumpFrontPreview === "function") bumpFrontPreview();
				await renderAlbums(main);
			} catch (e) {
				setStatus(e.message || String(e), "err");
			}
		};

		editor.querySelector("#del-album").onclick = async () => {
			if (!confirm(`确定删除整个相册「${album.id}」？\\n将删除文件夹内全部照片，不可恢复。`)) return;
			try {
				setStatus("删除相册…");
				// 先删文件再删目录：直接删目录
				await ghDelete(album.path, "", `admin: delete album ${album.id}`);
				setStatus(`已删除相册 ${album.id}`, "ok");
				showSaveToast(`已删除相册 ${album.id}`);
				if (typeof bumpFrontPreview === "function") bumpFrontPreview();
				await renderAlbums(main);
			} catch (e) {
				setStatus(e.message || String(e), "err");
			}
		};

		const fileInput = editor.querySelector("#a-upload-file");
		editor.querySelector("#a-upload-btn").onclick = () => fileInput.click();
		fileInput.onchange = async () => {
			const files = [...(fileInput.files || [])];
			if (!files.length) return;
			try {
				setStatus(`上传 ${files.length} 张到相册 ${album.id}…`);
				let firstPath = "";
				for (const file of files) {
					const up = await uploadImageFile(file, `images/albums/${album.id}`);
					if (!firstPath) firstPath = up.publicPath || "";
				}
				// 若无 cover，把第一张复制为 cover（通过再读并 put cover 名）
				const hasCover = album.photos.some((p) => /^cover\./i.test(p.name));
				if (!hasCover && firstPath) {
					// 重新 list 后选最新一张设封面更稳
				}
				setStatus(`已上传 ${files.length} 张`, "ok");
				// 若没有封面，自动把刚传的第一张设为封面
				const refreshed = await listDir(`${base}/${album.id}`);
				const imgs = refreshed.filter((x) => x.type === "file" && isImageName(x.name));
				const stillNoCover = !imgs.some((x) => /^cover\./i.test(x.name));
				if (stillNoCover && imgs.length) {
					// 选 mtime 最新
					imgs.sort((a, b) => (b.mtimeMs || 0) - (a.mtimeMs || 0));
					const srcRel = imgs[0].path;
					const ext = (imgs[0].name.match(/(\.[a-zA-Z0-9]+)$/) || [".jpg", ".jpg"])[1].toLowerCase();
					const coverRel = `${base}/${album.id}/cover${ext === ".jpeg" ? ".jpg" : ext}`;
					const fileObj = await ghGet(srcRel);
					if (fileObj?.content) {
						await ghPutBinary(
							coverRel,
							fileObj.content,
							`admin: set cover for ${album.id}`,
							undefined,
						);
						setStatus(`已上传并自动设置封面`, "ok");
					}
				}
				if (typeof bumpFrontPreview === "function") bumpFrontPreview();
				// 保持编辑当前相册
				const list2 = albums; // re-render full then reopen
				await renderAlbums(main);
				// reopen
				setTimeout(() => {
					const btn = [...document.querySelectorAll("[data-open-album]")].find(
						(b) => b.getAttribute("data-open-album") === album.id,
					);
					btn?.click();
				}, 50);
			} catch (e) {
				setStatus(e.message || String(e), "err");
			} finally {
				fileInput.value = "";
			}
		};

		editor.querySelectorAll("[data-del-photo]").forEach((btn) => {
			btn.onclick = async () => {
				const rel = btn.getAttribute("data-del-photo");
				const name = btn.getAttribute("data-del-name") || rel;
				if (!confirm(`删除照片 ${name}？`)) return;
				try {
					setStatus(`删除 ${name}…`);
					await ghDelete(rel, "", `admin: delete photo ${name}`);
					setStatus(`已删除 ${name}`, "ok");
					if (typeof bumpFrontPreview === "function") bumpFrontPreview();
					await openEditor(album);
				} catch (e) {
					setStatus(e.message || String(e), "err");
				}
			};
		});

		editor.querySelectorAll("[data-set-cover]").forEach((btn) => {
			btn.onclick = async () => {
				const rel = btn.getAttribute("data-set-cover");
				try {
					setStatus("设置封面…");
					const fileObj = await ghGet(rel);
					if (!fileObj?.content) throw new Error("读取原图失败");
					const name = rel.split("/").pop() || "cover.jpg";
					const ext = (name.match(/(\.[a-zA-Z0-9]+)$/) || [".jpg", ".jpg"])[1].toLowerCase();
					const coverRel = `${base}/${album.id}/cover${ext === ".jpeg" ? ".jpg" : ext}`;
					// 删除旧 cover.*
					const files = await listDir(`${base}/${album.id}`);
					for (const f of files) {
						if (f.type === "file" && /^cover\./i.test(f.name) && f.path !== coverRel) {
							try {
								await ghDelete(f.path, f.sha || "", `admin: remove old cover`);
							} catch {
								/* ignore */
							}
						}
					}
					await ghPutBinary(
						coverRel,
						fileObj.content,
						`admin: set cover ${album.id}`,
						undefined,
					);
					setStatus("封面已更新", "ok");
					showSaveToast("相册封面已更新");
					if (typeof bumpFrontPreview === "function") bumpFrontPreview();
					await openEditor(album);
				} catch (e) {
					setStatus(e.message || String(e), "err");
				}
			};
		});
	};

	if (!albums.length) {
		list.innerHTML = `<div class="empty">暂无相册。点「新建相册」开始。</div>`;
	} else {
		albums.forEach((a) => {
			const item = el(`
        <div class="list-item">
          <div style="display:flex;gap:0.75rem;align-items:center;min-width:0;flex:1">
            ${
							a.cover
								? `<img src="${escapeAttr(publicUrl(a.cover))}" alt="" style="width:56px;height:56px;object-fit:cover;border-radius:0.5rem;border:1px solid var(--line,#e5e7eb)" />`
								: `<div style="width:56px;height:56px;border-radius:0.5rem;background:#eee"></div>`
						}
            <div style="min-width:0">
              <strong>${escapeText(a.info.title || a.id)}${a.info.hidden ? " · 隐藏" : ""}</strong>
              <span>${escapeText(a.id)} · ${a.photos.length} 张${a.info.date ? " · " + escapeText(String(a.info.date).slice(0, 16).replace("T", " ")) : ""}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.4rem">
            <button type="button" class="btn" data-open-album="${escapeAttr(a.id)}">管理</button>
            <button type="button" class="btn btn-danger" data-del-album="${escapeAttr(a.path)}" data-del-id="${escapeAttr(a.id)}">删除</button>
          </div>
        </div>`);
			item.querySelector("[data-open-album]").onclick = () => openEditor(a);
			item.querySelector("[data-del-album]").onclick = async () => {
				if (!confirm(`确定删除相册「${a.id}」及全部照片？`)) return;
				try {
					setStatus("删除相册…");
					await ghDelete(a.path, "", `admin: delete album ${a.id}`);
					setStatus(`已删除 ${a.id}`, "ok");
					if (typeof bumpFrontPreview === "function") bumpFrontPreview();
					await renderAlbums(main);
				} catch (e) {
					setStatus(e.message || String(e), "err");
				}
			};
			list.appendChild(item);
		});
	}

	card.querySelector("#reload-albums").onclick = () => renderAlbums(main);
	card.querySelector("#add-album").onclick = async () => {
		const name = prompt("新相册文件夹名（建议英文/数字/短横线，将作为 URL）");
		if (!name) return;
		const id = name
			.trim()
			.replace(/\\s+/g, "-")
			.replace(/[^\\w\\-一-鿿]+/g, "-")
			.replace(/^-+|-+$/g, "");
		if (!id) return setStatus("相册名无效", "err");
		const dir = `${base}/${id}`;
		const infoPath = `${dir}/info.json`;
		const info = {
			title: id,
			description: "",
			date: fromDateTimeLocalValue(nowLocalDateTime()),
			location: "",
			tags: [],
			layout: "grid",
			columns: 3,
			hidden: false,
		};
		try {
			setStatus("创建相册…");
			await mkdirLocal(dir);
			await ghPut(infoPath, JSON.stringify(info, null, 2) + "\\n", `admin: create album ${id}`);
			setStatus(`相册 ${id} 已创建，请上传照片`, "ok");
			showSaveToast(`相册 ${id} 已创建`);
			await renderAlbums(main);
			setTimeout(() => {
				const btn = [...document.querySelectorAll("[data-open-album]")].find(
					(b) => b.getAttribute("data-open-album") === id,
				);
				btn?.click();
			}, 50);
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};

	setStatus(`共 ${albums.length} 个相册`, "ok");
}


/** 音乐 / 看板娘 / 番剧（B站链接填充）后台模块 */

function parseBilibiliMediaId(input) {
	const s = String(input || "").trim();
	if (!s) return "";
	// md28228367 or full URL
	let m = s.match(/md(\d+)/i);
	if (m) return m[1];
	m = s.match(/media_id=(\d+)/i);
	if (m) return m[1];
	if (/^\d+$/.test(s)) return s;
	return "";
}

async function fetchBilibiliBangumi(mediaOrUrl) {
	// 走本地服务端抓取，避免浏览器 CORS 代理丢字段
	const res = await fetch(`${LOCAL_API}/fetch-bilibili-bangumi`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ url: mediaOrUrl }),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || data.ok === false) {
		throw new Error(data.error || `B站抓取失败 ${res.status}`);
	}
	return {
		title: data.title || "",
		cover: data.cover || "",
		description: data.description || "",
		link: data.link || "",
		rating: Number(data.rating || 0),
		episodes: data.episodes || "",
		totalEpisodes: Number(data.totalEpisodes || 0),
		year: data.year || "",
		studio: data.studio || data.author || "",
		status: data.status || "planned",
		progress: Number(data.progress || 0),
		startDate: data.startDate || "",
		endDate: data.endDate || "",
		genre: Array.isArray(data.genre) ? data.genre : [],
	};
}


async function renderMusic(main) {
	const file = await loadYamlModule("music");
	const d = file.data || {};
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>音乐播放器</h2>
      <p class="desc">开关与 Meting/本地模式。本地歌单文件仍在代码 constants 中，后台先管开关与在线歌单。</p>
      <label class="switch"><span>启用音乐播放器</span><input id="m-enable" type="checkbox" ${d.enable ? "checked" : ""} /></label>
      <label class="switch"><span>显示悬浮播放器</span><input id="m-float" type="checkbox" ${d.showFloatingPlayer ? "checked" : ""} /></label>
      <div class="field-row">
        <div class="field"><label>悬浮入口模式</label>
          <select id="m-entry">
            <option value="fab" ${d.floatingEntryMode !== "default" ? "selected" : ""}>fab（集成 FAB）</option>
            <option value="default" ${d.floatingEntryMode === "default" ? "selected" : ""}>default（独立）</option>
          </select>
        </div>
        <div class="field"><label>模式</label>
          <select id="m-mode">
            <option value="local" ${d.mode !== "meting" ? "selected" : ""}>local 本地</option>
            <option value="meting" ${d.mode === "meting" ? "selected" : ""}>meting 在线</option>
          </select>
        </div>
      </div>
      <div class="field"><label>Meting API</label><input id="m-api" type="text" value="${escapeAttr(d.meting_api || "")}" /></div>
      <div class="field-row">
        <div class="field"><label>歌单 ID</label><input id="m-id" type="text" value="${escapeAttr(d.id || "")}" /></div>
        <div class="field"><label>平台 server</label>
          <select id="m-server">
            ${["netease", "tencent", "kugou", "xiami", "baidu"]
							.map(
								(x) =>
									`<option value="${x}" ${d.server === x ? "selected" : ""}>${x}</option>`,
							)
							.join("")}
          </select>
        </div>
      </div>
      <div class="field"><label>类型 type</label>
        <select id="m-type">
          ${["playlist", "song", "album", "search"]
						.map(
							(x) =>
								`<option value="${x}" ${d.type === x ? "selected" : ""}>${x}</option>`,
						)
						.join("")}
        </select>
      </div>
      <div class="toolbar"><button class="btn btn-primary" id="save">${saveLabel("保存")}</button></div>
    </div>`);
	main.appendChild(card);
	card.querySelector("#save").onclick = async () => {
		const next = {
			enable: card.querySelector("#m-enable").checked,
			showFloatingPlayer: card.querySelector("#m-float").checked,
			floatingEntryMode: card.querySelector("#m-entry").value,
			mode: card.querySelector("#m-mode").value,
			meting_api: card.querySelector("#m-api").value.trim(),
			id: card.querySelector("#m-id").value.trim(),
			server: card.querySelector("#m-server").value,
			type: card.querySelector("#m-type").value,
		};
		try {
			setStatus("保存中…");
			await saveYamlModule("music", next, "admin: update music");
			setStatus("音乐播放器设置已保存", "ok");
			showSaveToast("音乐设置已更新（本地可刷新前台查看）");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

async function renderPio(main) {
	const file = await loadYamlModule("pio");
	const d = file.data || {};
	const dialog = d.dialog || {};
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>看板娘 Pio</h2>
      <p class="desc">启用后前台显示看板娘。模型路径默认 /pio/models/...</p>
      <label class="switch"><span>启用看板娘</span><input id="p-enable" type="checkbox" ${d.enable ? "checked" : ""} /></label>
      <label class="switch"><span>手机端隐藏</span><input id="p-mobile" type="checkbox" ${d.hiddenOnMobile !== false ? "checked" : ""} /></label>
      <div class="field-row">
        <div class="field"><label>位置</label>
          <select id="p-pos">
            <option value="left" ${d.position !== "right" ? "selected" : ""}>left</option>
            <option value="right" ${d.position === "right" ? "selected" : ""}>right</option>
          </select>
        </div>
        <div class="field"><label>模式</label>
          <select id="p-mode">
            ${["draggable", "fixed", "static"]
							.map(
								(x) =>
									`<option value="${x}" ${d.mode === x ? "selected" : ""}>${x}</option>`,
							)
							.join("")}
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>宽度</label><input id="p-w" type="number" value="${Number(d.width || 280)}" /></div>
        <div class="field"><label>高度</label><input id="p-h" type="number" value="${Number(d.height || 250)}" /></div>
      </div>
      <div class="field"><label>模型路径（每行一个）</label><textarea id="p-models">${escapeText((d.models || ["/pio/models/pio/model.json"]).join("\n"))}</textarea></div>
      <div class="field"><label>欢迎语</label><input id="p-welcome" type="text" value="${escapeAttr(dialog.welcome || "")}" /></div>
      <div class="field"><label>回首页提示</label><input id="p-home" type="text" value="${escapeAttr(dialog.home || "")}" /></div>
      <div class="field"><label>关闭提示</label><input id="p-close" type="text" value="${escapeAttr(dialog.close || "")}" /></div>
      <div class="field"><label>关于链接</label><input id="p-link" type="text" value="${escapeAttr(dialog.link || "")}" /></div>
      <div class="field"><label>触摸台词（每行一句）</label><textarea id="p-touch">${escapeText((dialog.touch || []).join("\n"))}</textarea></div>
      <div class="field"><label>换装台词（每行一句）</label><textarea id="p-skin">${escapeText((dialog.skin || []).join("\n"))}</textarea></div>
      <div class="toolbar"><button class="btn btn-primary" id="save">${saveLabel("保存")}</button></div>
    </div>`);
	main.appendChild(card);
	card.querySelector("#save").onclick = async () => {
		const lines = (sel) =>
			card
				.querySelector(sel)
				.value.split(/\r?\n/)
				.map((x) => x.trim())
				.filter(Boolean);
		const next = {
			enable: card.querySelector("#p-enable").checked,
			hiddenOnMobile: card.querySelector("#p-mobile").checked,
			position: card.querySelector("#p-pos").value,
			mode: card.querySelector("#p-mode").value,
			width: Number(card.querySelector("#p-w").value || 280),
			height: Number(card.querySelector("#p-h").value || 250),
			models: lines("#p-models"),
			dialog: {
				welcome: card.querySelector("#p-welcome").value,
				home: card.querySelector("#p-home").value,
				close: card.querySelector("#p-close").value,
				link: card.querySelector("#p-link").value,
				touch: lines("#p-touch"),
				skin: lines("#p-skin"),
			},
		};
		try {
			setStatus("保存中…");
			await saveYamlModule("pio", next, "admin: update pio");
			setStatus("看板娘设置已保存", "ok");
			showSaveToast("看板娘设置已更新（本地可刷新前台查看）");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

async function renderAnime(main) {
	const file = await loadYamlModule("anime");
	const items = JSON.parse(
		JSON.stringify(Array.isArray(file.data.items) ? file.data.items : []),
	);
	items.forEach((it) => {
		if (Array.isArray(it.genre)) it.genre = tagsToText(it.genre);
	});
	main.innerHTML = typeof remoteBannerHtml === "function" ? remoteBannerHtml() : "";
	const card = el(`
    <div class="card">
      <h2>番剧管理</h2>
      <p class="desc">支持粘贴 B 站番剧链接（含 md 号）。本地服务端抓取标题/封面/简介/集数/年份/制作/标签；失败再手动改。</p>
      <div class="toolbar" style="align-items:flex-end">
        <div class="field" style="flex:1;margin:0">
          <label>B 站链接或 media id</label>
          <input id="bili-url" type="text" placeholder="https://www.bilibili.com/bangumi/media/md28228367 或 28228367" />
        </div>
        <button class="btn btn-primary" id="bili-fetch">从 B 站填充并添加</button>
      </div>
      <div class="toolbar">
        <button class="btn" id="add-item">手动添加</button>
        <button class="btn btn-primary" id="save-all">${saveLabel("保存")}</button>
        <span class="status">共 <span id="count">${items.length}</span> 条</span>
      </div>
      <div id="items"></div>
    </div>`);
	main.appendChild(card);
	const box = card.querySelector("#items");

	const render = () => {
		box.innerHTML = "";
		card.querySelector("#count").textContent = String(items.length);
		if (!items.length) {
			box.innerHTML = `<div class="empty">暂无番剧</div>`;
			return;
		}
		items.forEach((item, index) => {
			const row = el(`
        <div class="item-card">
          <div class="item-card-head">
            <strong>#${index + 1} ${escapeText(item.title || "未命名")}</strong>
            <button class="btn btn-danger" data-del>删除</button>
          </div>
          <div class="field-row">
            <div class="field"><label>标题</label><input data-k="title" type="text" value="${escapeAttr(item.title || "")}" /></div>
            <div class="field"><label>状态</label>
              <select data-k="status">
                ${["watching", "completed", "planned"]
									.map(
										(x) =>
											`<option value="${x}" ${item.status === x ? "selected" : ""}>${x}</option>`,
									)
									.join("")}
              </select>
            </div>
          </div>
          <div class="field"><label>封面</label>${imageFieldHtml(`anime-cover-${index}`, item.cover || "", { wide: true, folder: "uploads/anime" })}</div>
          <div class="field"><label>简介</label><textarea data-k="description">${escapeText(item.description || "")}</textarea></div>
          <div class="field"><label>B 站/链接</label><input data-k="link" type="text" value="${escapeAttr(item.link || "")}" /></div>
          <div class="field-row">
            <div class="field"><label>评分</label><input data-k="rating" type="number" step="0.1" value="${escapeAttr(item.rating ?? "")}" /></div>
            <div class="field"><label>进度</label><input data-k="progress" type="number" value="${escapeAttr(item.progress ?? 0)}" /></div>
            <div class="field"><label>总集数</label><input data-k="totalEpisodes" type="number" value="${escapeAttr(item.totalEpisodes ?? 0)}" /></div>
          </div>
          <div class="field-row">
            <div class="field"><label>集数描述</label><input data-k="episodes" type="text" value="${escapeAttr(item.episodes || "")}" /></div>
            <div class="field"><label>年份</label><input data-k="year" type="text" value="${escapeAttr(item.year || "")}" /></div>
            <div class="field"><label>制作</label><input data-k="studio" type="text" value="${escapeAttr(item.studio || "")}" /></div>
          </div>
          <div class="field"><label>类型（逗号分隔）</label><input data-k="genre" type="text" value="${escapeAttr(item.genre || "")}" /></div>
        </div>`);
			row.querySelectorAll("[data-k]").forEach((input) => {
				const k = input.getAttribute("data-k");
				const h = () => {
					items[index][k] =
						input.type === "number"
							? input.value === ""
								? ""
								: Number(input.value)
							: input.value;
				};
				input.addEventListener("input", h);
				input.addEventListener("change", h);
			});
			bindImageField(row, `anime-cover-${index}`, (v) => {
				items[index].cover = v;
			});
			row.querySelector("[data-del]").onclick = () => {
				items.splice(index, 1);
				render();
			};
			box.appendChild(row);
		});
	};
	render();

	card.querySelector("#add-item").onclick = () => {
		items.unshift({
			title: "",
			status: "planned",
			rating: 0,
			cover: "",
			description: "",
			episodes: "",
			year: "",
			genre: "",
			studio: "",
			link: "",
			progress: 0,
			totalEpisodes: 0,
			startDate: "",
			endDate: "",
		});
		render();
	};

	card.querySelector("#bili-fetch").onclick = async () => {
		const url = card.querySelector("#bili-url").value.trim();
		if (!url) return setStatus("请粘贴 B 站番剧链接", "err");
		try {
			setStatus("正在从 B 站获取…");
			const data = await fetchBilibiliBangumi(url);
			items.unshift({
				...data,
				genre: Array.isArray(data.genre) ? data.genre.join(", ") : data.genre || "",
			});
			render();
			setStatus(`已添加：${data.title || "番剧"}（请检查后保存）`, "ok");
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};

	card.querySelector("#save-all").onclick = async () => {
		const payload = items.map((it) => ({
			title: it.title || "",
			status: it.status || "planned",
			rating: Number(it.rating || 0),
			cover: it.cover || "",
			description: it.description || "",
			episodes: it.episodes || "",
			year: String(it.year || ""),
			genre: textToTags(it.genre),
			studio: it.studio || "",
			link: it.link || "",
			progress: Number(it.progress || 0),
			totalEpisodes: Number(it.totalEpisodes || 0),
			startDate: it.startDate || "",
			endDate: it.endDate || "",
		}));
		try {
			setStatus("保存中…");
			await saveYamlModule("anime", { items: payload }, "admin: update anime");
			setStatus(`番剧已保存（${payload.length} 条）`, "ok");
			showSaveToast(`番剧已更新（${payload.length} 条）`);
		} catch (e) {
			setStatus(e.message || String(e), "err");
		}
	};
}

bootLocal();
