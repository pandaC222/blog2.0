// 项目数据：src/content/admin/projects.yml（/admin 可编辑）
import {
	type ProjectItem,
	loadProjectsData,
} from "../utils/load-admin-config";

export type Project = ProjectItem;

export const projectsData: Project[] = loadProjectsData();

export const getProjectStats = () => {
	const total = projectsData.length;
	const completed = projectsData.filter((p) => p.status === "completed").length;
	const inProgress = projectsData.filter(
		(p) => p.status === "in-progress",
	).length;
	const planned = projectsData.filter((p) => p.status === "planned").length;
	return {
		total,
		byStatus: { completed, inProgress, planned },
	};
};

export const getProjectsByCategory = (category?: string) => {
	if (!category || category === "all") return projectsData;
	return projectsData.filter((p) => p.category === category);
};

export const getFeaturedProjects = () =>
	projectsData.filter((p) => p.featured);

export const getAllTechStack = () => {
	const techSet = new Set<string>();
	projectsData.forEach((project) => {
		project.techStack.forEach((tech) => techSet.add(tech));
	});
	return Array.from(techSet).sort();
};
