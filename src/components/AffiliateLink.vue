<template>
	<div class="affiliate-link-box">
		<div class="affiliate-link-text">
			<span class="affiliate-icon">🎁</span>
			<span>{{ text }}</span>
		</div>
		<a
			:href="url"
			target="_blank"
			rel="noopener noreferrer"
			class="affiliate-link-btn"
		>
			{{ buttonText }}
			<el-icon><ArrowRight /></el-icon>
		</a>
	</div>
</template>

<script>
import { ArrowRight } from '@element-plus/icons-vue';

/**
 * 通用邀请注册链接组件。
 * 任意预设只要配置了 affiliateUrl，即可在设置面板中复用此样式展示邀请链接。
 */
export default {
	name: 'AffiliateLink',
	components: { ArrowRight },
	props: {
		url: { type: String, required: true },
		text: {
			type: String,
			default: '通过邀请链接注册，通常可获赠额度，也能支持本项目持续维护。'
		},
		buttonText: {
			type: String,
			default: '前往注册 / 获取 Key'
		}
	}
};
</script>

<style scoped>
.affiliate-link-box {
	margin-top: 8px;
	padding: 10px 12px;
	border: 1px dashed #e6a23c;
	border-radius: 8px;
	background: #fdf6ec;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	flex-wrap: wrap;
}
.affiliate-link-text {
	display: flex;
	align-items: center;
	gap: 6px;
	color: #8a6116;
	font-size: 13px;
	line-height: 1.4;
}
.affiliate-icon {
	font-size: 16px;
}
.affiliate-link-btn {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	white-space: nowrap;
	color: #fff;
	background: #e6a23c;
	padding: 6px 12px;
	border-radius: 6px;
	text-decoration: none;
	font-size: 13px;
	font-weight: 500;
	transition: background 0.2s;
}
.affiliate-link-btn:hover {
	background: #d2932f;
}
</style>
