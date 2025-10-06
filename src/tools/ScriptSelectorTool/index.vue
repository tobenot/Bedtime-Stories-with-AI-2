<!--
	剧本选择器工具
	提供剧本选择和预览功能
-->
<template>
	<div class="script-selector-tool">
		<el-button 
			class="tool-button"
			@click="visible = true"
		>
			<el-icon><Document /></el-icon>
			<span>选择剧本</span>
		</el-button>
		
		<!-- 剧本选择对话框 -->
		<ScriptSelector 
			v-model="visible" 
			:scripts="scripts" 
			@script-selected="handleScriptSelected" 
		/>
	</div>
</template>

<script>
import { Document } from '@element-plus/icons-vue';
import ScriptSelector from '@/components/ScriptSelector.vue';

export default {
	name: 'ScriptSelectorTool',
	components: {
		Document,
		ScriptSelector
	},
	props: {
		scripts: {
			type: Array,
			default: () => []
		}
	},
	emits: ['script-selected'],
	data() {
		return {
			visible: false
		};
	},
	methods: {
		handleScriptSelected(script) {
			this.$emit('script-selected', script);
			this.visible = false;
		}
	}
};
</script>

<style scoped>
.tool-button {
	display: flex;
	align-items: center;
	gap: 4px;
}
</style>

