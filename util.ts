import ecc from './noble_ecc';
import * as bitcoin from 'bitcoinjs-lib';

bitcoin.initEccLib(ecc);

type OutPoint = {
	readonly txid: Buffer;
	readonly vout: number;
};

type OutputData = {
	readonly height: number;
	readonly amount: number;
	readonly nsize: number;
	readonly script: Buffer;
	readonly address: string;
};

export const EVENT_TYPE_UTXO = 67;
export const EVENT_TYPE_OBFUSCATE_KEY = 14;

export function keyToOutPoint(key: Buffer): OutPoint {
	if (key[0] !== EVENT_TYPE_UTXO) {
		throw new Error('Unexpected event type');
	}

	const txid = Buffer.from(key.subarray(1, 33)).reverse();
	const voutBuffer = key.subarray(33);
	const vout = voutBuffer.length === 1 ? voutBuffer[0] : Number(varint128Decode(voutBuffer));

	return { txid, vout };
}

export function keyToObfuscationKey(key: Buffer, value: Buffer): Buffer {
	if (key.readInt8(0) !== EVENT_TYPE_OBFUSCATE_KEY) {
		throw new Error('Unexpected event type');
	}

	return value.subarray(1);
}

export function keyToEventType(key: Buffer): number {
	return key.readInt8(0);
}

export function deobfuscateValue(obfuscatedValue: Buffer, obfuscateKey: Buffer): Buffer {
	const returnValue = Buffer.allocUnsafe(obfuscatedValue.length);
	const keyLength = obfuscateKey.length;

	for (let i = 0; i < obfuscatedValue.length; i++) {
		returnValue[i] = obfuscatedValue[i] ^ obfuscateKey[i % keyLength];
	}

	return returnValue;
}

export function deobfuscatedValueToOutputData(value: Buffer, decodeAddress = true): OutputData {
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

	if (!decodeAddress) {
		// return early, address decode is a costly operation
		return { script, height, amount, address, nsize };
	}

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

	return { script, height, amount, address, nsize };
}

export function varint128Read(bytes: Buffer, offset: number): [Buffer, number] {
	let i = offset;
	while (i < bytes.length && (bytes[i] & 128) !== 0) {
		i++;
	}
	return [bytes.subarray(offset, i + 1), i - offset + 1];
}

export function varint128Decode(bytes: Buffer): bigint {
	let n = 0n;
	for (let i = 0; i < bytes.length; i++) {
		n = (n << 7n) | BigInt(bytes[i] & 127);
		if ((bytes[i] & 128) !== 0) {
			n++;
		}
	}
	return n;
}

export function decompressValue(x: bigint): bigint {
	if (x === 0n) return 0n;

	x -= 1n;
	const e = x % 10n;
	x /= 10n;

	const n = e < 9n
		? (x / 9n) * 10n + (x % 9n) + 1n
		: x + 1n;

	return n * (10n ** BigInt(Number(e)));
}
