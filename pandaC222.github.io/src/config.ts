import type {
	AnnouncementConfig,
	CommentConfig,
	ExpressiveCodeConfig,
	FooterConfig,
	FullscreenWallpaperConfig,
	LicenseConfig,
	MusicPlayerConfig,
	NavBarConfig,
	PermalinkConfig,
	ProfileConfig,
	RandomPostsConfig,
	RelatedPostsConfig,
	SakuraConfig,
	ShareConfig,
	SidebarLayoutConfig,
	SiteConfig,
} from "./types/config";
import { LinkPreset } from "./types/config";
import {
	loadAnnouncementConfig,
	loadBannerConfig,
	loadFeaturePages,
	loadMusicConfig,
	loadPioConfig,
	loadProfileConfig,
} from "./utils/load-admin-config";

// 移除i18n导入以避免循环依赖

// 定义站点语言
const SITE_LANG = "zh_CN"; // 语言代码，例如：'en', 'zh_CN', 'ja' 等。
const SITE_TIMEZONE = 8; //设置你的网站时区 from -12 to 12 default in UTC+8
const adminBanner = loadBannerConfig();
export const siteConfig: SiteConfig = {
	title: "pandac'blog",
	subtitle: "希望有朝一日成为算法大蛇",
	siteURL: "https://pandac222.github.io/", // 请替换为你的站点URL，以斜杠结尾
	siteStartDate: "2026-04-04", // 站点开始运行日期，用于站点统计组件计算运行天数

	timeZone: SITE_TIMEZONE,

	lang: SITE_LANG,

	themeColor: {
		hue: 240, // 主题色的默认色相，范围从 0 到 360。例如：红色：0，青色：200，蓝绿色：250，粉色：345
		fixed: false, // 对访问者隐藏主题色选择器
	},

	// 特色页面开关：由 src/content/admin/features.yml 提供，可在 /admin CMS 编辑
	featurePages: loadFeaturePages(),

	// 顶栏标题配置
	navbarTitle: {
		// 显示模式："text-icon" 显示图标+文本，"logo" 仅显示Logo
		mode: "text-icon",
		// 顶栏标题文本
		text: "pandac",
		// 顶栏标题图标路径，默认使用 public/assets/home/home.webp
		icon: "assets/home/now.webp",
		// 网站Logo图片路径
		logo: "assets/home/now.webp",
	},

	// 页面自动缩放配置
	pageScaling: {
		enable: true, // 是否开启自动缩放
		targetWidth: 2000, // 目标宽度，低于此宽度时开始缩放
	},

	bangumi: {
		userId: "sai", // 在此处设置你的Bangumi用户ID，可以设置为 "sai" 测试
		fetchOnDev: false, // 是否在开发环境下获取 Bangumi 数据（默认 false），获取前先执行 pnpm build 构建 json 文件
	},

	bilibili: {
		vmid: "3546699205184332", // 在此处设置你的Bilibili用户ID (uid)，例如 "1129280784"
		fetchOnDev: false, // 是否在开发环境下获取 Bilibili 数据（默认 false）
		coverMirror: "", // 封面图片镜像源（可选，如果需要使用镜像源，例如 "https://images.weserv.nl/?url="）
		useWebp: true, // 是否使用WebP格式（默认 true）

		// bilibili 观看进度配置说明(可选，如需配置仔细阅读):
		// 1. 本地开发：请在 .env 文件中填写 BILI_SESSDATA=your_SESSDATA
		// 2. 远程构建：请在 GitHub 仓库 Settings -> Secrets 中添加 BILI_SESSDATA
		// 注意：SESSDATA 为账号凭证，为防止泄露，切记不可使用硬编码。
		// 安全提示：如 SESSDATA 已泄露，请打开 B站手机端 —— 我的 —— 设置 —— 安全隐私 —— 登陆设备管理 —— 一键退登，销毁已泄露的账号凭证
	},

	anime: {
		mode: "local", // 番剧页面模式："bangumi" 使用Bangumi API，"local" 使用本地配置，"bilibili" 使用Bilibili API
	},

	// 文章列表布局配置
	postListLayout: {
		// 默认布局模式："list" 列表模式（单列布局），"grid" 网格模式（双列布局）
		// 注意：如果侧边栏配置启用了"both"双侧边栏，则无法使用文章列表"grid"网格（双列）布局
		defaultMode: "list",
		// 是否允许用户切换布局
		allowSwitch: true,
		// 文章列表页分类导航条配置
		categoryBar: {
			enable: true, // 是否在文章列表页显示分类导航条
		},
	},

	// 标签样式配置
	tagStyle: {
		// 是否使用新样式（悬停高亮样式）还是旧样式（外框常亮样式）
		useNewStyle: false,
	},

	// 壁纸模式配置
	wallpaperMode: {
		// 默认壁纸模式：banner=顶部横幅，fullscreen=全屏壁纸，none=无壁纸
		defaultMode: "banner",
		// 整体布局方案切换按钮显示设置（默认："desktop"）
		// "off" = 不显示
		// "mobile" = 仅在移动端显示
		// "desktop" = 仅在桌面端显示
		// "both" = 在所有设备上显示
		showModeSwitchOnMobile: "desktop",
	},

	banner: {
		// 横幅图与首页文案：src/content/admin/banner.yml，可在 /admin CMS 编辑
		src: {
			desktop: adminBanner.desktop,
			...(adminBanner.mobile.length > 0 ? { mobile: adminBanner.mobile } : {}),
		},

		position: "center", // 等同于 object-position，仅支持 'top', 'center', 'bottom'。默认为 'center'

		carousel: {
			enable: adminBanner.carousel.enable,
			interval: adminBanner.carousel.interval,
		},

		waves: {
			enable: true, // 是否启用水波纹效果（注意：此功能性能开销较大）
			performanceMode: false, // 性能模式：减少动画复杂度(性能提升40%)
			mobileDisable: false, // 移动端禁用
		},

		// PicFlow API支持(智能图片API)
		imageApi: {
			enable: false, // 启用图片API
			url: "http://domain.com/api_v2.php?format=text&count=4", // API地址，返回每行一个图片链接的文本
		},
		// 这里需要使用PicFlow API的Text返回类型,所以我们需要format=text参数
		// 项目地址:https://github.com/matsuzaka-yuki/PicFlow-API
		// 请自行搭建API

		homeText: {
			enable: adminBanner.homeText.enable,
			title: adminBanner.homeText.title,
			subtitle: adminBanner.homeText.subtitle,
			typewriter: {
				enable: adminBanner.homeText.typewriter.enable,
				speed: adminBanner.homeText.typewriter.speed,
				deleteSpeed: adminBanner.homeText.typewriter.deleteSpeed,
				pauseTime: adminBanner.homeText.typewriter.pauseTime,
			},
		},

		credit: {
			enable: false, // 显示横幅图片来源文本

			text: "Describe", // 要显示的来源文本
			url: "", // （可选）原始艺术品或艺术家页面的 URL 链接
		},

		navbar: {
			transparentMode: "semifull", // 导航栏透明模式："semi" 半透明加圆角，"full" 完全透明，"semifull" 动态透明
		},
	},
	toc: {
		enable: true, // 总开关，启用目录功能
		mobileTop: true, // 手机端顶部 TOC 按钮
		desktopSidebar: false, // 电脑端右侧边栏 TOC
		floating: false, // 悬浮 TOC 按钮
		depth: 2, // 目录深度，1-6，1 表示只显示 h1 标题，2 表示显示 h1 和 h2 标题，依此类推
		useJapaneseBadge: false, // 使用日语假名标记（あいうえお...）代替数字，开启后会将 1、2、3... 改为 あ、い、う...
	},
	showCoverInContent: true, // 在文章内容页显示文章封面
	generateOgImages: false, // 启用生成OpenGraph图片功能,注意开启后要渲染很长时间，不建议本地调试的时候开启
	favicon: [
		// 留空以使用默认 favicon
		{
			src: "/favicon/QQ20260404-181343.png", // 图标文件路径
			theme: "light", // 可选，指定主题 'light' | 'dark'
			sizes: "32x32", // 可选，图标大小
		},
	],

	// 字体配置
	font: {
		// 注意：自定义字体需要在 src/styles/main.css 中引入字体文件
		// 注意：字体子集优化功能目前仅支持 TTF 格式字体,开启后需要在生产环境才能看到效果,在Dev环境下显示的是浏览器默认字体!
		asciiFont: {
			// 英文字体 - 优先级最高
			// 指定为英文字体则无论字体包含多大范围，都只会保留 ASCII 字符子集
			fontFamily: "ZenMaruGothic-Medium",
			fontWeight: "400",
			localFonts: ["ZenMaruGothic-Medium.ttf"],
			enableCompress: true, // 启用字体子集优化，减少字体文件大小
		},
		cjkFont: {
			// 中日韩字体 - 作为回退字体
			fontFamily: "萝莉体 第二版",
			fontWeight: "500",
			localFonts: ["loli.ttf"],
			enableCompress: true, // 启用字体子集优化，减少字体文件大小
		},
	},
	showLastModified: true, // 控制"上次编辑"卡片显示的开关
	pageProgressBar: {
		enable: true, // 启用页面顶部进度条
		height: 3, // 进度条高度 3px
		duration: 6000, // 动画时长 6s
	},

	thirdPartyAnalytics: {
		enable: false, // 是否启用第三方统计（Microsoft Clarity），默认关闭，启用可能影响 Lighthouse 评分
		clarityId: "", // Clarity 项目 ID
	},
};
export const fullscreenWallpaperConfig: FullscreenWallpaperConfig = {
	src: {
		desktop: [
			"/assets/desktop-banner/6.webp",
			"/assets/desktop-banner/7.webp",
			"/assets/desktop-banner/8.webp",
			"/assets/desktop-banner/9.webp",
			"/assets/desktop-banner/10.webp",
			"/assets/desktop-banner/11.webp",
			"/assets/desktop-banner/12.webp",
		], // 桌面横幅图片
		// mobile: [
		// 	// "/assets/mobile-banner/5.webp",
		// 	// "/assets/mobile-banner/2.webp",
		// 	// "/assets/mobile-banner/3.webp",
		// 	// "/assets/mobile-banner/4.webp",
		// ], // 移动横幅图片
	}, // 使用本地横幅图片
	position: "center", // 壁纸位置，等同于 object-position
	carousel: {
		enable: true, // 启用轮播
		interval: 5, // 轮播间隔时间（秒）
	},
	zIndex: -1, // 层级，确保壁纸在背景层
	opacity: 0.8, // 壁纸透明度
	blur: 1, // 背景模糊程度
};

// 导航里的特色页：跟随 src/content/admin/features.yml（后台「模块开关」）
const featurePages = siteConfig.featurePages;
const featureNavChildren = [
	featurePages.anime && {
		name: "Anime",
		url: "/anime/",
		icon: "material-symbols:movie",
	},
	featurePages.diary && {
		name: "Diary",
		url: "/diary/",
		icon: "material-symbols:book",
	},
	featurePages.albums && {
		name: "Gallery",
		url: "/albums/",
		icon: "material-symbols:photo-library",
	},
	featurePages.devices && {
		name: "Devices",
		url: "/devices/",
		icon: "material-symbols:devices",
	},
	featurePages.friends && {
		name: "Friends",
		url: "/friends/",
		icon: "material-symbols:group",
	},
	featurePages.projects && {
		name: "Projects",
		url: "/projects/",
		icon: "material-symbols:work",
	},
	featurePages.skills && {
		name: "Skills",
		url: "/skills/",
		icon: "material-symbols:psychology",
	},
	featurePages.timeline && {
		name: "Timeline",
		url: "/timeline/",
		icon: "material-symbols:timeline",
	},
].filter(Boolean) as {
	name: string;
	url: string;
	icon: string;
}[];

export const navBarConfig: NavBarConfig = {
	links: [
		LinkPreset.Home,
		LinkPreset.Archive,
		// 支持自定义导航栏链接，支持多级菜单
		{
			name: "Links",
			url: "/links/",
			icon: "material-symbols:link",
			children: [
				{
					name: "GitHub",
					url: "https://github.com/pandaC222",
					external: true,
					icon: "fa7-brands:github",
				},
				{
					name: "Bilibili",
					url: "https://space.bilibili.com/3546699205184332",
					external: true,
					icon: "fa7-brands:bilibili",
				},
			],
		},
		// 仅当至少开启一个模块时显示 My 菜单
		...(featureNavChildren.length
			? [
					{
						name: "My",
						url: featureNavChildren[0].url,
						icon: "material-symbols:person",
						children: featureNavChildren,
					},
				]
			: []),
		{
			name: "About",
			url: "/about/",
			icon: "material-symbols:info",
		},
	],
};

// 个人资料：由 src/content/admin/profile.yml 提供，可在 /admin CMS 编辑
// avatar 以 / 开头时相对于 public（推荐 CMS 上传到 public/uploads）
export const profileConfig: ProfileConfig = loadProfileConfig();

export const licenseConfig: LicenseConfig = {
	enable: false,
	name: "CC BY-NC-SA 4.0",
	url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};

// Permalink 固定链接配置
export const permalinkConfig: PermalinkConfig = {
	enable: false, // 是否启用全局 permalink 功能，关闭时使用默认的文件名作为链接
	/**
	 * permalink 格式模板
	 * 支持的占位符：
	 * - %year% : 4位年份 (2024)
	 * - %monthnum% : 2位月份 (01-12)
	 * - %day% : 2位日期 (01-31)
	 * - %hour% : 2位小时 (00-23)
	 * - %minute% : 2位分钟 (00-59)
	 * - %second% : 2位秒数 (00-59)
	 * - %post_id% : 文章序号（按发布时间升序排列，最早的文章为1）
	 * - %postname% : 文章文件名（slug，通常为全小写）
	 * - %raw_postname% : 文章原始文件名（保留大小写）
	 * - %category% : 分类名（无分类时为 "uncategorized"）
	 *
	 * 示例：
	 * - "%year%-%monthnum%-%postname%" => "/2024-12-my-post/"
	 * - "%post_id%-%postname%" => "/42-my-post/"
	 * - "%category%-%postname%" => "/tech-my-post/"
	 * - "%year%/%monthnum%/%day%/%postname%" => "/2024/12/01/my-post/"
	 *
	 * 注意：支持使用斜杠 "/" 构建嵌套路径。
	 */
	format: "%postname%", // 默认使用文件名
};

export const expressiveCodeConfig: ExpressiveCodeConfig = {
	// 注意：某些样式（如背景颜色）已被覆盖，请参阅 astro.config.mjs 文件。
	// 请选择深色主题，因为此博客主题目前仅支持深色背景
	theme: "github-dark",
	// 是否在主题切换时隐藏代码块以避免卡顿问题
	hideDuringThemeTransition: true,
};

export const commentConfig: CommentConfig = {
	enable: false, // 启用评论功能。当设置为 false 时，评论组件将不会显示在文章区域。
	system: "twikoo", // 评论系统选择: "twikoo" | "giscus"
	twikoo: {
		envId: "https://twikoo.vercel.app",
		lang: SITE_LANG,
	},
	giscus: {
		repo: "your-github-username/your-repo-name",
		repoId: "your-repo-id",
		category: "Announcements",
		categoryId: "your-category-id",
		mapping: "pathname",
		strict: "0",
		reactionsEnabled: "1",
		emitMetadata: "0",
		inputPosition: "top",
		theme: "preferred_color_scheme",
		lang: SITE_LANG,
		loading: "lazy",
	},
};

export const shareConfig: ShareConfig = {
	enable: false, // 启用分享功能
};

// 公告：由 src/content/admin/announcement.yml 提供，可在 /admin CMS 编辑
export const announcementConfig: AnnouncementConfig = loadAnnouncementConfig();

// 音乐播放器：src/content/admin/music.yml，可在 /admin 编辑
const adminMusic = loadMusicConfig();
export const musicPlayerConfig: MusicPlayerConfig = {
	enable: adminMusic.enable,
	showFloatingPlayer: adminMusic.showFloatingPlayer,
	floatingEntryMode: adminMusic.floatingEntryMode,
	mode: adminMusic.mode,
	meting_api: adminMusic.meting_api,
	id: adminMusic.id,
	server: adminMusic.server,
	type: adminMusic.type,
};

export const footerConfig: FooterConfig = {
	// 页脚自定义内容。Footer.astro 读这个字段，为空则整块不渲染（不占位）。
	// 大陆备案要求页脚展示备案号并链接到工信部查询页。
	enable: true,
	customHtml: `<a href="https://beian.miit.gov.cn/" target="_blank" rel="noopener noreferrer">豫ICP备2026051917号</a>`,
};

/**
 * 侧边栏布局配置
 * 用于控制侧边栏组件的显示、排序、动画和响应式行为
 * sidebar: 控制组件所在的侧边栏（left 或 right）。注意：移动端通常不显示右侧栏内容。若组件设置在 right，请确保 layout.position 为 "both"。
 */
export const sidebarLayoutConfig: SidebarLayoutConfig = {
	// 侧边栏组件属性配置列表
	properties: [
		{
			// 组件类型：用户资料组件
			type: "profile",
			// 组件位置："top" 表示固定在顶部
			position: "top",
			// CSS 类名，用于应用样式和动画
			class: "onload-animation",
			// 动画延迟时间（毫秒），用于错开动画效果
			animationDelay: 0,
		},
		{
			// 组件类型：公告组件
			type: "announcement",
			// 组件位置："top" 表示固定在顶部
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 50,
		},
		// {
		// 	// 组件类型：侧栏音乐组件
		// 	type: "music-sidebar",
		// 	position: "sticky",
		// 	class: "onload-animation",
		// 	animationDelay: 100,
		// },
		{
			// 组件类型：分类组件
			type: "categories",
			// 组件位置："sticky" 表示粘性定位，可滚动
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 150,
			// 响应式配置
			responsive: {
				// 折叠阈值：当分类数量超过5个时自动折叠
				collapseThreshold: 5,
			},
		},
		{
			// 组件类型：标签组件
			type: "tags",
			// 组件位置："sticky" 表示粘性定位
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 250,
			// 响应式配置
			responsive: {
				// 折叠阈值：当标签数量超过20个时自动折叠
				collapseThreshold: 20,
			},
		},
		{
			// 组件类型：卡片式目录组件
			type: "card-toc",
			// 组件位置
			position: "sticky",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 200,
		},
		{
			// 组件类型：站点统计组件
			type: "site-stats",
			// 组件位置
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 200,
		},
		{
			// 组件类型：日历组件(移动端不显示)
			type: "calendar",
			// 组件位置
			position: "top",
			// CSS 类名
			class: "onload-animation",
			// 动画延迟时间
			animationDelay: 250,
		},
	],

	// 侧栏组件布局配置
	components: {
		left: ["profile", "announcement", "tags", "card-toc"],
		right: ["site-stats", "calendar", "categories"],
		drawer: [
			"profile",
			"announcement",
			// "music-sidebar",
			"categories",
			"tags",
		],
	},

	// 默认动画配置
	defaultAnimation: {
		// 是否启用默认动画
		enable: true,
		// 基础延迟时间（毫秒）
		baseDelay: 0,
		// 递增延迟时间（毫秒），每个组件依次增加的延迟
		increment: 50,
	},

	// 响应式布局配置
	responsive: {
		// 断点配置（像素值）
		breakpoints: {
			// 移动端断点：屏幕宽度小于768px
			mobile: 768,
			// 平板端断点：屏幕宽度小于1280px
			tablet: 1280,
			// 桌面端断点：屏幕宽度大于等于1280px
			desktop: 1280,
		},
	},
};

export const sakuraConfig: SakuraConfig = {
	enable: false, // 默认关闭樱花特效
	sakuraNum: 21, // 樱花数量
	limitTimes: -1, // 樱花越界限制次数，-1为无限循环
	size: {
		min: 0.5, // 樱花最小尺寸倍数
		max: 1.1, // 樱花最大尺寸倍数
	},
	opacity: {
		min: 0.3, // 樱花最小不透明度
		max: 0.9, // 樱花最大不透明度
	},
	speed: {
		horizontal: {
			min: -1.7, // 水平移动速度最小值
			max: -1.2, // 水平移动速度最大值
		},
		vertical: {
			min: 1.5, // 垂直移动速度最小值
			max: 2.2, // 垂直移动速度最大值
		},
		rotation: 0.03, // 旋转速度
		fadeSpeed: 0.03, // 消失速度，不应大于最小不透明度
	},
	zIndex: 100, // 层级，确保樱花在合适的层级显示
};

// 看板娘：src/content/admin/pio.yml，可在 /admin 编辑
const adminPio = loadPioConfig();
export const pioConfig: import("./types/config").PioConfig = {
	enable: adminPio.enable,
	models: adminPio.models,
	position: adminPio.position,
	width: adminPio.width,
	height: adminPio.height,
	mode: adminPio.mode as any,
	hiddenOnMobile: adminPio.hiddenOnMobile,
	dialog: {
		welcome: adminPio.dialog.welcome || "",
		touch: adminPio.dialog.touch || [],
		home: adminPio.dialog.home || "",
		skin: adminPio.dialog.skin || [],
		close: adminPio.dialog.close || "",
		link: adminPio.dialog.link || "",
	},
};

// 相关文章配置
export const relatedPostsConfig: RelatedPostsConfig = {
	enable: true,
	maxCount: 5,
};

// 随机文章配置
export const randomPostsConfig: RandomPostsConfig = {
	enable: false,
	maxCount: 5,
};

// 导出所有配置的统一接口
export const widgetConfigs = {
	profile: profileConfig,
	announcement: announcementConfig,
	music: musicPlayerConfig,
	layout: sidebarLayoutConfig,
	sakura: sakuraConfig,
	fullscreenWallpaper: fullscreenWallpaperConfig,
	pio: pioConfig,
	share: shareConfig,
	relatedPosts: relatedPostsConfig,
	randomPosts: randomPostsConfig,
} as const;

// umamiConfig相关配置已移动至astro.config.mjs中,统计脚本请自行在Layout.astro文件的<head>中插入
