export class ScrollManager {
	constructor(containerRef) {
		this.containerRef = containerRef;
		this.autoScrollThreshold = 50;
	}

	getContainer() {
		let container = this.containerRef.value;
		if (container && container.$el) {
			container = container.$el;
		}
		return container;
	}

	isNearBottom(threshold = this.autoScrollThreshold) {
		const container = this.getContainer();
		if (!container) return false;
		
		const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
		return distanceFromBottom <= threshold;
	}

	getDistanceFromBottom() {
		const container = this.getContainer();
		if (!container) return 0;
		
		return container.scrollHeight - container.scrollTop - container.clientHeight;
	}

	scrollToBottom(force = false) {
		const container = this.getContainer();
		if (!container) return;
		
		if (force || this.isNearBottom()) {
			container.scrollTop = container.scrollHeight;
		}
	}

	scrollToBottomSmooth() {
		const container = this.getContainer();
		if (!container) return;
		
		container.scrollTo({
			top: container.scrollHeight,
			behavior: 'smooth'
		});
	}

	shouldShowScrollButton(threshold = 150) {
		return this.getDistanceFromBottom() > threshold;
	}
}

export function createScrollManager(containerRef) {
	return new ScrollManager(containerRef);
}

export function isScrolledToBottom(element, threshold = 50) {
	if (!element) return false;
	const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
	return distanceFromBottom <= threshold;
}

export function scrollElementToBottom(element, smooth = false) {
	if (!element) return;
	
	if (smooth) {
		element.scrollTo({
			top: element.scrollHeight,
			behavior: 'smooth'
		});
	} else {
		element.scrollTop = element.scrollHeight;
	}
}

