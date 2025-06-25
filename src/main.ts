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
			const nodes = data.nodes;
			
			console.log("=== Graph Nested Tags Plugin Debug V2 ===");
			console.log("Total nodes:", Object.keys(nodes).length);
			console.log("All data structure:", JSON.stringify(data, null, 2));
			
			// 显示所有节点的详细信息
			for (const id in nodes) {
				const node = nodes[id];
				console.log(`Node "${id}":`, {
					type: node.type,
					links: node.links ? Object.keys(node.links) : "no links",
					linksCount: node.links ? Object.keys(node.links).length : 0,
					allProps: Object.keys(node)
				});
			}
			
			// 收集所有需要处理的嵌套标签
			const nestedTags = [];
			for (const id in nodes) {
				if (nodes[id].type === "tag" && id.includes("|")) {
					nestedTags.push(id);
					console.log("Found nested tag:", id);
					console.log("  - Full node:", JSON.stringify(nodes[id], null, 2));
				}
			}
			
			console.log("Processing", nestedTags.length, "nested tags");
			
			// 首先构建子节点到完整标签路径的映射
			const childNodeTags = new Map(); // 子节点 -> 完整标签路径数组
			
			for (const nestedTagId of nestedTags) {
				const tagParts = nestedTagId.split("|");
				
				// 为每个子节点记录它出现在哪些完整标签路径中
				for (let i = 1; i < tagParts.length; i++) {
					const childNode = tagParts[i];
					if (!childNodeTags.has(childNode)) {
						childNodeTags.set(childNode, []);
					}
					childNodeTags.get(childNode)?.push(nestedTagId);
				}
			}
			
			console.log("Child node mappings:", Array.from(childNodeTags.entries()));
			
			// 处理每个嵌套标签
			for (const nestedTagId of nestedTags) {
				const tagParts = nestedTagId.split("|");
				const originalTagNode = nodes[nestedTagId];
				
				console.log("\n--- Processing nested tag:", nestedTagId);
				console.log("Tag parts:", tagParts);
				console.log("Original node links:", originalTagNode.links ? Object.keys(originalTagNode.links) : "no links");
				
				// 收集所有连接到此嵌套标签的文件
				const connectedFiles = [];
				for (const nodeId in nodes) {
					const node = nodes[nodeId];
					if (node.type !== "tag" && node.links && node.links[nestedTagId]) {
						connectedFiles.push(nodeId);
					}
				}
				console.log("Files connected to", nestedTagId, ":", connectedFiles);
				
				// 1. 处理文件连接 - 转移到根标签
				const rootTagName = tagParts[0];
				
				// 确保根标签存在
				if (!(rootTagName in nodes)) {
					const cleanRootName = rootTagName.replace(/^#/, '');
					nodes[rootTagName] = { 
						type: "tag", 
						links: {},
						// 添加完整的根标签属性
						resolved: true,
						path: cleanRootName,
						id: rootTagName,
						name: cleanRootName,
						displayText: cleanRootName,
						isTag: true,
						tagName: cleanRootName,
						nodeType: "root-tag",
						level: 0,
						cssClass: "tag-root",
						aliases: [rootTagName, cleanRootName],
						// 复制一些可能需要的属性
						...( originalTagNode.resolved ? { resolved: originalTagNode.resolved } : {}),
						...( originalTagNode.path ? { originalPath: originalTagNode.path } : {})
					};
					console.log("Created root tag:", rootTagName, "with clean name:", cleanRootName);
				}
				
				// 查找所有指向此嵌套标签的文件，并将其连接转移到根标签
				console.log("Looking for files that link to:", nestedTagId);
				for (const nodeId in nodes) {
					const node = nodes[nodeId];
					// 检查是否是文件节点且连接到当前嵌套标签
					if (node.type !== "tag" && node.links && node.links[nestedTagId]) {
						console.log("Found file", nodeId, "linked to", nestedTagId);
						
						// 确保根标签的链接对象存在
						if (!nodes[rootTagName].links) nodes[rootTagName].links = {};
						
						// 将文件的连接从嵌套标签转移到根标签
						const connectionValue = node.links[nestedTagId];
						node.links[rootTagName] = connectionValue;
						delete node.links[nestedTagId];
						
						console.log("Moved file connection:", nodeId, "from", nestedTagId, "to", rootTagName);
					}
				}
				
				// 2. 创建标签层级结构，并为叶子节点建立文件连接
				for (let i = 0; i < tagParts.length; i++) {
					const currentTag = tagParts[i];
					
					// 确保当前标签节点存在
					if (!(currentTag in nodes)) {
						// 为子标签节点创建完整的元数据
						const fullTagPath = tagParts.slice(0, i + 1).join("|");
						const tagWithHash = fullTagPath.startsWith("#") ? fullTagPath : "#" + fullTagPath;
						
						// 如果是子节点（数字节点），收集所有使用该子节点的文件
						let displayText = currentTag;
						let searchableText = currentTag;
						let nodeFiles: string[] = [];
						
						if (i > 0 && childNodeTags.has(currentTag)) {
							// 获取所有包含此子节点的完整标签路径
							const relatedPaths = childNodeTags.get(currentTag);
							if (!relatedPaths) continue;
							console.log("Child node", currentTag, "appears in:", relatedPaths);
							
							// 收集使用这些标签路径的所有文件
							const filesSet = new Set();
							for (const tagPath of relatedPaths) {
								// 查找使用此标签路径的文件
								for (const nodeId in nodes) {
									const node = nodes[nodeId];
									if (node.type !== "tag" && node.links && node.links[tagPath]) {
										filesSet.add(nodeId);
									}
								}
							}
							nodeFiles = Array.from(filesSet) as string[];
							
							// 显示文本改为文件列表
							if (nodeFiles.length > 0) {
								searchableText = `${currentTag} (出现在: ${nodeFiles.join(", ")})`;
								console.log("Child node", currentTag, "used by files:", nodeFiles);
							}
						}
						
						// 根据是否为子节点设置不同的属性
						const isChildNode = i > 0;
						const isRootTag = i === 0;
						
						// 处理根标签的显示名称（去掉#号）
						const cleanTagName = isRootTag ? currentTag.replace(/^#/, '') : currentTag;
						
						nodes[currentTag] = { 
							type: "tag",  // 所有节点都保持为 tag 类型
							links: {},
							// 添加节点必要的属性  
							resolved: true,
							path: cleanTagName,  // 根标签去掉#号
							// 让 Obsidian 能够识别这个节点
							id: currentTag,
							name: cleanTagName,  // 根标签去掉#号，子节点保持原样
							displayText: cleanTagName,
							// 添加标签属性
							isTag: true,
							tagName: cleanTagName,
							// 添加颜色和分组信息，便于图谱设置
							nodeType: isChildNode ? "child-node" : "root-tag",
							level: i,
							// 添加 CSS 类，便于样式定制
							cssClass: isChildNode ? `tag-child-level-${i}` : "tag-root",
							// 根据节点类型添加不同的额外属性
							...(isChildNode ? {
								relatedFiles: nodeFiles,
								fileInfo: nodeFiles.length > 0 ? `使用该节点的文件: ${nodeFiles.join(", ")}` : ""
							} : {}),
							// 为搜索功能添加别名
							aliases: [
								currentTag, 
								...nodeFiles,
								...(childNodeTags.has(currentTag) ? (childNodeTags.get(currentTag) || []) : [])
							],
							// 继承原始节点的重要属性，但不覆盖我们设置的
							...(originalTagNode.resolved !== undefined ? { resolved: originalTagNode.resolved } : {}),
							...(originalTagNode.path && i === tagParts.length - 1 ? { originalPath: originalTagNode.path } : {})
						};
						console.log("Created tag node:", currentTag, "with display text:", displayText);
					}
					
					// 如果是叶子节点（最后一个部分），为其建立到文件的连接
					if (i === tagParts.length - 1) {
						console.log("Setting up file connections for leaf node:", currentTag);
						
						// 为叶子节点建立到连接文件的引用
						for (const fileId of connectedFiles) {
							// 在叶子标签节点中添加到文件的连接（但不要修改文件节点，避免重复连接）
							if (!nodes[currentTag].connectedFiles) {
								nodes[currentTag].connectedFiles = [];
							}
							nodes[currentTag].connectedFiles.push(fileId);
							console.log("Added file reference:", fileId, "to leaf node:", currentTag);
						}
					}
					
					// 建立与父标签的连接
					if (i > 0) {
						const parentTag = tagParts[i - 1];
						
						if (!nodes[parentTag].links) nodes[parentTag].links = {};
						if (!nodes[currentTag].links) nodes[currentTag].links = {};
						
						// 建立双向连接
						nodes[parentTag].links[currentTag] = true;
						nodes[currentTag].links[parentTag] = true;
						
						console.log("Connected:", parentTag, "<->", currentTag);
					}
				}
				
				// 3. 删除原始嵌套标签节点
				delete nodes[nestedTagId];
				console.log("Deleted original nested tag:", nestedTagId);
			}
			
			console.log("=== Final Result ===");
			console.log("Final tag nodes:", Object.keys(nodes).filter(id => nodes[id].type === "tag"));
			console.log("File nodes still:", Object.keys(nodes).filter(id => nodes[id].type !== "tag"));
			
			// 验证连接和节点结构
			const tagNodes = Object.keys(nodes).filter(id => nodes[id].type === "tag");
			tagNodes.forEach(tagId => {
				const node = nodes[tagId];
				const links = node.links ? Object.keys(node.links) : [];
				console.log(`Tag "${tagId}":`, {
					connects: links,
					name: node.name,
					path: node.path,
					displayText: node.displayText,
					tagName: node.tagName,
					nodeType: node.nodeType,
					level: node.level,
					cssClass: node.cssClass,
					aliases: node.aliases,
					isTag: node.isTag,
					connectedFiles: node.connectedFiles
				});
			});
			
			// 显示所有节点的完整信息
			console.log("=== All nodes structure ===");
			for (const nodeId in nodes) {
				console.log(`"${nodeId}":`, JSON.stringify(nodes[nodeId], null, 2));
			}
			
			// 在数据层面添加颜色信息
			this.addColorInfoToNodes(data.nodes);
			
			// 处理完嵌套标签后调用原始方法渲染图谱
			const result = leafRenderer.originalSetData?.(data);
			
			return result;
		};
		return graphLeaf;
	}
	
	// 在数据层面为节点添加颜色信息
	addColorInfoToNodes(nodes: any) {
		console.log("=== Adding color info to nodes data layer ===");
		
		if (!this.settings.enableCustomColors) {
			return;
		}
		
		for (const nodeId in nodes) {
			const node = nodes[nodeId];
			let color = this.getNodeColor(nodeId, node);
			
			// 将颜色信息添加到节点数据中
			node.color = color;
			node.customColor = color;
			node.fillColor = color;
			node.strokeColor = this.darkenColor(color);
			
			// 尝试多种可能的颜色属性
			node.style = node.style || {};
			node.style.fill = color;
			node.style.stroke = this.darkenColor(color);
			node.style.color = color;
			
			console.log(`Set color for node "${nodeId}": ${color}`, {
				nodeType: node.nodeType || node.type,
				level: node.level,
				color: color
			});
		}
	}
	
	// 确定节点颜色的逻辑
	getNodeColor(nodeId: string, node: any): string {
		// 检查自定义节点名颜色
		if (this.settings.enableCustomNodeColors && this.settings.customNodeColors) {
			for (const customColor of this.settings.customNodeColors) {
				if (customColor.enabled && customColor.nodeName.trim()) {
					const targetName = customColor.nodeName.trim();
					
					// 检查各种匹配模式
					if (nodeId === targetName || 
						nodeId === targetName + '.md' ||
						nodeId.replace('.md', '') === targetName ||
						nodeId.includes(targetName) ||
						(node.name && node.name === targetName) ||
						(node.displayText && node.displayText === targetName)) {
						console.log(`Custom color match: ${targetName} -> ${customColor.color}`);
						return customColor.color;
					}
				}
			}
		}
		
		// 检查数字节点颜色
		if (nodeId === '1') return this.settings.colors.childLevel1;
		if (nodeId === '2') return this.settings.colors.childLevel2;
		if (nodeId === '3') return this.settings.colors.childLevel3;
		
		// 根据节点类型设置颜色
		if (node.nodeType === 'root-tag') return this.settings.colors.rootTags;
		if (node.nodeType === 'child-node') {
			if (node.level === 1) return this.settings.colors.childLevel1;
			if (node.level === 2) return this.settings.colors.childLevel2;
			if (node.level === 3) return this.settings.colors.childLevel3;
		}
		if (node.type === 'tag') return this.settings.colors.rootTags;
		
		// 默认文件颜色
		return this.settings.colors.fileNodes;
	}

	async onload() {
		console.log("=== Plugin onload ===");
		
		// 加载设置
		await this.loadSettings();
		console.log("Settings loaded:", this.settings);

		// 添加设置标签页
		this.addSettingTab(new GraphNestedTagsSettingTab(this.app, this));

		// inject Graphs that will be opened in the future
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				console.log("Layout change detected");
				for (const leaf of this.app.workspace.getLeavesOfType(
					"graph"
				)) {
					if (
						(leaf as GraphLeafWithCustomRenderer).view.renderer.originalSetData === undefined
					) {
						console.log("Injecting setData for graph leaf");
						this.inject_setData(leaf as GraphLeafWithCustomRenderer);
					}
				}
			})
		);
		
		this.app.workspace.trigger("layout-change");
		for (const leaf of this.app.workspace.getLeavesOfType("graph")) {
			leaf.view.unload();
			leaf.view.load();
		}
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