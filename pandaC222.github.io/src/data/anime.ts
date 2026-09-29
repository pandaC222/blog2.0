// 番剧数据：src/content/admin/anime.yml（/admin 可编辑）
import {
	type AnimeItemData,
	loadAnimeData,
} from "../utils/load-admin-config";

export type AnimeItem = AnimeItemData;

const localAnimeList: AnimeItem[] = loadAnimeData();

export default localAnimeList;
