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

export function patchInputAsSecretText(input) {
	if (!input) return;
	input.type = 'text';
	input.autocomplete = 'off';
	input.style.setProperty('-webkit-text-security', 'disc');
	input.style.setProperty('text-security', 'disc');

	input.setAttribute('data-form-type', 'other');
	input.setAttribute('data-lpignore', 'true');
	input.setAttribute('data-1p-ignore', 'true');
	input.setAttribute('data-bwignore', 'true');
	patchInputNoAutofill(input);
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
