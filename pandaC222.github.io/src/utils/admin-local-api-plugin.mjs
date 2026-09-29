/**
 * 本地开发专用管理 API（仅 Vite dev server + localhost）
 * 让 /admin 在不推 GitHub 的情况下直接读写工作区文件，前台刷新即可预览。
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
let viteServer = null;

const ALLOW_PREFIXES = [
	"src/content/",
	"public/uploads/",
	"public/images/",
	"src/content/admin/",
	"src/content/posts/",
	"src/content/spec/",
];

function sendJson(res, status, data) {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json; charset=utf-8");
	res.end(JSON.stringify(data));
}

function isLocalRequest(req) {
	const host = String(req.headers.host || "").toLowerCase();
	const ip = String(req.socket?.remoteAddress || "");
	const localHost =
		host.startsWith("localhost:") ||
		host.startsWith("127.0.0.1:") ||
		host.startsWith("[::1]:") ||
		host === "localhost" ||
		host === "127.0.0.1" ||
		host === "[::1]";
	// Windows / 部分代理下 remoteAddress 可能为空，仅校验 Host 为 localhost 时放行
	const localIp =
		!ip ||
		ip === "127.0.0.1" ||
		ip === "::1" ||
		ip === "::ffff:127.0.0.1" ||
		ip.endsWith("127.0.0.1");
	return localHost && localIp;
}

function safeResolve(relPath) {
	const normalized = String(relPath || "")
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")
		.replace(/\0/g, "");
	if (!normalized || normalized.includes("..")) {
		throw new Error("非法路径");
	}
	const ok = ALLOW_PREFIXES.some(
		(p) => normalized === p.slice(0, -1) || normalized.startsWith(p),
	);
	if (!ok) throw new Error(`路径不允许: ${normalized}`);
	const abs = path.resolve(ROOT, normalized);
	const rootAbs = path.resolve(ROOT);
	if (!abs.startsWith(rootAbs + path.sep) && abs !== rootAbs) {
		throw new Error("路径越界");
	}
	return { rel: normalized, abs };
}

function shaOf(buf) {
	return crypto.createHash("sha1").update(buf).digest("hex");
}

async function readBody(req) {
	const chunks = [];
	for await (const c of req) chunks.push(c);
	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw) return {};
	return JSON.parse(raw);
}

async function listDir(rel) {
	const { abs, rel: r } = safeResolve(rel);
	const entries = await fs.readdir(abs, { withFileTypes: true });
	const out = [];
	for (const ent of entries) {
		const childRel = `${r}/${ent.name}`.replace(/\\/g, "/");
		if (ent.isDirectory()) {
			const st = await fs.stat(path.join(abs, ent.name)).catch(() => null);
			out.push({
				type: "dir",
				name: ent.name,
				path: childRel,
				sha: "",
				mtimeMs: st?.mtimeMs || 0,
			});
		} else if (ent.isFile()) {
			const full = path.join(abs, ent.name);
			const st = await fs.stat(full);
			const buf = await fs.readFile(full);
			out.push({
				type: "file",
				name: ent.name,
				path: childRel,
				sha: shaOf(buf),
				size: buf.length,
				mtimeMs: st.mtimeMs || 0,
			});
		}
	}
	// 新文件在前（按修改时间倒序）；目录靠后
	out.sort((a, b) => {
		if (a.type !== b.type) return a.type === "file" ? -1 : 1;
		return (b.mtimeMs || 0) - (a.mtimeMs || 0);
	});
	return out;
}

async function getFile(rel) {
	const { abs, rel: r } = safeResolve(rel);
	try {
		const st = await fs.stat(abs);
		if (st.isDirectory()) {
			return { type: "dir", path: r, name: path.basename(r) };
		}
		const buf = await fs.readFile(abs);
		return {
			type: "file",
			path: r,
			name: path.basename(r),
			encoding: "base64",
			content: buf.toString("base64"),
			sha: shaOf(buf),
			size: buf.length,
		};
	} catch (e) {
		if (e && e.code === "ENOENT") return null;
		throw e;
	}
}


/**
 * 文章热更新：对齐 VSCode 直接改 md 的路径。
 * 不要手搓 ContentLayer.sync / 虚拟模块 id —— 容易和 Astro 6 内部状态打架。
 * 正确做法：
 * 1) 文件真实落盘（md/yml 用 writeFile，不用 tmp+rename 躲 chokidar）
 * 2) 确保 watcher 在听
 * 3) emit change（Windows 路径兼容）
 * 4) 等 .astro/data-store.json 被 Astro 自己更新
 * 5) 再触发 client full-reload（与 Astro 官方 invalidateDataStore 一致）
 */
async function sleep(ms) {
	await new Promise((r) => setTimeout(r, ms));
}

function emitFsChange(server, absPath) {
	if (!server?.watcher) return;
	const forms = [
		absPath,
		String(absPath).replace(/\\/g, "/"),
		path.normalize(absPath),
	];
	// Windows 有时是小写盘符
	try {
		const drive = String(absPath).match(/^[A-Za-z]:/);
		if (drive) {
			const rest = String(absPath).slice(2);
			forms.push(drive[0].toLowerCase() + rest);
			forms.push(drive[0].toUpperCase() + rest);
			forms.push((drive[0].toLowerCase() + rest).replace(/\\/g, "/"));
			forms.push((drive[0].toUpperCase() + rest).replace(/\\/g, "/"));
		}
	} catch {
		/* ignore */
	}
	for (const pth of [...new Set(forms.filter(Boolean))]) {
		try {
			server.watcher.add?.(pth);
		} catch {
			/* ignore */
		}
		for (const ev of ["change", "add"]) {
			try {
				server.watcher.emit(ev, pth);
			} catch {
				/* ignore */
			}
		}
	}
	try {
		server.watcher.add?.(path.dirname(absPath));
	} catch {
		/* ignore */
	}
}

async function waitForDataStoreUpdate(beforeMtime, timeoutMs = 4000) {
	const storePath = path.join(ROOT, ".astro", "data-store.json");
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const st = await fs.stat(storePath);
			if (st.mtimeMs > beforeMtime + 1) return true;
		} catch {
			/* ignore */
		}
		await sleep(80);
	}
	return false;
}

/** 与 Astro 官方一致：\0 + "astro:data-layer-content" */
const RESOLVED_DATA_STORE_VIRTUAL_ID = "\0" + "astro:data-layer-content";

/**
 * 复制 Astro vite-plugin-content-virtual-mod.js 的 invalidateDataStore。
 * 只 full-reload 不够：SSR 环境的 data-store 模块不失效时，
 * 列表可能新、详情页 title 仍旧（你现在遇到的问题）。
 */
function invalidateAstroDataStore(server) {
	if (!server) return;
	const ts = Date.now();
	const tryInvalidate = (graph, id) => {
		if (!graph?.getModuleById || !graph.invalidateModule) return;
		try {
			const mod = graph.getModuleById(id);
			if (mod) graph.invalidateModule(mod, undefined, ts, true);
		} catch {
			/* ignore */
		}
	};
	const sweepGraph = (graph) => {
		if (!graph) return;
		tryInvalidate(graph, RESOLVED_DATA_STORE_VIRTUAL_ID);
		tryInvalidate(graph, "astro:data-layer-content");
		// 扫含 data-layer / content 的模块，避免 id 写法不一致
		try {
			for (const mod of graph.idToModuleMap?.values?.() || []) {
				const id = String(mod?.id || "");
				if (
					id.includes("data-layer-content") ||
					id.includes("astro:content") ||
					id.includes("content-modules")
				) {
					try {
						graph.invalidateModule(mod, undefined, ts, true);
					} catch {
						/* ignore */
					}
				}
			}
		} catch {
			/* ignore */
		}
	};

	try {
		const envs = server.environments || {};
		const ssr = envs.ssr || envs.astro || null;
		// 官方：先 invalidate SSR 的 data-store 虚拟模块
		if (ssr?.moduleGraph) sweepGraph(ssr.moduleGraph);
		for (const name of Object.keys(envs)) {
			sweepGraph(envs[name]?.moduleGraph);
			try {
				envs[name]?.hot?.send?.("astro:content-changed", {});
			} catch {
				/* ignore */
			}
		}
		sweepGraph(server.moduleGraph);
		try {
			ssr?.hot?.send?.("astro:content-changed", {});
		} catch {
			/* ignore */
		}
		// 官方：client full-reload
		try {
			envs.client?.hot?.send?.({ type: "full-reload", path: "*" });
		} catch {
			/* ignore */
		}
		try {
			server.ws?.send?.({ type: "full-reload" });
		} catch {
			/* ignore */
		}
		// Layout 自定义事件（非 admin 页）
		try {
			server.ws?.send?.({
				type: "custom",
				event: "admin:content-updated",
				data: { t: Date.now() },
			});
		} catch {
			/* ignore */
		}
		try {
			envs.client?.hot?.send?.("admin:content-updated", { t: Date.now() });
		} catch {
			/* ignore */
		}
	} catch (e) {
		console.warn("[admin-local-api] invalidateAstroDataStore", e?.message || e);
	}
}

function clientFullReload(server) {
	invalidateAstroDataStore(server);
}

async function invalidateContentStore(relPath, server, absPath) {
	const rel = String(relPath || "").replace(/\\/g, "/");
	if (!rel.startsWith("src/content/")) return;
	const abs = absPath ? path.resolve(String(absPath)) : path.resolve(ROOT, rel);
	const isPost = rel.startsWith("src/content/posts/") || rel.startsWith("src/content/spec/");

	let before = 0;
	try {
		before = (await fs.stat(path.join(ROOT, ".astro", "data-store.json"))).mtimeMs;
	} catch {
		before = 0;
	}

	// 戳 mtime + emit，模拟编辑器保存
	try {
		const now = new Date();
		await fs.utimes(abs, now, now);
	} catch {
		/* ignore */
	}
	emitFsChange(server, abs);

	// 等 Astro glob-loader 自己写完 data-store
	const updated = await waitForDataStoreUpdate(before, isPost ? 5000 : 2500);
	if (!updated) {
		emitFsChange(server, abs);
		try {
			const storePath = path.join(ROOT, ".astro", "data-store.json");
			await fs.utimes(storePath, new Date(), new Date()).catch(() => {});
			emitFsChange(server, storePath);
		} catch {
			/* ignore */
		}
		await waitForDataStoreUpdate(before, 2000);
	}

	// data-store 落盘后再按官方方式失效 SSR 模块，否则详情页 title 会旧
	await sleep(isPost ? 120 : 40);
	try {
		const storePath = path.join(ROOT, ".astro", "data-store.json");
		emitFsChange(server, storePath);
	} catch {
		/* ignore */
	}
	invalidateAstroDataStore(server);

	if (isPost) {
		const key = "__aaaxm_front_reload_timer__";
		if (globalThis[key]) clearTimeout(globalThis[key]);
		globalThis[key] = setTimeout(() => invalidateAstroDataStore(server), 350);
		await sleep(40);
	}
}


async function putFile(rel, contentBase64) {
	const { abs, rel: r } = safeResolve(rel);
	await fs.mkdir(path.dirname(abs), { recursive: true });
	const buf = Buffer.from(String(contentBase64 || ""), "base64");
	// md/yml：像 VSCode 一样直接 writeFile，保证 chokidar 能看到 change
	// （tmp+rename 在 Windows 上有时只触发 add/unlink，glob-loader 只听 change）
	const isContentText =
		/^src\/content\//.test(r) &&
		(/\.md$/i.test(r) || /\.yml$/i.test(r) || /\.yaml$/i.test(r) || /\.json$/i.test(r));
	if (isContentText) {
		let lastErr;
		for (let i = 0; i < 6; i++) {
			try {
				await fs.writeFile(abs, buf);
				lastErr = null;
				break;
			} catch (e) {
				lastErr = e;
				await sleep(30 * (i + 1));
			}
		}
		if (lastErr) {
			const msg = lastErr?.message || String(lastErr);
			const code = lastErr?.code ? ` [${lastErr.code}]` : "";
			throw new Error(`写入失败${code}: ${r} — ${msg}`);
		}
		await invalidateContentStore(r, viteServer, abs);
		return {
			ok: true,
			mode: "local",
			abs: abs,
			content: {
				path: r,
				name: path.basename(r),
				sha: shaOf(buf),
				size: buf.length,
				type: "file",
			},
		};
	}
	// 二进制/其它：Windows 上直接覆盖偶发 EPERM/EBUSY：同目录临时文件 + 重试替换
	const tmp = path.join(
		path.dirname(abs),
		`.${path.basename(abs)}.${process.pid}.${Date.now()}.tmp`,
	);
	await fs.writeFile(tmp, buf);
	let lastErr;
	for (let i = 0; i < 8; i++) {
		try {
			// Node 16+：Windows 上 overwrite 更稳
			await fs.rename(tmp, abs);
			lastErr = null;
			break;
		} catch (e) {
			lastErr = e;
			try {
				await fs.copyFile(tmp, abs);
				await fs.unlink(tmp).catch(() => {});
				lastErr = null;
				break;
			} catch (e2) {
				lastErr = e2;
				// 最后几轮直接 writeFile 覆盖
				if (i >= 5) {
					try {
						await fs.writeFile(abs, buf);
						await fs.unlink(tmp).catch(() => {});
						lastErr = null;
						break;
					} catch (e3) {
						lastErr = e3;
					}
				}
				await new Promise((r) => setTimeout(r, 50 * (i + 1)));
			}
		}
	}
	if (lastErr) {
		await fs.unlink(tmp).catch(() => {});
		const msg = lastErr?.message || String(lastErr);
		const code = lastErr?.code ? ` [${lastErr.code}]` : "";
		throw new Error(`写入失败${code}: ${r} — ${msg}`);
	}
	await invalidateContentStore(r, viteServer, abs);
	return {
		ok: true,
		mode: "local",
		abs: abs,
		content: {
			path: r,
			name: path.basename(r),
			sha: shaOf(buf),
			size: buf.length,
			type: "file",
		},
	};
}

async function rmWithRetry(abs, { isDir }) {
	// 尽量让 Vite watcher 放开占用（Windows EPERM 常见原因）
	try {
		const slash = String(abs).replaceAll("\\", "/");
		viteServer?.watcher?.unwatch?.(abs);
		viteServer?.watcher?.unwatch?.(slash);
	} catch {}
	let lastErr;
	for (let i = 0; i < 10; i++) {
		try {
			if (isDir) {
				// Windows: 先尽量清空再删目录，降低 EPERM
				try {
					const entries = await fs.readdir(abs, { withFileTypes: true });
					for (const ent of entries) {
						const child = path.join(abs, ent.name);
						if (ent.isDirectory()) {
							await rmWithRetry(child, { isDir: true });
						} else {
							await fs.unlink(child).catch(async () => {
								// 只读文件先改权限再删
								try {
									await fs.chmod(child, 0o666);
								} catch {}
								await fs.unlink(child);
							});
						}
					}
				} catch {
					/* ignore listing issues, still try rm */
				}
				await fs.rm(abs, { recursive: true, force: true });
			} else {
				try {
					await fs.unlink(abs);
				} catch (e) {
					if (e?.code === "EPERM" || e?.code === "EACCES" || e?.code === "EBUSY") {
						try {
							await fs.chmod(abs, 0o666);
						} catch {}
						await fs.unlink(abs);
					} else {
						throw e;
					}
				}
			}
			return;
		} catch (e) {
			lastErr = e;
			const code = e?.code;
			if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY" && code !== "ENOTEMPTY") {
				throw e;
			}
			await sleep(40 * (i + 1));
		}
	}
	const msg = lastErr?.message || String(lastErr);
	const code = lastErr?.code ? ` [${lastErr.code}]` : "";
	throw new Error(`删除失败${code}: ${abs} — ${msg}`);
}

async function deleteFile(rel) {
	const { abs, rel: r } = safeResolve(rel);
	let st;
	try {
		st = await fs.stat(abs);
	} catch (e) {
		if (e?.code === "ENOENT") return { ok: true, path: r, missing: true };
		throw e;
	}
	const isDir = st.isDirectory();
	await rmWithRetry(abs, { isDir });
	await invalidateContentStore(r, viteServer, abs);
	return { ok: true, path: r, type: isDir ? "dir" : "file" };
}

async function mkdirPath(rel) {
	const { abs, rel: r } = safeResolve(rel);
	// 仅允许相册等公开目录
	if (!(r.startsWith("public/images/") || r.startsWith("public/uploads/"))) {
		throw new Error("mkdir 路径不允许: " + r);
	}
	await fs.mkdir(abs, { recursive: true });
	return { ok: true, path: r, type: "dir" };
}

/**
 * Windows 上 Astro MutableDataStore 写 .astro/data-store.json 时
 * rename(.tmp → 目标) 常因文件被占用抛 EPERM → UnknownFilesystemError。
 * 文章本身通常已由 /api/admin 写成功；此处给 rename/copy 加本地重试，压掉噪声。
 */
function patchFsRenameForAstroStore() {
	const key = "__aaaxm_patch_astro_datastore_rename__";
	if (globalThis[key]) return;
	globalThis[key] = true;

	const origRename = fs.rename.bind(fs);
	const origCopy = fs.copyFile.bind(fs);
	const origUnlink = fs.unlink.bind(fs);

	const isDataStoreTarget = (dest) => {
		const s = String(dest || "").replace(/\\/g, "/");
		return s.endsWith("/.astro/data-store.json") || s.endsWith(".astro/data-store.json");
	};

	fs.rename = async (oldPath, newPath) => {
		if (!isDataStoreTarget(newPath)) {
			return origRename(oldPath, newPath);
		}
		let lastErr;
		for (let i = 0; i < 12; i++) {
			try {
				await origRename(oldPath, newPath);
				return;
			} catch (e) {
				lastErr = e;
				const code = e?.code;
				if (code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") {
					// 其他错误仍走 copy 兜底一次
					if (code === "ENOENT") throw e;
				}
				try {
					await origCopy(oldPath, newPath);
					await origUnlink(oldPath).catch(() => {});
					return;
				} catch (e2) {
					lastErr = e2;
					await new Promise((r) => setTimeout(r, 40 * (i + 1)));
				}
			}
		}
		// 最后仍失败则抛出，但多数情况下 copy 已成功
		throw lastErr;
	};
}

async function cleanupAstroTmp() {
	const dir = path.join(ROOT, ".astro");
	try {
		const entries = await fs.readdir(dir);
		await Promise.all(
			entries
				.filter((n) => n.endsWith(".tmp") || n.endsWith(".tmp.tmp"))
				.map((n) => fs.unlink(path.join(dir, n)).catch(() => {})),
		);
	} catch {
		/* ignore */
	}
}


function mimeByExt(filePath) {
	const ext = path.extname(String(filePath || "")).toLowerCase();
	const map = {
		".jpg": "image/jpeg",
		".jpeg": "image/jpeg",
		".png": "image/png",
		".gif": "image/gif",
		".webp": "image/webp",
		".svg": "image/svg+xml",
		".ico": "image/x-icon",
		".avif": "image/avif",
		".bmp": "image/bmp",
		".mp3": "audio/mpeg",
		".mp4": "video/mp4",
		".json": "application/json",
		".txt": "text/plain; charset=utf-8",
	};
	return map[ext] || "application/octet-stream";
}

async function servePublicUpload(req, res, pathname) {
	// /uploads/... 与 /images/... 直接读 public，避免 Vite 未监听到新文件导致 404
	if (req.method !== "GET" && req.method !== "HEAD") return false;
	let decoded;
	try {
		decoded = decodeURIComponent(pathname);
	} catch {
		decoded = pathname;
	}
	if (!(decoded.startsWith("/uploads/") || decoded.startsWith("/images/"))) {
		return false;
	}
	const rel = `public${decoded}`.replace(/\\/g, "/").replace(/\/+/g, "/");
	if (rel.includes("..")) return false;
	let abs;
	try {
		({ abs } = safeResolve(rel));
	} catch {
		return false;
	}
	try {
		const st = await fs.stat(abs);
		if (!st.isFile()) return false;
		res.statusCode = 200;
		res.setHeader("Content-Type", mimeByExt(abs));
		res.setHeader("Content-Length", String(st.size));
		res.setHeader("Cache-Control", "no-store");
		if (req.method === "HEAD") {
			res.end();
			return true;
		}
		const buf = await fs.readFile(abs);
		res.end(buf);
		return true;
	} catch {
		return false;
	}
}


async function runGit(args, { timeout = 120000, env: extraEnv = {} } = {}) {
	try {
		const { stdout, stderr } = await execFileAsync("git", args, {
			cwd: ROOT,
			timeout,
			windowsHide: true,
			maxBuffer: 8 * 1024 * 1024,
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0",
				// 国内网络/代理下 HTTP/2 常出现 Connection was reset
				GIT_HTTP_VERSION: process.env.GIT_HTTP_VERSION || "HTTP/1.1",
				...extraEnv,
			},
		});
		return {
			ok: true,
			code: 0,
			stdout: String(stdout || ""), // keep leading spaces for git porcelain
			stderr: String(stderr || "").trim(),
		};
	} catch (e) {
		return {
			ok: false,
			code: typeof e?.code === "number" ? e.code : 1,
			stdout: String(e?.stdout || ""),
			stderr: String(e?.stderr || e?.message || e).trim(),
		};
	}
}

/** 推送前尽量把 git 调成更稳的 HTTP 设置（仅本仓库，不改全局） */
async function ensureGitHttpSettings() {
	// 这些设置可显著降低 Connection was reset / schannel 失败
	const pairs = [
		["http.version", "HTTP/1.1"],
		["http.postBuffer", "524288000"],
		["http.lowSpeedLimit", "0"],
		["http.lowSpeedTime", "999999"],
	];
	for (const [k, v] of pairs) {
		const cur = await runGit(["config", "--get", k]);
		if (!cur.ok || cur.stdout.trim() !== v) {
			await runGit(["config", k, v]);
		}
	}
}

/** 解码 git status 引号路径（C 风格八进制转义） */
function decodeGitPath(raw) {
	let file = String(raw || "").trim();
	if (file.startsWith('"') && file.endsWith('"') && file.length >= 2) {
		const body = file.slice(1, -1);
		const bytes = [];
		for (let i = 0; i < body.length; i++) {
			const c = body[i];
			if (c !== "\\") {
				const code = c.charCodeAt(0);
				if (code <= 0xff) bytes.push(code);
				else {
					const enc = new TextEncoder().encode(c);
					for (const b of enc) bytes.push(b);
				}
				continue;
			}
			const n = body[i + 1];
			if (n === undefined) {
				bytes.push(0x5c);
				break;
			}
			if (n >= "0" && n <= "7") {
				let oct = n;
				let j = i + 2;
				while (j < body.length && oct.length < 3 && body[j] >= "0" && body[j] <= "7") {
					oct += body[j++];
				}
				bytes.push(parseInt(oct, 8) & 0xff);
				i = j - 1;
				continue;
			}
			const map = {
				"\\": 0x5c,
				'"': 0x22,
				n: 0x0a,
				r: 0x0d,
				t: 0x09,
				a: 0x07,
				b: 0x08,
				f: 0x0c,
				v: 0x0b,
			};
			if (n in map) bytes.push(map[n]);
			else bytes.push(n.charCodeAt(0) & 0xff);
			i += 1;
		}
		try {
			file = new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
		} catch {
			file = body;
		}
	}
	// 仅统一路径分隔符；用 split/join 避免正则转义坑
	return file.split("\\").join("/");
}

function parseGitStatusPorcelain(text) {
	// 优先支持 -z（NUL 分隔、路径不转义），兼容普通换行输出
	const raw = String(text || "");
	if (raw.includes("\0")) {
		const files = [];
		let i = 0;
		while (i < raw.length) {
			if (raw[i] === "\0") {
				i += 1;
				continue;
			}
			if (i + 3 > raw.length) break;
			const xy = raw.slice(i, i + 2);
			if (raw[i + 2] !== " ") {
				const next = raw.indexOf("\0", i);
				if (next < 0) break;
				i = next + 1;
				continue;
			}
			i += 3;
			const nul = raw.indexOf("\0", i);
			let path = nul < 0 ? raw.slice(i) : raw.slice(i, nul);
			i = nul < 0 ? raw.length : nul + 1;
			// rename/copy: 紧跟第二个路径
			if (/R|C/.test(xy)) {
				const nul2 = raw.indexOf("\0", i);
				path = nul2 < 0 ? raw.slice(i) : raw.slice(i, nul2);
				i = nul2 < 0 ? raw.length : nul2 + 1;
			}
			path = decodeGitPath(path);
			if (path) files.push({ status: xy.trim(), path });
		}
		return files;
	}

	const lines = raw
		.split(/\r?\n/)
		.map((l) => l.trimEnd())
		.filter(Boolean);
	const files = [];
	for (const line of lines) {
		// XY<path> or XY origin -> path
		const xy = line.slice(0, 2);
		let file = line.slice(3).trim();
		if (file.includes(" -> ")) file = file.split(" -> ").pop().trim();
		file = decodeGitPath(file);
		if (file) files.push({ status: xy.trim(), path: file });
	}
	return files;
}

async function gitStatusSummary() {
	const branch = await runGit(["rev-parse", "--abbrev-ref", "HEAD"]);
	const porcelain = await runGit(["status", "--porcelain", "-z"]);
	const upstream = await runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
	const remoteUrl = await runGit(["config", "--get", "remote.origin.url"]);
	const files = porcelain.ok ? parseGitStatusPorcelain(porcelain.stdout) : [];
	let ahead = 0;
	let behind = 0;
	if (upstream.ok && upstream.stdout) {
		const ab = await runGit(["rev-list", "--left-right", "--count", "HEAD...@{u}"]);
		if (ab.ok) {
			const parts = ab.stdout.trim().split(/\s+/).map((x) => Number(x) || 0);
			ahead = parts[0] || 0;
			behind = parts[1] || 0;
		}
	}
	return {
		ok: branch.ok,
		branch: branch.ok ? branch.stdout.trim() : "",
		upstream: upstream.ok ? upstream.stdout.trim() : "",
		remoteUrl: remoteUrl.ok ? remoteUrl.stdout.trim() : "",
		files,
		count: files.length,
		ahead,
		behind,
		dirty: files.length > 0,
		error: branch.ok ? "" : branch.stderr || "git 不可用",
	};
}

/** 允许随「推送到 GitHub」提交的路径（含 src/public，避免只推文章 md 导致 Pages 渲染逻辑不更新） */
const PUSH_PATHSPECS = [
	"src",
	"public",
	"scripts",
	".github/workflows",
	"astro.config.mjs",
	"package.json",
	"pnpm-lock.yaml",
	"tsconfig.json",
	"svelte.config.js",
	"tailwind.config.cjs",
	"postcss.config.mjs",
	"pagefind.yml",
	"vercel.json",
	".gitignore",
	"README.md",
];

function isPushablePath(filePath) {
	const path = String(filePath || "").split("\\").join("/");
	return PUSH_PATHSPECS.some((p) => path === p || path.startsWith(p + "/"));
}

/**
 * 推送后台可改内容到 origin。
 * 用目录 pathspec 做 git add -A，不逐文件拼路径：
 * 这样文章/追番/友链/相册/上传图/中文文件名/删除/重命名都不会漏。
 */
async function gitPushContent({ message } = {}) {
	const status = await gitStatusSummary();
	if (!status.ok) {
		return { ok: false, error: status.error || "git 不可用", status };
	}

	const scoped = await runGit(["status", "--porcelain", "-z", "--", ...PUSH_PATHSPECS]);
	const scopedFiles = scoped.ok ? parseGitStatusPorcelain(scoped.stdout) : [];
	const relevant = scopedFiles.filter((f) => isPushablePath(f.path));

	if (!relevant.length && status.ahead === 0) {
		return {
			ok: true,
			noop: true,
			message: "没有可推送的内容变更",
			status: { ...status, files: relevant, count: relevant.length, dirty: false },
		};
	}

	const steps = [];
	if (relevant.length || scopedFiles.length) {
		const add = await runGit(["add", "-A", "--", ...PUSH_PATHSPECS]);
		steps.push({
			step: "add",
			...add,
			files: relevant.map((f) => f.path),
			pathspecs: PUSH_PATHSPECS,
		});
		if (!add.ok) {
			return { ok: false, error: add.stderr || "git add 失败", steps, status };
		}
		const msg =
			String(message || "").trim() ||
			`admin: publish ${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
		const commit = await runGit(["commit", "-m", msg]);
		steps.push({ step: "commit", ...commit });
		if (!commit.ok && !/nothing to commit/i.test(commit.stdout + commit.stderr)) {
			return {
				ok: false,
				error: commit.stderr || commit.stdout || "git commit 失败",
				steps,
				status,
			};
		}
	}

	const push = await pushWithRetry();
		steps.push(...push.steps);
		if (!push.ok) {
			return {
				ok: false,
				error: push.error,
				steps,
				status: await gitStatusSummary(),
			};
		}

		return {
			ok: true,
			noop: false,
			message: "已推送到 GitHub。请等 1–2 分钟后打开 https://pandac222.github.io/ 并 Ctrl+F5；构建：https://github.com/pandaC222/pandaC222.github.io/actions",
			steps,
			status: await gitStatusSummary(),
		};
	}

	async function pushWithRetry() {
		await ensureGitHttpSettings();
		const steps = [];
		const attempts = [
			{ args: ["-c", "http.version=HTTP/1.1", "push", "-u", "origin", "HEAD"], label: "push-http1.1" },
			{ args: ["-c", "http.version=HTTP/1.1", "push", "origin", "HEAD"], label: "push-http1.1-no-u" },
			{ args: ["push", "-u", "origin", "HEAD"], label: "push-default" },
		];
		let last = null;
		for (let i = 0; i < attempts.length; i++) {
			const a = attempts[i];
			const res = await runGit(a.args, { timeout: 240000 });
			steps.push({ step: a.label, ...res });
			last = res;
			if (res.ok) return { ok: true, steps, result: res };
			const err = String(res.stderr || "") + "\n" + String(res.stdout || "");
			const retriable =
				/Connection was reset|Recv failure|schannel|TLS|SSL|EOF|timed out|Failed to connect|Could not resolve|RPC failed|HTTP\/2/i.test(
					err,
				);
			if (!retriable) break;
			await sleep(600 * (i + 1));
		}
		const detail = last?.stderr || last?.stdout || "git push failed";
		const tip = [
			"",
			"",
			"Network tip: github connection reset. Try proxy.",
			"1) enable system proxy",
			"2) git -c http.version=HTTP/1.1 push origin HEAD",
			"3) git remote set-url origin git@github.com:pandaC222/pandaC222.github.io.git",
		].join("\n");
		return { ok: false, steps, error: detail + tip };
	}


function isPrivateHost(hostname) {
	const h = String(hostname || "").toLowerCase();
	if (!h) return true;
	if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
	const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (m) {
		const a = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])];
		if (a[0] === 10 || a[0] === 127 || a[0] === 0) return true;
		if (a[0] === 169 && a[1] === 254) return true;
		if (a[0] === 192 && a[1] === 168) return true;
		if (a[0] === 172 && a[1] >= 16 && a[1] <= 31) return true;
	}
	if (h === "::1" || h.startsWith("fc") || h.startsWith("fd") || h.startsWith("fe80")) return true;
	return false;
}

function absUrl(base, maybe) {
	try {
		return new URL(maybe, base).href;
	} catch {
		return "";
	}
}

function pickAttr(tag, name) {
	const re = new RegExp(name + "\\s*=\\s*[\"']([^\"']+)[\"']", "i");
	const m = String(tag || "").match(re);
	return m ? m[1].trim() : "";
}

function extractSiteMeta(html, pageUrl) {
	const text = String(html || "");
	const title = (
		text.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
		text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ||
		text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ||
		""
	)
		.replace(/\s+/g, " ")
		.trim();
	const description = (
		text.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
		text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] ||
		text.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
		""
	)
		.replace(/\s+/g, " ")
		.trim();
	const icons = [];
	const iconRe = /<link[^>]+rel=["']([^"']*icon[^"']*)["'][^>]*>/gi;
	let m;
	while ((m = iconRe.exec(text))) {
		const href = pickAttr(m[0], "href");
		if (href) icons.push(absUrl(pageUrl, href));
	}
	const iconRe2 = /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']([^"']*icon[^"']*)["'][^>]*>/gi;
	while ((m = iconRe2.exec(text))) {
		icons.push(absUrl(pageUrl, m[1]));
	}
	const ogImage =
		text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ||
		text.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ||
		"";
	if (ogImage) icons.push(absUrl(pageUrl, ogImage));
	try {
		const u = new URL(pageUrl);
		icons.push(`${u.origin}/favicon.ico`);
		icons.push(`${u.origin}/favicon.png`);
		icons.push(`${u.origin}/apple-touch-icon.png`);
	} catch {
		/* ignore */
	}
	return {
		title,
		description,
		icons: [...new Set(icons.filter(Boolean))],
	};
}

async function fetchWithTimeout(url, { timeout = 8000, headers = {} } = {}) {
	const ac = new AbortController();
	const t = setTimeout(() => ac.abort(), timeout);
	try {
		return await fetch(url, {
			signal: ac.signal,
			redirect: "follow",
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; pandac-admin-bot/1.0; +local-dev)",
				Accept: "*/*",
				...headers,
			},
		});
	} finally {
		clearTimeout(t);
	}
}

async function downloadIconToUploads(iconUrl) {
	const res = await fetchWithTimeout(iconUrl, {
		timeout: 8000,
		headers: { Accept: "image/*,*/*" },
	});
	if (!res.ok) throw new Error(`图标下载失败 ${res.status}`);
	const ctype = String(res.headers.get("content-type") || "").toLowerCase();
	const buf = Buffer.from(await res.arrayBuffer());
	if (!buf.length) throw new Error("图标为空");
	if (buf.length > 1.5 * 1024 * 1024) throw new Error("图标过大");
	let ext = ".png";
	if (ctype.includes("jpeg") || ctype.includes("jpg")) ext = ".jpg";
	else if (ctype.includes("webp")) ext = ".webp";
	else if (ctype.includes("gif")) ext = ".gif";
	else if (ctype.includes("svg")) ext = ".svg";
	else if (ctype.includes("icon") || ctype.includes("x-icon")) ext = ".ico";
	else {
		const u = iconUrl.toLowerCase();
		if (u.includes(".ico")) ext = ".ico";
		else if (u.includes(".jpg") || u.includes(".jpeg")) ext = ".jpg";
		else if (u.includes(".webp")) ext = ".webp";
		else if (u.includes(".svg")) ext = ".svg";
		else if (u.includes(".gif")) ext = ".gif";
	}
	const head = buf.subarray(0, 32).toString("utf8").toLowerCase();
	if (head.includes("<!doctype") || head.includes("<html")) {
		throw new Error("返回的不是图片");
	}
	const rel = `public/uploads/friends/${Date.now()}-favicon${ext}`;
	const put = await putFile(rel, buf.toString("base64"));
	const publicPath = "/" + rel.replace(/^public\//, "");
	return {
		publicPath,
		sha: put?.content?.sha || "",
		bytes: buf.length,
		contentType: ctype,
	};
}

async function fetchSiteMeta(rawUrl) {
	let pageUrl = String(rawUrl || "").trim();
	if (!pageUrl) throw new Error("请填写网址");
	if (!/^https?:\/\//i.test(pageUrl)) pageUrl = "https://" + pageUrl;
	let u;
	try {
		u = new URL(pageUrl);
	} catch {
		throw new Error("网址格式不正确");
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") {
		throw new Error("仅支持 http/https");
	}
	if (isPrivateHost(u.hostname)) {
		throw new Error("出于安全考虑，不能抓取内网/本地地址");
	}

	const warnings = [];
	let html = "";
	let finalUrl = pageUrl;
	try {
		const res = await fetchWithTimeout(pageUrl, {
			timeout: 10000,
			headers: { Accept: "text/html,application/xhtml+xml,*/*" },
		});
		if (!res.ok) throw new Error(`页面请求失败 ${res.status}`);
		finalUrl = res.url || pageUrl;
		const ab = await res.arrayBuffer();
		const slice = ab.byteLength > 1024 * 1024 ? ab.slice(0, 1024 * 1024) : ab;
		html = Buffer.from(slice).toString("utf8");
	} catch (e) {
		warnings.push(`页面抓取失败：${e?.message || e}`);
		html = "";
	}

	const meta = html
		? extractSiteMeta(html, finalUrl)
		: {
				title: "",
				description: "",
				icons: (() => {
					try {
						const o = new URL(finalUrl);
						return [`${o.origin}/favicon.ico`, `${o.origin}/apple-touch-icon.png`];
					} catch {
						return [];
					}
				})(),
			};

	let iconLocal = "";
	let iconRemote = "";
	const tried = [];
	for (const icon of meta.icons.slice(0, 8)) {
		tried.push(icon);
		try {
			const saved = await downloadIconToUploads(icon);
			iconLocal = saved.publicPath;
			iconRemote = icon;
			break;
		} catch {
			/* try next */
		}
	}
	if (!iconLocal) {
		warnings.push("未能下载站点图标，请手动上传头像");
		iconRemote = meta.icons[0] || "";
	}

	return {
		ok: true,
		url: finalUrl,
		title: meta.title || u.hostname,
		description: meta.description || "",
		icon: iconLocal || iconRemote || "",
		iconLocal: iconLocal || "",
		iconRemote: iconRemote || "",
		tried,
		warnings,
	};
}


function parseBilibiliMediaId(input) {
	const s = String(input || "").trim();
	if (!s) return "";
	const m =
		s.match(/\/md(\d+)/i) ||
		s.match(/media_id=(\d+)/i) ||
		s.match(/ss(\d+)/i) ||
		s.match(/^(\d{2,})$/);
	return m ? m[1] : "";
}

function extractStudioFromStaff(staff) {
	const text = String(staff || "");
	if (!text) return "";
	const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean);
	const prefer = ["动画制作", "制作公司", "製作", "制作"];
	for (const key of prefer) {
		const line = lines.find((l) => l.startsWith(key) || l.includes(key + "：") || l.includes(key + ":"));
		if (line) {
			const v = line.split(/[:：]/).slice(1).join("：").trim();
			if (v) return v.split(/[\/、,，\s]/)[0].trim() || v;
		}
	}
	// 原作 as author fallback
	const origin = lines.find((l) => l.startsWith("原作"));
	if (origin) {
		const v = origin.split(/[:：]/).slice(1).join("：").trim();
		if (v) return v.split(/[\/、,，\s]/)[0].trim() || v;
	}
	return "";
}

function extractYear(publish = {}) {
	const candidates = [
		publish.pub_date,
		publish.release_date,
		publish.pub_time,
		publish.pub_date_show,
		publish.release_date_show,
		publish.pub_time_show,
	];
	for (const c of candidates) {
		const m = String(c || "").match(/(20\d{2}|19\d{2})/);
		if (m) return m[1];
	}
	return "";
}

function normalizeStyles(styles) {
	if (!Array.isArray(styles)) return [];
	return styles
		.map((x) => (typeof x === "string" ? x : x?.name || ""))
		.map((x) => String(x).trim())
		.filter(Boolean);
}

function normalizeAreas(areas) {
	if (!Array.isArray(areas)) return [];
	return areas
		.map((x) => (typeof x === "string" ? x : x?.name || ""))
		.map((x) => String(x).trim())
		.filter(Boolean);
}

async function biliGetJson(url) {
	const res = await fetch(url, {
		headers: {
			"User-Agent":
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
			Referer: "https://www.bilibili.com",
			Accept: "application/json,text/plain,*/*",
		},
	});
	if (!res.ok) throw new Error(`B站接口 HTTP ${res.status}`);
	return res.json();
}

async function fetchBilibiliBangumiMeta(raw) {
	const mediaId = parseBilibiliMediaId(raw);
	if (!mediaId) throw new Error("无法识别 B 站 media id，请粘贴含 md数字 的链接或纯数字");

	// 1) media 详情（含 evaluate / styles / staff / publish）
	const mediaResp = await biliGetJson(
		`https://api.bilibili.com/pgc/view/web/media?media_id=${mediaId}`,
	);
	if (mediaResp?.code !== 0) {
		throw new Error(mediaResp?.message || `media 接口失败 code=${mediaResp?.code}`);
	}
	const media = mediaResp.result?.media || mediaResp.result || {};
	const seasonId = media.season_id || mediaId;

	// 2) season 详情（含 total / episodes / new_ep.desc）
	let season = {};
	try {
		const seasonResp = await biliGetJson(
			`https://api.bilibili.com/pgc/view/web/season?season_id=${seasonId}`,
		);
		if (seasonResp?.code === 0) season = seasonResp.result || {};
	} catch {
		/* season optional */
	}

	const title = season.title || media.title || media.origin_name || "";
	const cover = String(season.cover || media.cover || "")
		.replace(/^http:\/\//i, "https://");
	const description = String(season.evaluate || media.evaluate || "")
		.replace(/\r/g, "")
		.trim();
	const rating = Number(season.rating?.score || media.rating?.score || 0) || 0;

	const styles = normalizeStyles(season.styles?.length ? season.styles : media.styles);
	const areas = normalizeAreas(season.areas?.length ? season.areas : media.areas);
	const staff = season.staff || media.staff || "";
	const studio = extractStudioFromStaff(staff) || areas[0] || "";

	const publish = season.publish || media.publish || {};
	const year = extractYear(publish);

	let totalEpisodes =
		Number(season.total) ||
		(Array.isArray(season.episodes) ? season.episodes.length : 0) ||
		0;
	// media.episode_index sometimes has totals
	if (!totalEpisodes && media.episode_index?.index) {
		const n = Number(String(media.episode_index.index).replace(/\D/g, ""));
		if (n > 0) totalEpisodes = n;
	}

	const episodes =
		season.new_ep?.desc ||
		publish.time_length_show ||
		media.publish?.time_length_show ||
		(totalEpisodes ? `全${totalEpisodes}话` : media.new_ep?.index_show || "") ||
		"";

	// if total still 0, try parse from episodes text 全26话
	if (!totalEpisodes && episodes) {
		const m = String(episodes).match(/全\s*(\d+)\s*话/);
		if (m) totalEpisodes = Number(m[1]) || 0;
	}

	const startDate = String(publish.pub_date || publish.pub_time || "").slice(0, 10);
	const endDate = Number(publish.is_finish) === 1 ? startDate : "";

	const link =
		season.link ||
		season.share_url ||
		`https://www.bilibili.com/bangumi/media/md${mediaId}`;

	// 作者：优先原作
	let author = "";
	const originLine = String(staff)
		.split(/\n+/)
		.find((l) => l.includes("原作"));
	if (originLine) {
		author = originLine.split(/[:：]/).slice(1).join("：").trim();
	}

	return {
		ok: true,
		title,
		cover,
		description,
		link,
		rating,
		episodes,
		totalEpisodes,
		year,
		studio,
		author,
		status: "planned",
		progress: 0,
		startDate,
		endDate,
		genre: styles.length ? styles : areas,
		mediaId: String(mediaId),
		seasonId: String(seasonId),
		staff,
		areas,
	};
}

export function adminLocalApiPlugin() {
	return {
		name: "admin-local-api",
		configureServer(server) {
			viteServer = server;
			patchFsRenameForAstroStore();
			cleanupAstroTmp();

			// 降低 Windows 上 content store / 依赖目录被 watcher 锁住的干扰
			const ignoreGlobs = [
				// 不 unwatch 整个 .astro：data-store.json 变更是文章前台刷新的关键信号
				path.join(ROOT, "node_modules/**"),
				"**/node_modules/**",
				path.join(ROOT, "public/uploads"),
				path.join(ROOT, "public/uploads/**"),
				"**/public/uploads/**",
			];
			try {
				server.watcher?.unwatch?.(ignoreGlobs);
				try {
					const watchAdds = [
							path.join(ROOT, "src", "content", "posts"),
							path.join(ROOT, "src", "content", "spec"),
							path.join(ROOT, "src", "content", "admin"),
							path.join(ROOT, ".astro", "data-store.json"),
						];
						for (const w of watchAdds) {
							try {
								server.watcher?.add?.(w);
							} catch {
								/* ignore */
							}
						}
				} catch {
					/* ignore */
				}
			} catch {
				/* ignore */
			}
			// 部分 Vite 版本用 ignored 更稳
			try {
				const ignored = server.config?.server?.watch?.ignored;
				// 只记录，真正 ignored 在 astro.config 里配
				void ignored;
			} catch {
				/* ignore */
			}

			const handler = async (req, res, next) => {
				try {
					const url = new URL(req.url || "/", "http://127.0.0.1");
					// Astro trailingSlash=always 可能带尾斜杠
					const pathname = url.pathname.replace(/\/+$/, "") || "/";
						if (await servePublicUpload(req, res, pathname)) return;
						if (!pathname.startsWith("/api/admin")) return next();
					if (!isLocalRequest(req)) {
						return sendJson(res, 403, {
							error: "仅允许本机 localhost 访问本地管理 API",
						});
					}

					res.setHeader("Cache-Control", "no-store");

					if (pathname === "/api/admin/ping" && req.method === "GET") {
						return sendJson(res, 200, {
							ok: true,
							mode: "local",
							root: ROOT,
						});
					}

					if (pathname === "/api/admin/list" && req.method === "GET") {
						const p = url.searchParams.get("path") || "";
						const data = await listDir(p);
						return sendJson(res, 200, data);
					}

					if (pathname === "/api/admin/file" && req.method === "GET") {
						const p = url.searchParams.get("path") || "";
						const data = await getFile(p);
						if (!data) return sendJson(res, 404, { error: "not found" });
						return sendJson(res, 200, data);
					}

					if (pathname === "/api/admin/file" && req.method === "PUT") {
						const body = await readBody(req);
						const p = body.path || "";
						let b64 = body.contentBase64;
						if (!b64 && typeof body.content === "string") {
							b64 = Buffer.from(body.content, "utf8").toString("base64");
						}
						if (!p) return sendJson(res, 400, { error: "missing path" });
						const data = await putFile(p, b64);
						return sendJson(res, 200, data);
					}

					if (pathname === "/api/admin/file" && req.method === "DELETE") {
						let p = url.searchParams.get("path") || "";
						if (!p && req.method === "DELETE") {
							try {
								const body = await readBody(req);
								p = body.path || "";
							} catch {
								/* ignore */
							}
						}
						if (!p) return sendJson(res, 400, { error: "missing path" });
						const data = await deleteFile(p);
						return sendJson(res, 200, data);
					}

					if (pathname === "/api/admin/git/status" && req.method === "GET") {
						const data = await gitStatusSummary();
						return sendJson(res, data.ok ? 200 : 500, data);
					}

					if (pathname === "/api/admin/git/push" && req.method === "POST") {
						const body = await readBody(req).catch(() => ({}));
						const data = await gitPushContent({ message: body?.message });
						return sendJson(res, data.ok ? 200 : 500, data);
					}

					if (pathname === "/api/admin/fetch-site-meta" && req.method === "POST") {
						const body = await readBody(req).catch(() => ({}));
						try {
							const data = await fetchSiteMeta(body?.url || body?.siteurl || "");
							return sendJson(res, 200, data);
						} catch (e) {
							return sendJson(res, 400, {
								ok: false,
								error: e?.message || String(e),
							});
						}
					}

					if (pathname === "/api/admin/fetch-bilibili-bangumi" && req.method === "POST") {
						const body = await readBody(req).catch(() => ({}));
						try {
							const data = await fetchBilibiliBangumiMeta(
								body?.url || body?.mediaId || body?.id || "",
							);
							return sendJson(res, 200, data);
						} catch (e) {
							return sendJson(res, 400, {
								ok: false,
								error: e?.message || String(e),
							});
						}
					}

					if (pathname === "/api/admin/mkdir" && req.method === "POST") {
						const body = await readBody(req).catch(() => ({}));
						const dir = body.path || body.dir || "";
						if (!dir) return sendJson(res, 400, { error: "missing path" });
						try {
							const data = await mkdirPath(dir);
							return sendJson(res, 200, data);
						} catch (e) {
							return sendJson(res, 400, { error: e?.message || String(e) });
						}
					}

					return sendJson(res, 404, { error: "unknown admin api", pathname });
				} catch (e) {
					return sendJson(res, 500, {
						error: e?.message || String(e),
					});
				}
			};

			// 必须插到中间件栈最前，否则 Astro trailingSlash/404 会先吃掉 /api/admin
			return () => {
				server.middlewares.use(handler);
				const stack = server.middlewares.stack;
				const layer = stack.pop();
				if (layer) stack.unshift(layer);
			};
		},
	};
}

export default adminLocalApiPlugin;
