export interface CustomNodeColor {
	nodeName: string;
	color: string;
	enabled: boolean;
}

export interface GraphNestedTagsSettings {
	colors: {
		fileNodes: string;
		rootTags: string;
		childLevel1: string;
		childLevel2: string;
		childLevel3: string;
	};
	customNodeColors: CustomNodeColor[];
	enableCustomColors: boolean;
	enableCustomNodeColors: boolean;
}

export const DEFAULT_SETTINGS: GraphNestedTagsSettings = {
	colors: {
		fileNodes: '#2563eb',     // 蓝色
		rootTags: '#16a34a',      // 绿色
		childLevel1: '#fb923c',   // 浅橙色
		childLevel2: '#ea580c',   // 深橙色
		childLevel3: '#dc2626'    // 红色
	},
	customNodeColors: [],
	enableCustomColors: true,
	enableCustomNodeColors: true
};