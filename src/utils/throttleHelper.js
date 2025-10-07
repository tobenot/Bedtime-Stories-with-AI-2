export class ThrottleManager {
	constructor(delay = 50) {
		this.delay = delay;
		this.timer = null;
		this.lastExecuteTime = 0;
	}

	execute(callback) {
		if (this.timer) {
			return;
		}
		
		this.timer = setTimeout(() => {
			callback();
			this.timer = null;
			this.lastExecuteTime = Date.now();
		}, this.delay);
	}

	cancel() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = null;
		}
	}

	isThrottled() {
		return this.timer !== null;
	}
}

export function createThrottle(delay = 50) {
	return new ThrottleManager(delay);
}

export function throttle(func, delay = 50) {
	let timer = null;
	return function(...args) {
		if (timer) return;
		timer = setTimeout(() => {
			func.apply(this, args);
			timer = null;
		}, delay);
	};
}

