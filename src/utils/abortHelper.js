export class AbortManager {
	constructor() {
		this.controller = null;
	}

	create() {
		this.abort();
		this.controller = new AbortController();
		return this.controller;
	}

	abort() {
		if (this.controller) {
			this.controller.abort();
			this.controller = null;
		}
	}

	getSignal() {
		return this.controller?.signal;
	}

	isActive() {
		return this.controller !== null;
	}
}

export function createAbortManager() {
	return new AbortManager();
}

