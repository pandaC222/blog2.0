// 设备数据：src/content/admin/devices.yml（/admin 可编辑）
import {
	type DeviceItemData,
	loadDevicesData,
} from "../utils/load-admin-config";

export type Device = DeviceItemData;
export type DeviceCategory = Record<string, Device[]> & {
	自定义?: Device[];
};

export const devicesData: DeviceCategory =
	loadDevicesData() as DeviceCategory;
