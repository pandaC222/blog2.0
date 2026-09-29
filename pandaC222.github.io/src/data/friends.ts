// 友情链接数据：由 src/content/admin/friends.yml 提供，可在 /admin CMS 编辑
import {
	type FriendItem,
	loadFriendsData,
} from "../utils/load-admin-config";

export type { FriendItem };

export const friendsData: FriendItem[] = loadFriendsData();

export function getFriendsList(): FriendItem[] {
	return friendsData;
}

export function getShuffledFriendsList(): FriendItem[] {
	const shuffled = [...friendsData];
	for (let i = shuffled.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
	}
	return shuffled;
}
