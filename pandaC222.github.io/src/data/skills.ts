// 技能数据：src/content/admin/skills.yml（/admin 可编辑）
import {
	type SkillItem,
	loadSkillsData,
} from "../utils/load-admin-config";

export type Skill = SkillItem;

export const skillsData: Skill[] = loadSkillsData();
