import { Plugin } from "obsidian";
import { GraphLeafWithCustomRenderer } from "./interfaces/GraphLeafWithCustomRenderer";
import { GraphNestedTagsSettings, DEFAULT_SETTINGS } from "./settings";
import { GraphNestedTagsSettingTab } from "./settingsTab";


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
				
				// 添加颜色信息到节点
				this.addColorInfoToNodes(nodes);
				
				// 调用原始setData方法
				return leafRenderer.originalSetData?.(data);
			} catch (error) {
				console.error("Graph Nested Tags Plugin Error:", error);
				return leafRenderer.originalSetData?.(data);
			}
		};
		return graphLeaf;
	}
	
	// 验证颜色值是否有效
	validateColor(color: any): string {
		if (!color || 
			typeof color !== 'string' || 
			color === 'undefined' || 
			color === 'null' || 
			color.trim() === '' ||
			!color.match(/^#[0-9A-Fa-f]{6}$/)) {
			return '#2563eb'; // 默认蓝色
		}
		return color.trim();
	}

	// 在数据层面为节点添加颜色信息
	addColorInfoToNodes(nodes: any) {
		
		if (!this.settings.enableCustomColors) {
			return;
		}
		
		try {
			for (const nodeId in nodes) {
				const node = nodes[nodeId];
				let rawColor = this.getNodeColor(nodeId, node);
				
				// 验证并清理颜色值
				const color = this.validateColor(rawColor);
				
				// 将颜色信息添加到节点数据中
				node.color = color;
				node.customColor = color;
				// 不直接设置tint属性，让Obsidian的图形系统处理颜色
				
				console.log(`Applied color to ${nodeId}: ${color}`);
			}
		} catch (error) {
			console.error("Color processing error:", error);
		}
	}
	
	// 将颜色应用到DOM元素
	applyColorsToDOM(nodes: any) {
		if (!this.settings.enableCustomColors) {
			return;
		}
		
		try {
			// 查找图谱画布
			const graphCanvas = document.querySelector('.graph-view .view-content canvas');
			if (!graphCanvas) {
				console.log("Graph canvas not found, retrying...");
				setTimeout(() => this.applyColorsToDOM(nodes), 200);
				return;
			}
			
			// 应用CSS样式
			this.injectGraphStyles(nodes);
			
			// 监听DOM变化以重新应用样式
			this.observeGraphChanges(nodes);
			
		} catch (error) {
			console.error("Error applying colors to DOM:", error);
		}
	}
	
	// 注入图谱样式
	injectGraphStyles(nodes: any) {
		// 移除旧的样式
		const existingStyle = document.getElementById('graph-nested-tags-colors');
		if (existingStyle) {
			existingStyle.remove();
		}
		
		// 创建新的样式
		const style = document.createElement('style');
		style.id = 'graph-nested-tags-colors';
		
		let css = '';
		
		for (const nodeId in nodes) {
			const node = nodes[nodeId];
			if (node.color) {
				const cleanId = nodeId.replace(/[^\w-]/g, '\\$&');
				css += `
					.graph-view [data-path="${cleanId}"] .graph-node,
					.graph-view .graph-node[data-node-id="${cleanId}"],
					.graph-view .graph-node[title="${nodeId}"],
					.graph-view .graph-node[aria-label="${nodeId}"] {
						fill: ${node.color} !important;
						stroke: ${this.darkenColor(node.color)} !important;
					}
				`;
			}
		}
		
		style.textContent = css;
		document.head.appendChild(style);
	}
	
	// 监听图谱DOM变化
	observeGraphChanges(nodes: any) {
		// 移除旧的观察器
		if (this.graphObserver) {
			this.graphObserver.disconnect();
		}
		
		const graphContainer = document.querySelector('.graph-view');
		if (!graphContainer) return;
		
		this.graphObserver = new MutationObserver(() => {
			this.applyDirectNodeColors(nodes);
		});
		
		this.graphObserver.observe(graphContainer, {
			childList: true,
			subtree: true,
			attributes: true
		});
	}
	
	// 直接应用节点颜色
	applyDirectNodeColors(nodes: any) {
		for (const nodeId in nodes) {
			const node = nodes[nodeId];
			if (node.color) {
				// 尝试多种选择器找到节点
				const selectors = [
					`[data-path="${nodeId}"]`,
					`[data-node-id="${nodeId}"]`,
					`[title="${nodeId}"]`,
					`[aria-label="${nodeId}"]`
				];
				
				for (const selector of selectors) {
					const elements = document.querySelectorAll(`.graph-view ${selector}`);
					elements.forEach((el: HTMLElement) => {
						el.style.setProperty('fill', node.color, 'important');
						el.style.setProperty('stroke', this.darkenColor(node.color), 'important');
					});
				}
			}
		}
	}
	
	private graphObserver?: MutationObserver;

	// 确定节点颜色的逻辑
	getNodeColor(nodeId: string, node: any): string {
		// 确保settings和colors都存在
		if (!this.settings || !this.settings.colors) {
			return '#2563eb'; // 默认蓝色
		}
		
		// 检查自定义节点名颜色
		if (this.settings.enableCustomNodeColors && this.settings.customNodeColors) {
			for (const customColor of this.settings.customNodeColors) {
				if (customColor.enabled && customColor.nodeName && customColor.nodeName.trim()) {
					const targetName = customColor.nodeName.trim();
					
					// 检查各种匹配模式
					if (nodeId === targetName || 
						nodeId === targetName + '.md' ||
						nodeId.replace('.md', '') === targetName ||
						nodeId.includes(targetName) ||
						(node.name && node.name === targetName) ||
						(node.displayText && node.displayText === targetName)) {
						console.log(`Custom color match: ${targetName} -> ${customColor.color}`);
						return customColor.color && customColor.color.trim() ? customColor.color : (this.settings.colors.fileNodes || '#2563eb');
					}
				}
			}
		}
		
		// 检查数字节点颜色
		if (nodeId === '1') return this.settings.colors.childLevel1 || '#fb923c';
		if (nodeId === '2') return this.settings.colors.childLevel2 || '#ea580c';
		if (nodeId === '3') return this.settings.colors.childLevel3 || '#dc2626';
		
		// 根据节点类型设置颜色
		if (node.nodeType === 'root-tag') return this.settings.colors.rootTags || '#16a34a';
		if (node.nodeType === 'child-node') {
			if (node.level === 1) return this.settings.colors.childLevel1 || '#fb923c';
			if (node.level === 2) return this.settings.colors.childLevel2 || '#ea580c';
			if (node.level === 3) return this.settings.colors.childLevel3 || '#dc2626';
		}
		if (node.type === 'tag') return this.settings.colors.rootTags || '#16a34a';
		
		// 默认文件颜色，确保不返回undefined
		return this.settings.colors.fileNodes || '#2563eb';
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new GraphNestedTagsSettingTab(this.app, this));

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
		// 清理DOM观察器
		if (this.graphObserver) {
			this.graphObserver.disconnect();
		}
		
		// 移除注入的样式
		const existingStyle = document.getElementById('graph-nested-tags-colors');
		if (existingStyle) {
			existingStyle.remove();
		}
		
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
		
		// 确保向后兼容性 - 如果没有新的设置字段，则使用默认值
		if (!this.settings.customNodeColors) {
			this.settings.customNodeColors = [];
		}
		if (this.settings.enableCustomNodeColors === undefined) {
			this.settings.enableCustomNodeColors = true;
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateGraphColors() {
		console.log("=== updateGraphColors called - using data layer approach ===");
		console.log("enableCustomColors:", this.settings.enableCustomColors);
		console.log("colors:", this.settings.colors);
		
		// 数据层面的颜色处理，不需要DOM操作
		// 颜色信息已经在setData拦截时添加到节点数据中
	}



	// 辅助函数：将颜色变暗用于边框
	darkenColor(color: string): string {
		// 简单的颜色变暗算法
		const hex = color.replace('#', '');
		const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 30);
		const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 30);
		const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 30);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}
}