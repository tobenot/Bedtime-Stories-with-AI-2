export function patchInputNoAutofill(input) {
	if (!input || input.__noAutofillBound) return;
	input.__noAutofillBound = true;
	input.setAttribute('readonly', 'readonly');
	input.addEventListener('focus', () => {
		setTimeout(() => input.removeAttribute('readonly'), 0);
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
