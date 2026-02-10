const PBKDF2_ITERATIONS = 210000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DERIVED_KEY_BITS = 256;

function ensureCryptoAvailable() {
	if (!globalThis.crypto?.subtle) {
		throw new Error('crypto_unavailable');
	}
}

function randomBytes(size) {
	const bytes = new Uint8Array(size);
	globalThis.crypto.getRandomValues(bytes);
	return bytes;
}

function toBase64(bytes) {
	let binary = '';
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function fromBase64(base64) {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function deriveAesKey(password, saltBytes) {
	ensureCryptoAvailable();
	const encoder = new TextEncoder();
	const keyMaterial = await globalThis.crypto.subtle.importKey(
		'raw',
		encoder.encode(password),
		{ name: 'PBKDF2' },
		false,
		['deriveKey', 'deriveBits']
	);
	return globalThis.crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: saltBytes,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256'
		},
		keyMaterial,
		{ name: 'AES-GCM', length: DERIVED_KEY_BITS },
		false,
		['encrypt', 'decrypt']
	);
}

export async function createPasswordProof(password) {
	ensureCryptoAvailable();
	const nonce = randomBytes(16);
	const encoder = new TextEncoder();
	const passwordBytes = encoder.encode(password);
	const merged = new Uint8Array(passwordBytes.length + nonce.length);
	merged.set(passwordBytes, 0);
	merged.set(nonce, passwordBytes.length);
	const digest = await globalThis.crypto.subtle.digest('SHA-256', merged);
	return {
		algorithm: 'sha256+nonce',
		nonce: toBase64(nonce),
		hash: toBase64(new Uint8Array(digest))
	};
}

export async function verifyPasswordProof(password, proof) {
	if (!proof || proof.algorithm !== 'sha256+nonce' || !proof.nonce || !proof.hash) {
		return false;
	}
	try {
		const nonce = fromBase64(proof.nonce);
		const expectedHash = proof.hash;
		const encoder = new TextEncoder();
		const passwordBytes = encoder.encode(password);
		const merged = new Uint8Array(passwordBytes.length + nonce.length);
		merged.set(passwordBytes, 0);
		merged.set(nonce, passwordBytes.length);
		const digest = await globalThis.crypto.subtle.digest('SHA-256', merged);
		return toBase64(new Uint8Array(digest)) === expectedHash;
	} catch (error) {
		return false;
	}
}

export async function encryptTextWithPassword(plainText, password) {
	ensureCryptoAvailable();
	const salt = randomBytes(SALT_BYTES);
	const iv = randomBytes(IV_BYTES);
	const key = await deriveAesKey(password, salt);
	const encoder = new TextEncoder();
	const encryptedBuffer = await globalThis.crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		encoder.encode(plainText)
	);
	return {
		encrypted: true,
		version: 1,
		kdf: 'PBKDF2-SHA256',
		iterations: PBKDF2_ITERATIONS,
		cipher: 'AES-GCM',
		salt: toBase64(salt),
		iv: toBase64(iv),
		data: toBase64(new Uint8Array(encryptedBuffer))
	};
}

export async function decryptTextWithPassword(payload, password) {
	ensureCryptoAvailable();
	if (!payload?.encrypted || !payload.salt || !payload.iv || !payload.data) {
		throw new Error('invalid_encrypted_payload');
	}
	const salt = fromBase64(payload.salt);
	const iv = fromBase64(payload.iv);
	const data = fromBase64(payload.data);
	const key = await deriveAesKey(password, salt);
	try {
		const decrypted = await globalThis.crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			key,
			data
		);
		const decoder = new TextDecoder();
		return decoder.decode(decrypted);
	} catch (error) {
		throw new Error('decrypt_failed');
	}
}
