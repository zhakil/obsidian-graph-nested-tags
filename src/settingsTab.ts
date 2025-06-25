import { App, PluginSettingTab, Setting } from "obsidian";
import GraphNestedTagsPlugin from "./main";
import { GraphNestedTagsSettings, CustomNodeColor } from "./settings";

export class GraphNestedTagsSettingTab extends PluginSettingTab {
	plugin: GraphNestedTagsPlugin;

	constructor(app: App, plugin: GraphNestedTagsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl('h2', { text: '嵌套标签图谱设置' });

		// 启用自定义颜色开关
		new Setting(containerEl)
			.setName('启用自定义颜色')
			.setDesc('为不同类型的节点设置自定义颜色')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCustomColors)
				.onChange(async (value) => {
					this.plugin.settings.enableCustomColors = value;
					await this.plugin.saveSettings();
					this.display(); // 刷新界面
				}));

		if (this.plugin.settings.enableCustomColors) {
			containerEl.createEl('h3', { text: '节点颜色配置' });

			// 文件节点颜色
			new Setting(containerEl)
				.setName('文件节点颜色')
				.setDesc('设置文件节点的颜色')
				.addColorPicker(color => color
					.setValue(this.plugin.settings.colors.fileNodes)
					.onChange(async (value) => {
						this.plugin.settings.colors.fileNodes = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}));

			// 根标签颜色
			new Setting(containerEl)
				.setName('根标签颜色')
				.setDesc('设置根标签节点的颜色（如：带状线传输、电磁波传播）')
				.addColorPicker(color => color
					.setValue(this.plugin.settings.colors.rootTags)
					.onChange(async (value) => {
						this.plugin.settings.colors.rootTags = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}));

			// 一级子节点颜色
			new Setting(containerEl)
				.setName('一级子节点颜色')
				.setDesc('设置第一层子节点的颜色')
				.addColorPicker(color => color
					.setValue(this.plugin.settings.colors.childLevel1)
					.onChange(async (value) => {
						this.plugin.settings.colors.childLevel1 = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}));

			// 二级子节点颜色
			new Setting(containerEl)
				.setName('二级子节点颜色')
				.setDesc('设置第二层子节点的颜色')
				.addColorPicker(color => color
					.setValue(this.plugin.settings.colors.childLevel2)
					.onChange(async (value) => {
						this.plugin.settings.colors.childLevel2 = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}));

			// 三级子节点颜色
			new Setting(containerEl)
				.setName('三级子节点颜色')
				.setDesc('设置第三层子节点的颜色')
				.addColorPicker(color => color
					.setValue(this.plugin.settings.colors.childLevel3)
					.onChange(async (value) => {
						this.plugin.settings.colors.childLevel3 = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}));

			// 重置按钮
			new Setting(containerEl)
				.setName('重置颜色')
				.setDesc('将所有颜色重置为默认值')
				.addButton(button => button
					.setButtonText('重置')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.colors = {
							fileNodes: '#2563eb',
							rootTags: '#16a34a',
							childLevel1: '#fb923c',
							childLevel2: '#ea580c',
							childLevel3: '#dc2626'
						};
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
						this.display(); // 刷新界面显示新颜色
					}));
		}

		// 自定义节点名颜色设置
		containerEl.createEl('h3', { text: '自定义节点名颜色' });
		
		// 启用自定义节点名颜色开关
		new Setting(containerEl)
			.setName('启用自定义节点名颜色')
			.setDesc('为特定的节点名称（包括文件名、标签名等）设置自定义颜色')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCustomNodeColors)
				.onChange(async (value) => {
					this.plugin.settings.enableCustomNodeColors = value;
					await this.plugin.saveSettings();
					this.plugin.updateGraphColors();
					this.display(); // 刷新界面
				}));

		if (this.plugin.settings.enableCustomNodeColors) {
			// 自定义节点颜色列表
			this.displayCustomNodeColors(containerEl);
			
			// 添加新规则按钮
			new Setting(containerEl)
				.setName('添加新颜色规则')
				.setDesc('为特定节点名称添加颜色规则')
				.addButton(button => button
					.setButtonText('添加')
					.setCta()
					.onClick(async () => {
						this.plugin.settings.customNodeColors.push({
							nodeName: '输入节点名称',
							color: '#ff0000',
							enabled: true
						});
						await this.plugin.saveSettings();
						this.display();
					}));
		}

		// 使用说明
		containerEl.createEl('h3', { text: '使用说明' });
		const descEl = containerEl.createEl('div');
		descEl.innerHTML = `
			<p><strong>插件功能：</strong></p>
			<ul>
				<li>将嵌套标签（如 #标签|子标签|孙标签）转换为层级结构</li>
				<li>文件自动连接到根标签</li>
				<li>创建清晰的标签层次关系</li>
			</ul>
			<p><strong>颜色配置：</strong></p>
			<ul>
				<li><strong>基础颜色：</strong>文件节点、根标签、子节点的默认颜色</li>
				<li><strong>自定义节点名颜色：</strong>为特定的文件名或标签名设置颜色，会覆盖基础颜色</li>
			</ul>
			<p><strong>自定义节点名示例：</strong></p>
			<ul>
				<li><strong>文件名：</strong>笔记1.md, 重要文档.md</li>
				<li><strong>标签名：</strong>带状线传输, 电磁波传播, 1, 2, A, B</li>
			</ul>
			<p><strong>注意：</strong>修改颜色后，图谱会自动更新。自定义节点名颜色具有最高优先级。</p>
		`;
	}

	displayCustomNodeColors(containerEl: HTMLElement) {
		this.plugin.settings.customNodeColors.forEach((customColor, index) => {
			const settingDiv = containerEl.createDiv();
			settingDiv.addClass('custom-node-color-setting');
			settingDiv.style.cssText = 'border: 1px solid var(--background-modifier-border); border-radius: 6px; padding: 12px; margin-bottom: 8px;';
			
			// 节点名称输入
			new Setting(settingDiv)
				.setName(`自定义颜色规则 ${index + 1}`)
				.setDesc('节点名称（完全匹配）')
				.addText(text => text
					.setPlaceholder('输入节点名称')
					.setValue(customColor.nodeName)
					.onChange(async (value) => {
						customColor.nodeName = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}))
				.addColorPicker(color => color
					.setValue(customColor.color)
					.onChange(async (value) => {
						customColor.color = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}))
				.addToggle(toggle => toggle
					.setValue(customColor.enabled)
					.onChange(async (value) => {
						customColor.enabled = value;
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
					}))
				.addButton(button => button
					.setButtonText('删除')
					.setWarning()
					.onClick(async () => {
						this.plugin.settings.customNodeColors.splice(index, 1);
						await this.plugin.saveSettings();
						this.plugin.updateGraphColors();
						this.display();
					}));
		});
	}
}