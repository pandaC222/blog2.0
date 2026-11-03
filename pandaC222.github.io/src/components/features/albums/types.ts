import type { AlbumGroup } from "../../../types/album";

export interface AlbumCardProps {
	album: AlbumGroup;
}

export interface PhotoCardProps {
	src: string;
	/** 列表缩略图，留空则用 src */
	thumb?: string;
	alt?: string;
	albumId: string;
}
