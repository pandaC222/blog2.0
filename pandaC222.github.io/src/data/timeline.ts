// 时间线数据：src/content/admin/timeline.yml（/admin 可编辑）
import type { TimelineItem } from "../components/features/timeline/types";
import { loadTimelineData } from "../utils/load-admin-config";

export const timelineData: TimelineItem[] =
	loadTimelineData() as TimelineItem[];
