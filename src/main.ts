import { Plugin } from "obsidian";
import { GraphLeafWithCustomRenderer } from "./interfaces/GraphLeafWithCustomRenderer";
import { GraphNestedTagsSettings, DEFAULT_SETTINGS } from "./settings";


export default class GraphNestedTagsPlugin extends Plugin {
	settings!: GraphNestedTagsSettings;

	// inject our own wrapper around graphLeaf.view.renderer.setData
	// which will manipulate add tag -> subtag hierarchy  
	inject_setData(graphLeaf: GraphLeafWithCustomRenderer) {
		const leafRenderer = graphLeaf.view.renderer;

		if (leafRenderer.originalSetData == undefined) {
			leafRenderer.originalSetData = leafRenderer.setData;
		}

		leafRenderer.setData = (data: any) => {
			try {
				const nodes = data.nodes;
				const nestedTags = [];
				
				// 收集所有嵌套标签
				for (const id in nodes) {
					if (nodes[id].type === "tag" && id.includes("|")) {
						nestedTags.push(id);
					}
				}
				
				// 处理每个嵌套标签
				for (const nestedTagId of nestedTags) {
					const tagParts = nestedTagId.split("|");
					
					// 创建层级结构中的每个标签节点
					for (let i = 0; i < tagParts.length; i++) {
						const currentTag = tagParts[i];
						const cleanName = currentTag.replace(/^#/, '');
						
						if (!(currentTag in nodes)) {
							nodes[currentTag] = {
								type: "tag",
								links: {},
								path: cleanName,
								name: cleanName,
								displayText: cleanName,
								// 添加更多可能影响显示的属性
								title: cleanName,
								label: cleanName,
								text: cleanName,
								id: currentTag,  // 保持原始ID用于引用
								displayName: cleanName
							};
						} else {
							// 如果节点已存在，也要更新显示属性以移除#符号
							const existingNode = nodes[currentTag];
							existingNode.path = cleanName;
							existingNode.name = cleanName;
							existingNode.displayText = cleanName;
							existingNode.title = cleanName;
							existingNode.label = cleanName;
							existingNode.text = cleanName;
							existingNode.displayName = cleanName;
						}
						
						// 建立父子连接
						if (i > 0) {
							const parentTag = tagParts[i - 1];
							if (!nodes[parentTag].links) nodes[parentTag].links = {};
							if (!nodes[currentTag].links) nodes[currentTag].links = {};
							
							nodes[parentTag].links[currentTag] = true;
							nodes[currentTag].links[parentTag] = true;
						}
					}
					
					// 将文件连接转移到叶子节点（最后一个子节点）
					const leafTagName = tagParts[tagParts.length - 1];
					for (const nodeId in nodes) {
						const node = nodes[nodeId];
						if (node.links && node.links[nestedTagId]) {
							if (!nodes[leafTagName].links) nodes[leafTagName].links = {};
							node.links[leafTagName] = node.links[nestedTagId];
							delete node.links[nestedTagId];
						}
					}
					
					// 删除原始嵌套标签
					delete nodes[nestedTagId];
				}
				
				// 最后清理所有标签节点，确保移除#符号
				for (const nodeId in nodes) {
					const node = nodes[nodeId];
					if (node.type === "tag" && nodeId.startsWith("#")) {
						const cleanName = nodeId.replace(/^#/, '');
						node.path = cleanName;
						node.name = cleanName;
						node.displayText = cleanName;
						node.title = cleanName;
						node.label = cleanName;
						node.text = cleanName;
						node.displayName = cleanName;
					}
				}
				
				// 调用原始setData方法
				return leafRenderer.originalSetData?.(data);
			} catch (error) {
				console.error("Graph Nested Tags Plugin Error:", error);
				return leafRenderer.originalSetData?.(data);
			}
		};
		return graphLeaf;
	}
	

	async onload() {
		await this.loadSettings();

		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				for (const leaf of this.app.workspace.getLeavesOfType("graph")) {
					if ((leaf as GraphLeafWithCustomRenderer).view.renderer.originalSetData === undefined) {
						this.inject_setData(leaf as GraphLeafWithCustomRenderer);
					}
				}
			})
		);
	}

	onunload() {
		// undo injections and reload the Graphs
		for (const leaf of this.app.workspace.getLeavesOfType(
			"graph"
		) as GraphLeafWithCustomRenderer[]) {
			if (leaf.view.renderer.originalSetData) {
				leaf.view.renderer.setData = leaf.view.renderer.originalSetData;
				delete leaf.view.renderer.originalSetData;
				leaf.view.unload();
				leaf.view.load();
			}
		}
	}

	async loadSettings() {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}