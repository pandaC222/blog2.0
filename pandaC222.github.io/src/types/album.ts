export interface Photo {
	id?: string;
	src: string;
	/** 原始文件名（本地相册才有），用于 info.json 的 order 排序 */
	file?: string;
	alt?: string;
	title?: string;
	thumbnail?: string;
	tags?: string[];
	description?: string;
	date?: string;
	location?: string;
	width?: number;
	height?: number;
}

export interface AlbumGroup {
	id: string;
	title: string;
	description?: string;
	cover: string;
	date: string;
	location?: string;
	tags?: string[];
	photos: Photo[];
}
