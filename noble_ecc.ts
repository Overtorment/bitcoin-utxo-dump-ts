/**
 * Adapted from https://github.com/BitGo/BitGoJS/blob/bitcoinjs_lib_6_sync/modules/utxo-lib/src/noble_ecc.ts
 * license: Apache License
 *
 * @see https://github.com/bitcoinjs/tiny-secp256k1/issues/84#issuecomment-1185682315
 * @see https://github.com/bitcoinjs/bitcoinjs-lib/issues/1781
 */
import {createHmac} from 'node:crypto';
import createHash from 'create-hash';
import * as necc from '@noble/secp256k1';
import {type TinySecp256k1Interface} from 'ecpair/src/ecpair';
import {type TinySecp256k1Interface as TinySecp256k1InterfaceBIP32} from 'bip32/types/bip32';
import {type XOnlyPointAddTweakResult} from 'bitcoinjs-lib/src/types';

export type TinySecp256k1InterfaceExtended = {
	pointMultiply(p: Uint8Array, tweak: Uint8Array, compressed?: boolean): Uint8Array | undefined;

	pointAdd(pA: Uint8Array, pB: Uint8Array, compressed?: boolean): Uint8Array | undefined;

	isXOnlyPoint(p: Uint8Array): boolean;

	xOnlyPointAddTweak(p: Uint8Array, tweak: Uint8Array): XOnlyPointAddTweakResult | undefined;
};

necc.utils.sha256Sync = (...messages: Uint8Array[]): Uint8Array => {
	const sha256 = createHash('sha256');
	for (const message of messages) {
		sha256.update(message);
	}

	return sha256.digest();
};

necc.utils.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]): Uint8Array => {
	const hash = createHmac('sha256', Buffer.from(key));
	for (const m of messages) {
		hash.update(m);
	}

	return Uint8Array.from(hash.digest());
};

/* Const normal = necc.utils._normalizePrivateKey;
type Hex = string | Uint8Array;
type PrivKey = Hex | bigint | number;

necc.utils.privateAdd = (privateKey: PrivKey, tweak: Hex) => {
  console.log({ privateKey, tweak });
  const p = normal(privateKey);
  const t = normal(tweak);
  return necc.utils.privateAdd(necc.utils.mod(p + t, necc.CURVE.n));
}; */

const defaultTrue = (parameter?: boolean): boolean => parameter !== false;

function throwToNull<Type>(fn: () => Type): Type | undefined {
	try {
		return fn();
	} catch {
		// Console.log(e);
		return null;
	}
}

function isPoint(p: Uint8Array, xOnly: boolean): boolean {
	if ((p.length === 32) !== xOnly) {
		return false;
	}

	try {
		return Boolean(necc.Point.fromHex(p));
	} catch {
		return false;
	}
}

const ecc: TinySecp256k1InterfaceExtended & TinySecp256k1Interface & TinySecp256k1InterfaceBIP32 = {
	isPoint: (p: Uint8Array): boolean => isPoint(p, false),
	isPrivate: (d: Uint8Array): boolean =>
	/* If (
      [
        '0000000000000000000000000000000000000000000000000000000000000000',
        'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141',
        'fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364142',
      ].includes(d.toString('hex'))
    ) {
      return false;
    } */
		necc.utils.isValidPrivateKey(d),
	isXOnlyPoint: (p: Uint8Array): boolean => isPoint(p, true),

	xOnlyPointAddTweak: (p: Uint8Array, tweak: Uint8Array): {parity: 0 | 1; xOnlyPubkey: Uint8Array} | undefined =>
		throwToNull(() => {
			const P = necc.utils.pointAddScalar(p, tweak, true);
			const parity = P[0] % 2 === 1 ? 1 : 0;
			return {parity, xOnlyPubkey: P.slice(1)};
		}),

	pointFromScalar: (sk: Uint8Array, compressed?: boolean): Uint8Array | undefined =>
		throwToNull(() => necc.getPublicKey(sk, defaultTrue(compressed))),

	pointCompress: (p: Uint8Array, compressed?: boolean): Uint8Array => necc.Point.fromHex(p).toRawBytes(defaultTrue(compressed)),

	pointMultiply: (a: Uint8Array, tweak: Uint8Array, compressed?: boolean): Uint8Array | undefined =>
		throwToNull(() => necc.utils.pointMultiply(a, tweak, defaultTrue(compressed))),

	pointAdd: (a: Uint8Array, b: Uint8Array, compressed?: boolean): Uint8Array | undefined =>
		throwToNull(() => {
			const A = necc.Point.fromHex(a);
			const B = necc.Point.fromHex(b);
			return A.add(B).toRawBytes(defaultTrue(compressed));
		}),

	pointAddScalar: (p: Uint8Array, tweak: Uint8Array, compressed?: boolean): Uint8Array | undefined =>
		throwToNull(() => necc.utils.pointAddScalar(p, tweak, defaultTrue(compressed))),

	privateAdd: (d: Uint8Array, tweak: Uint8Array): Uint8Array | undefined =>
		throwToNull(() => {
			// Console.log({ d, tweak });
			const returnValue = necc.utils.privateAdd(d, tweak);
			// Console.log(ret);
			if (returnValue.join('') === '00000000000000000000000000000000') {
				return null;
			}

			return returnValue;
		}),

	// PrivateNegate: (d: Uint8Array): Uint8Array => necc.utils.privateNegate(d),

	sign: (h: Uint8Array, d: Uint8Array, e?: Uint8Array): Uint8Array => necc.signSync(h, d, {der: false, extraEntropy: e}),

	signSchnorr: (h: Uint8Array, d: Uint8Array, e: Uint8Array = Buffer.alloc(32, 0x00)): Uint8Array => necc.schnorr.signSync(h, d, e),

	verify: (h: Uint8Array, Q: Uint8Array, signature: Uint8Array, strict?: boolean): boolean => necc.verify(signature, h, Q, {strict}),

	verifySchnorr: (h: Uint8Array, Q: Uint8Array, signature: Uint8Array): boolean => necc.schnorr.verifySync(signature, h, Q),
};

export default ecc;

// Module.exports.ecc = ecc;
