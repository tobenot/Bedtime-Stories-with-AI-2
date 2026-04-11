export function patchInputNoAutofill(input) {
	if (!input || input.__noAutofillBound) return;
	input.__noAutofillBound = true;
	input.setAttribute('readonly', 'readonly');
	input.addEventListener('pointerdown', () => {
		input.removeAttribute('readonly');
	});
	input.addEventListener('blur', () => {
		input.setAttribute('readonly', 'readonly');
	});
}

function applyToEl(el) {
	const input = el.querySelector?.('input') || (el.tagName === 'INPUT' ? el : null);
	if (input) patchInputNoAutofill(input);
}

export const noAutofillDirective = {
	mounted(el) {
		applyToEl(el);
	},
	updated(el) {
		applyToEl(el);
	}
};
