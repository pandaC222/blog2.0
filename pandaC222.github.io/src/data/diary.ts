// 日记数据：src/content/admin/diary.yml（/admin 可编辑）
import {
	type DiaryItemData,
	loadDiaryData,
} from "../utils/load-admin-config";

export type DiaryItem = DiaryItemData;

const diaryData: DiaryItem[] = loadDiaryData();

export const getDiaryList = (limit?: number) => {
	const sortedData = [...diaryData].sort(
		(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
	);
	if (limit && limit > 0) return sortedData.slice(0, limit);
	return sortedData;
};

export const getAllTags = () => {
	const tags = new Set<string>();
	diaryData.forEach((item) => {
		item.tags?.forEach((tag) => tags.add(tag));
	});
	return Array.from(tags).sort();
};
