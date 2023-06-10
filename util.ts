import ecc from './noble_ecc';
const bitcoin = require('bitcoinjs-lib');

bitcoin.initEccLib(ecc);

type OutPoint = {
	txid: Buffer;
	vout: number;
};

type OutputData = {
	height: number;
	amount: number;
	nsize: number;
	script: Buffer;
	address: string;
};

export const EVENT_TYPE_UTXO = 67;
export const EVENT_TYPE_OBFUSCATE_KEY = 14;
export function keyToOutPoint(key: Buffer): OutPoint {
	const eventType = key.readInt8(0);

	if (eventType !== EVENT_TYPE_UTXO) {
		throw new Error('Unexpected event type');
	}

	return {
		txid: key.subarray(1, 33).reverse(),
		vout: Number.parseInt(key.subarray(33, key.length + 1).reverse().toString('hex'), 16), // Inefficient, fixme
	};
}

export function keyToObfuscationKey(key: Buffer, value: Buffer): Buffer {
	const eventType = key.readInt8(0);

	if (eventType !== EVENT_TYPE_OBFUSCATE_KEY) {
		throw new Error('Unexpected event type');
	}

	// First byte is basically size of the key, ignore it
	return value.subarray(1);
}

export function keyToEventType(key: Buffer): number {
	return key.readInt8(0);
}

export function deobfuscateValue(obfuscatedValue: Buffer, obfuscateKey: Buffer): Buffer {
	const returnValue = Buffer.alloc(obfuscatedValue.length);

	for (const [c, element] of obfuscatedValue.entries()) {
		returnValue[c] = element ^ obfuscateKey[c % obfuscateKey.length];
	}

	return returnValue;
}

export function deobfuscatedValueToOutputData(value: Buffer): OutputData {
	let offset = 0;

	let [varint, bytesRead] = varint128Read(value, 0);
	offset += bytesRead;

	let varintDecoded = varint128Decode(varint);

	const height = Number(varintDecoded >> BigInt(1)); // Right-shift to remove last bit
	const coinbase = Number(varintDecoded & BigInt(1)); // AND to extract right-most bit

	// Second Varint

	[varint, bytesRead] = varint128Read(value, offset); // Start after last varint
	offset += bytesRead;
	varintDecoded = varint128Decode(varint);

	// Amount

	const amount = Number(decompressValue(varintDecoded));

	// Third varint

	[varint, bytesRead] = varint128Read(value, offset); // Start after last varint
	offset += bytesRead;
	const nsize = Number(varint128Decode(varint));

	// Script (remaining bytes)

	// Move offset back a byte if script type is 2, 3, 4, or 5 (because this forms part of the P2PK public key along with the actual script)
	if (nsize > 1 && nsize < 6) { // Either 2, 3, 4, 5
		offset--;
	}

	// Get the remaining bytes
	const script = value.slice(offset);

	let address = '?';

	switch (true) {
		// P2PKH
		case nsize === 0: {
			address = bitcoin.address.fromOutputScript(Buffer.concat([Buffer.from('76a9', 'hex'), Buffer.from([script.length]), script, Buffer.from('88ac', 'hex')]));
			// OP_DUP OP_HASH160 ______  OP_EQUALVERIFY OP_CHECKSIG
			break;
		}

		// P2SH
		case nsize === 1: {
			address = bitcoin.address.fromOutputScript(Buffer.concat([Buffer.from('a9', 'hex'), Buffer.from([script.length]), script, Buffer.from('87', 'hex')]));
			// ^^^ OP_HASH160 ______ OP_EQUAL
			break;
		}

		// P2PK
		case nsize > 1 && nsize < 6: { // 2, 3, 4, 5
			// scriptType = "p2pk";
			address = 'p2pk';
			break;
		}

		// P2MS
		case script.length > 0 && script[script.length - 1] === 174: { // If there is a script and if the last opcode is OP_CHECKMULTISIG (174) (0xae)
			// scriptType = "p2ms";
			address = 'unknown';
			break;
		}

		// P2WPKH
		case nsize === 28 && script[0] === 0 && script[1] === 20: { // P2WPKH (script type is 28, which means length of script is 22 bytes)
			// scriptType = "p2wpkh";
			address = bitcoin.address.fromOutputScript(script);
			break;
		}

		// P2WSH
		case nsize === 40 && script[0] === 0 && script[1] === 32: { // P2WSH (script type is 40, which means length of script is 34 bytes; 0x00 means segwit v0)
			// scriptType = "p2wsh";
			address = bitcoin.address.fromOutputScript(script);
			break;
		}

		// P2TR
		case nsize === 40 && script[0] === 0x51 && script[1] === 32: { // P2TR (script type is 40, which means length of script is 34 bytes; 0x51 means segwit v1 = taproot)
			address = bitcoin.payments.p2tr({pubkey: script.slice(2, 34)}, {validate: false}).address;
			break;
		}

		// Non-Standard
		default: {
			// ScriptType = "non-standard";
			address = 'unknown';
			break;
		}
	}

	return {
		script,
		height,
		amount,
		address,
		nsize,
	};
}

export function varint128Read(bytes: Buffer, offset: number): [Buffer, number] {
	let result: Buffer = Buffer.alloc(0);

	for (let i = offset; i < bytes.length; i++) {
		const v = bytes[i];
		result = Buffer.concat([result, Buffer.from([bytes[i]])]);

		const set = v & 128;

		if (set === 0) {
			return [result, result.length];
		}
	}

	return [result, 0];
}

export function varint128Decode(bytes: Buffer): bigint {
	let n = BigInt(0);

	for (const v of bytes) {
		n <<= BigInt(7);
		n |= BigInt(v & 127);

		if ((v & 128) !== 0) {
			n++;
		}
	}

	return n;
}

export function decompressValue(x: bigint): bigint {
	let n = BigInt(0); // Decompressed value

	// Return value if it is zero (nothing to decompress)
	if (x === BigInt(0)) {
		return BigInt(0);
	}

	// Decompress...
	x -= BigInt(1); // Subtract 1 first
	const e = x % BigInt(10); // Remainder mod 10
	x /= BigInt(10); // Quotient mod 10 (reduce x down by 10)

	// If the remainder is less than 9
	if (e < BigInt(9)) {
		const d = x % BigInt(9); // Remainder mod 9
		x /= BigInt(9); // Reduce x down by 9
		n = x * BigInt(10) + d + BigInt(1); // Work out n
	} else {
		n = x + BigInt(1);
	}

	// Multiply n by 10 to the power of the first remainder
	const result = BigInt(n) * BigInt(10 ** Number(e));

	return result;
}
