<template>
	<div ref="viewport" class="virtual-list-viewport" @scroll.passive="onScroll">
		<div class="virtual-list-spacer" :style="{ height: totalHeight + 'px' }">
			<div class="virtual-list-window" :style="{ transform: `translateY(${offsetY}px)` }">
				<div
					v-for="(item, idx) in visibleItems"
					:key="keyField ? item[keyField] : (startIndex + idx)"
					class="virtual-list-row"
					:style="{ height: itemHeight + 'px' }"
				>
					<slot :item="item" :index="startIndex + idx"></slot>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
/**
 * 极简虚拟滚动组件（固定行高）。
 * - 只渲染视口内的行，额外上下各留 overscan 行以便滚动流畅。
 * - 要求每行高度一致（itemHeight，单位 px，包含行间距）。
 * - items 变化时自动重算；外部滚动容器改变大小时通过 ResizeObserver 跟随。
 */
export default {
	name: 'VirtualList',
	props: {
		items: { type: Array, required: true },
		itemHeight: { type: Number, required: true },
		overscan: { type: Number, default: 5 },
		keyField: { type: String, default: 'id' },
		resetKey: { type: [String, Number], default: '' }
	},
	data() {
		return {
			scrollTop: 0,
			viewportHeight: 0
		}
	},
	computed: {
		totalHeight() {
			return this.items.length * this.itemHeight
		},
		maxScrollTop() {
			return Math.max(0, this.totalHeight - this.viewportHeight)
		},
		startIndex() {
			const raw = Math.floor(this.scrollTop / this.itemHeight) - this.overscan
			return Math.max(0, raw)
		},
		endIndex() {
			const visibleCount = Math.ceil(this.viewportHeight / this.itemHeight)
			const raw = this.startIndex + visibleCount + this.overscan * 2
			return Math.min(this.items.length, raw)
		},
		offsetY() {
			return this.startIndex * this.itemHeight
		},
		visibleItems() {
			return this.items.slice(this.startIndex, this.endIndex)
		}
	},
	watch: {
		items() {
			this.$nextTick(() => this.syncScrollPosition())
		},
		resetKey() {
			this.scrollToTop()
		}
	},
	mounted() {

		this.measureViewport()
		if (typeof ResizeObserver !== 'undefined') {
			this.resizeObserver = new ResizeObserver(() => this.measureViewport())
			this.resizeObserver.observe(this.$refs.viewport)
		} else {
			window.addEventListener('resize', this.measureViewport)
		}
	},
	beforeUnmount() {
		if (this.resizeObserver) {
			this.resizeObserver.disconnect()
			this.resizeObserver = null
		} else {
			window.removeEventListener('resize', this.measureViewport)
		}
	},
	methods: {
		measureViewport() {
			const el = this.$refs.viewport
			if (!el) return
			this.viewportHeight = el.clientHeight || 0
			this.syncScrollPosition()
		},
		scrollToTop() {
			const el = this.$refs.viewport
			if (el) {
				el.scrollTop = 0
			}
			this.scrollTop = 0
		},
		syncScrollPosition() {
			const el = this.$refs.viewport
			if (!el) return
			const nextScrollTop = Math.min(el.scrollTop, this.maxScrollTop)
			if (nextScrollTop !== el.scrollTop) {
				el.scrollTop = nextScrollTop
			}
			this.scrollTop = nextScrollTop
		},
		onScroll(e) {
			this.scrollTop = e.target.scrollTop
		}
	}
}
</script>


<style scoped>
.virtual-list-viewport {
	position: relative;
	overflow-y: auto;
	width: 100%;
	height: 100%;
}
.virtual-list-spacer {
	position: relative;
	width: 100%;
}
.virtual-list-window {
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	will-change: transform;
}
.virtual-list-row {
	box-sizing: border-box;
	width: 100%;
}
</style>
