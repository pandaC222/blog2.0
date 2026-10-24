/* Client-only views and comments for local blog2.
 * Does not change existing markup. Views reuse .umami-page-views.
 * Comments are inserted where the theme's comment card would be,
 * using the same card-base classes, and only after the API responds.
 */
(function () {
	// 本地开发前台在 4321、后端在 3000，不同源只能写死；
	// 生产环境 nginx 把 /api 反代到后端，同源即可，所以留空。
	const API_ORIGIN = location.port === "4321" ? "http://localhost:3000" : "";
	const recentViews = new Map();

	function slugFrom(value) {
		let slug = String(value || "");
		try {
			slug = decodeURIComponent(slug);
		} catch {
			/* keep the raw value */
		}
		slug = slug.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^posts\//, "");
		slug = slug.replace(/\/+$/, "").replace(/\.md$/i, "");
		return slug;
	}

	function currentSlug() {
		const fromId = document.querySelector(".umami-page-views")?.dataset.id;
		if (fromId) return slugFrom(fromId);
		const parts = location.pathname.split("/").filter(Boolean);
		if (parts[0] !== "posts") return "";
		return slugFrom(parts.slice(1).join("/"));
	}

	function countView(slug) {
		const hit = recentViews.get(slug);
		if (hit && Date.now() - hit.at < 2000) return hit.promise;
		const promise = fetch(
			`${API_ORIGIN}/api/posts/${encodeURIComponent(slug)}/view`,
			{ method: "POST" },
		).then(async (response) => {
			if (!response.ok) throw new Error(String(response.status));
			return response.json();
		});
		recentViews.set(slug, { at: Date.now(), promise });
		return promise;
	}

	window.oddmisc = window.oddmisc || {};
	window.oddmisc.getStats = (pathname) =>
		countView(slugFrom(pathname)).then((data) => ({
			pageviews: data.views || 0,
			visits: data.views || 0,
		}));

	function showViews(count) {
		const container = document.querySelector(".umami-page-views");
		const display = container?.querySelector(".page-views-display");
		if (!container || !display || !count) return;
		const lang = (document.documentElement.lang || "zh").toLowerCase();
		display.textContent = lang.startsWith("zh")
			? `浏览量 ${count} · 访问次数 ${count}`
			: `Views ${count} · Visits ${count}`;
		container.classList.remove("hidden");
	}

	function decodeEntities(value) {
		const node = document.createElement("textarea");
		node.innerHTML = String(value ?? "");
		return node.value;
	}

	function formatTime(value) {
		const match = String(value).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
		return match ? `${match[1]} ${match[2]}` : String(value || "");
	}

	function renderComments(list, comments) {
		list.replaceChildren();
		if (!comments.length) {
			const empty = document.createElement("p");
			empty.className = "text-sm text-neutral-500 dark:text-neutral-400";
			empty.textContent = "还没有评论";
			list.append(empty);
			return;
		}
		for (const comment of comments) {
			const item = document.createElement("div");
			item.className = "py-3 border-[var(--line-divider)] border-dashed border-b";
			const meta = document.createElement("div");
			meta.className = "text-sm text-neutral-500 dark:text-neutral-400 mb-2";
			const author = document.createElement("span");
			author.className = "font-medium text-black/90 dark:text-white/90";
			author.textContent = decodeEntities(comment.author);
			meta.append(author);
			if (comment.is_admin) meta.append(document.createTextNode(" · 管理员"));
			meta.append(document.createTextNode(` · ${formatTime(comment.created_at)}`));
			const body = document.createElement("p");
			body.className = "text-black/90 dark:text-white/90";
			body.textContent = decodeEntities(comment.content);
			item.append(meta, body);
			list.append(item);
		}
	}

	function fillCommentCard(section, slug, comments) {
		section.hidden = false;
		section.replaceChildren();

		const title = document.createElement("div");
		title.className = "font-bold mb-3 text-black/90 dark:text-white/90";
		title.textContent = "评论";

		const list = document.createElement("div");
		list.dataset.blogCommentList = "1";
		renderComments(list, comments);

		const form = document.createElement("form");
		form.className = "mt-4 flex flex-col gap-4";

		const author = document.createElement("input");
		author.className = "px-3 py-2 rounded-lg bg-[var(--btn-regular-bg)] text-sm";
		author.name = "author";
		author.maxLength = 64;
		author.required = true;
		author.placeholder = "昵称";

		const content = document.createElement("textarea");
		content.className = "px-3 py-2 rounded-lg bg-[var(--btn-regular-bg)] text-sm";
		content.name = "content";
		content.rows = 4;
		content.maxLength = 2000;
		content.required = true;
		content.placeholder = "说点什么";

		const button = document.createElement("button");
		button.className = "btn-regular self-start px-4 py-2 rounded-lg text-sm font-medium";
		button.type = "submit";
		button.textContent = "发送";

		const message = document.createElement("p");
		message.className = "text-sm text-neutral-500 dark:text-neutral-400";

		form.append(author, content, button, message);
		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			button.disabled = true;
			message.textContent = "";
			try {
				const response = await fetch(
					`${API_ORIGIN}/api/posts/${encodeURIComponent(slug)}/comments`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							author: author.value,
							content: content.value,
						}),
					},
				);
				const data = await response.json().catch(() => ({}));
				if (!response.ok) {
					message.textContent = data.error || "发送失败";
					return;
				}
				author.value = "";
				content.value = "";
				message.textContent = "已提交，通过审核后显示";
				const next = await fetch(
					`${API_ORIGIN}/api/posts/${encodeURIComponent(slug)}/comments`,
				);
				const payload = await next.json();
				renderComments(list, payload.comments || []);
			} catch {
				message.textContent = "发送失败";
			} finally {
				button.disabled = false;
			}
		});

		section.append(title, list, form);
	}

	async function mount() {
		const post = document.getElementById("post-container");
		if (!post || post.__blogDynamic) return;
		const slug = currentSlug();
		if (!slug) return;
		post.__blogDynamic = true;

		countView(slug)
			.then((data) => showViews(data.views))
			.catch(() => {});

		const anchor = post.closest(".mb-4");
		if (!anchor || anchor.parentElement?.querySelector("[data-blog-comments]")) return;

		try {
			const response = await fetch(
				`${API_ORIGIN}/api/posts/${encodeURIComponent(slug)}/comments`,
			);
			if (!response.ok) return;
			const payload = await response.json();
			const section = document.createElement("div");
			section.className = "card-base p-6 mb-4";
			section.dataset.blogComments = "1";
			section.hidden = true;
			anchor.insertAdjacentElement("afterend", section);
			fillCommentCard(section, slug, payload.comments || []);
		} catch {
			/* leave the page unchanged when the API is down */
		}
	}

	function watchSwup(tries) {
		if (window.swup?.hooks && !window.swup.__blogDynamic) {
			window.swup.__blogDynamic = true;
			window.swup.hooks.on("content:replace", mount);
			return;
		}
		if (tries > 0) setTimeout(() => watchSwup(tries - 1), 250);
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", mount);
	} else {
		mount();
	}
	watchSwup(40);
})();
