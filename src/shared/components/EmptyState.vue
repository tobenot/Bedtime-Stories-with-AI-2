<!--
	空状态组件
	用于展示无消息时的引导界面
-->
<template>
	<div class="empty-state text-center p-5">
		<!-- 图标插槽 -->
		<div v-if="$slots.icon" class="empty-state-icon mb-4">
			<slot name="icon"></slot>
		</div>
		<div v-else-if="showDefaultIcon" class="empty-state-icon mb-4">
			<img src="/logo.svg" alt="Logo" class="w-12 h-12 inline-block" />
		</div>
		
		<!-- 标题 -->
		<h3 v-if="title" class="empty-state-title text-2xl font-semibold text-primary mb-2">
			{{ title }}
		</h3>
		
		<!-- 描述 -->
		<p v-if="description" class="empty-state-description text-base text-customGray mb-4">
			{{ description }}
		</p>
		
		<!-- 自定义内容插槽 -->
		<div v-if="$slots.default" class="empty-state-content">
			<slot></slot>
		</div>
		
		<!-- 操作按钮插槽 -->
		<div v-if="$slots.actions" class="empty-state-actions">
			<slot name="actions"></slot>
		</div>
	</div>
</template>

<script>
export default {
	name: 'EmptyState',
	props: {
		title: {
			type: String,
			default: ''
		},
		description: {
			type: String,
			default: ''
		},
		showDefaultIcon: {
			type: Boolean,
			default: true
		}
	}
};
</script>

<style scoped>
</style>

