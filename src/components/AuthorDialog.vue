<template>
	<el-dialog v-model="innerShow" title="关于作者" width="90%" :max-width="500" class="author-dialog" @update:modelValue="$emit('update:modelValue', innerShow)">
		<el-tabs type="card">
			<el-tab-pane label="本项目作者">
				<div class="author-info p-4">
					<h3 class="text-lg font-semibold">tobenot (丶青萝卜)</h3>
					<div class="author-desc text-gray-600 mt-2">
						<p>AI动漫，AI剧本杀，AI文明，反正都不火</p>
						<p>5个Steam独游，反正都不火</p>
						<p>晚上喜欢和AI玩剧本杀所以就做了这个</p>
						<p>在做AI开放世界</p>
					</div>
					<div class="social-links grid grid-cols-2 gap-3 mt-4">
						<a href="https://tobenot.top" target="_blank" class="social-link flex items-center gap-2 p-2 bg-gray-100 rounded hover:bg-gray-200">
							<el-icon><Collection /></el-icon> 作者博客
						</a>
					</div>
				</div>
			</el-tab-pane>
		</el-tabs>
	</el-dialog>
</template>

<script>
import { VideoPlay, Picture, Collection } from '@element-plus/icons-vue'

export default {
	name: 'AuthorDialog',
	components: { VideoPlay, Picture, Collection },
	props: {
		modelValue: { type: Boolean, default: false }
	},
	computed: {
		innerShow: {
			get() { return this.modelValue },
			set(v) { this.$emit('update:modelValue', v) }
		}
	}
}
</script>

<style scoped>
</style>


