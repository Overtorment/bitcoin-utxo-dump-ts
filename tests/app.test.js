/* global it */

const bitcoin = require('bitcoinjs-lib');

import ecc from '../noble_ecc';
bitcoin.initEccLib(ecc);

import {
    deobfuscatedValueToOutputData,
    deobfuscateValue,
    keyToEventType,
    keyToObfuscationKey,
    keyToOutPoint,
    varint128Read
} from "../util";

const assert = require('assert');

it('parsing key into OutPoint from the chainstate works', () => {
    const o1 = keyToOutPoint(Buffer.from('430000155b9869d56c66d9e86e3c01de38e3892a42b99949fe109ac034fff6583910', 'hex'));
    assert.strictEqual(o1.txid.toString('hex'), '3958f6ff34c09a10fe4999b9422a89e338de013c6ee8d9666cd569985b150000');
    assert.strictEqual(o1.vout, 16);
});

it('invalid event type throws', () => {
    assert.throws(() => keyToOutPoint(Buffer.from('440000155b9869d56c66d9e86e3c01de38e3892a42b99949fe109ac034fff6583910', 'hex')));
});

it('can parse obfuscation key', () => {
    const k = keyToObfuscationKey(Buffer.from('0e79656b5f65746163737566626f00','hex'), Buffer.from('08338eb27667267366','hex'));
    assert.strictEqual(k.toString('hex'), '338eb27667267366');
});

it('can getevent type from key', () => {
    assert.strictEqual(keyToEventType(Buffer.from('0e79656b5f65746163737566626f00','hex')), 14);
    assert.strictEqual(keyToEventType(Buffer.from('430000155b9869d56c66d9e86e3c01de38e3892a42b99949fe109ac034fff6583910','hex')), 67);
});

it('can deobfuscate using xor', () => {
    const obfuscated = Buffer.from('71a9e87d62de25953e189f706bcf59263f15de1bf6c893bda9b045', 'hex');
    const obfuscateKey = Buffer.from('b12dcefd8f872536', 'hex');

    assert.strictEqual(deobfuscateValue(obfuscated, obfuscateKey).toString('hex'), 'c0842680ed5900a38f35518de4487c108e3810e6794fb68b189d8b');
});

it('varint128Read()', () => {
    const xor = Buffer.from('b98276a2ec7700cbc2986ff9aed6825920aece14aa6f5382ca5580', 'hex')
    let [varint, bytesRead] = varint128Read(xor, 0);
    assert.strictEqual(bytesRead, 3);
    assert.strictEqual(varint.toString('hex'), 'b98276');
});

it('can parse value into output data (p2sh)', () => {
    // 200000) outpoint=ab4b514134ebfc113f6b86dcc827e12c4d002e0268810a7ee2f07af8a22a8200:2     key: 43ab4b514134ebfc113f6b86dcc827e12c4d002e0268810a7ee2f07af8a22a820002
    //         value: f45de4f40527aea2be7f2a8eac3178233f02ec19dfcbfd93d135
    const deobfuscated = deobfuscateValue(Buffer.from('f45de4f40527aea2be7f2a8eac3178233f02ec19dfcbfd93d135', 'hex'), Buffer.from('338eb27667267366', 'hex'));

    const data = deobfuscatedValueToOutputData(deobfuscated);

    assert.strictEqual(data.amount, 540);
    assert.strictEqual(data.script.toString('hex'), 'ddc48df198f8cb170b450c8c5e6fb8ed8ef5e2bb');
    assert.strictEqual(data.height, 595243);
    assert.strictEqual(data.address, '3MucinKHkuMcp9CLZHy6BA7BY7yEHiDuMU');
});

it('can parse value into output data (p2pkh)', () => {
    const deobfuscated = deobfuscateValue(Buffer.from('e249daf0950773da2f20a15c239f34ffd71a7753098fdf09676794', 'hex'), Buffer.from('338eb27667267366', 'hex'));
    const data = deobfuscatedValueToOutputData(deobfuscated);
    assert.strictEqual(data.address, '1J9ePnUaSKLjtYXDqZ91C8MK8iPHbPR6yG');
});

it('can parse value into output data (bech32m)', () => {
    // 600000)  dae67c728a821b39cf07c4147e2dad1597d32fdff4fc93b8849eeac728dd7f01:0     key: 43dae67c728a821b39cf07c4147e2dad1597d32fdff4fc93b8849eeac728dd7f0100       value: ec39b6d3480e2246b3b5044a1fe04b223207a8e06173b41cf7f1d7baa034312a02c74b95223a9713
    const deobfuscated = deobfuscateValue(Buffer.from('ec39b6d3480e2246b3b5044a1fe04b223207a8e06173b41cf7f1d7baa034312a02c74b95223a9713', 'hex'), Buffer.from('338eb27667267366', 'hex'));
    const data = deobfuscatedValueToOutputData(deobfuscated);
    assert.strictEqual(data.address, 'bc1psqamv0rcccuygqvfr2tqv4w80tz87ewvcufyynp3f8u7x3guu36sp5yyyt');
});

it('can parse value into output data (bech32)', () => {
    // f18c101ac2b6c6af291ac7fb55d6825288680fc75d6c533e32a124ac79400202:1     key: 43f18c101ac2b6c6af291ac7fb55d6825288680fc75d6c533e32a124ac7940020201       value: ef30a0f798126f662701438fe3788673019c04b94bb1494a26f0666073
    const deobfuscated = deobfuscateValue(Buffer.from('ef30a0f798126f662701438fe3788673019c04b94bb1494a26f0666073', 'hex'), Buffer.from('338eb27667267366', 'hex'));
    const data = deobfuscatedValueToOutputData(deobfuscated);
    assert.strictEqual(data.address, 'bc1q3lclnpz7752nyy4keukfww3vz4ldg9s59fhrk3');
});

it('can parse value into output data (?)', () => {
    // 7200000)         082dda6bf3b241d5360fb5cd6ab0bb95327473cb065e4d300e75d3be42cb2412:1     key: 43082dda6bf3b241d5360fb5cd6ab0bb95327473cb065e4d300e75d3be42cb241201       value: ec478af25849224731c9c5fc058fe5927e02f7e668d23480df8bd112749dd209b35740096cd74c534fafb1c39bcc7be5b166aa0f3ebf13b19e899d9658a63cc956b4ad5baefb0b4cf668145764f525c7053071d0aacab3dbf6a4decffa4ffd1ce8c4f691f28778fa5093370b0675dd
    const deobfuscated = deobfuscateValue(Buffer.from('ec478af25849224731c9c5fc058fe5927e02f7e668d23480df8bd112749dd209b35740096cd74c534fafb1c39bcc7be5b166aa0f3ebf13b19e899d9658a63cc956b4ad5baefb0b4cf668145764f525c7053071d0aacab3dbf6a4decffa4ffd1ce8c4f691f28778fa5093370b0675dd', 'hex'), Buffer.from('338eb27667267366', 'hex'));
    const data = deobfuscatedValueToOutputData(deobfuscated);
    assert.strictEqual(data.nsize, 111);
    assert.strictEqual(data.address, 'unknown');
});

it('can parse value into output data (p2wsh)', () => {
    // 9100000)         40d024548f125e1deb2004430939bb3b9ea86950897b956cb5da4f0109ede716:0     key: 4340d024548f125e1deb2004430939bb3b9ea86950897b956cb5da4f0109ede71600       value: e80ac2ff8e97564e33ae8770c300d7c6b216e759143e665d137ca15c003eccc0359f395a80f0979f7213
    const deobfuscated = deobfuscateValue(Buffer.from('e80ac2ff8e97564e33ae8770c300d7c6b216e759143e665d137ca15c003eccc0359f395a80f0979f7213', 'hex'), Buffer.from('338eb27667267366', 'hex'));
    const data = deobfuscatedValueToOutputData(deobfuscated);
    assert.strictEqual(data.nsize, 40);
    assert.strictEqual(data.address, 'bc1qx5r2gf4y5zqes4f0wvvp2weq7gfj5ecch7nqvyvt9nnade8egxws09up34');
});

it('can parse value into output data (p2tr)', () => {
    // value= e556d2794f775303b18ab148218789eafd36f265a8c4a010f9fc6783f217e7f18ad5badc038f03 txid= 37d5ec4bca7bd077992a6dd8679ab676a22986e63ebaf2c6ea1aebe5e5f5e817:0
    const deobfuscated = deobfuscateValue(Buffer.from('e556d2794f775303b18ab148218789eafd36f265a8c4a010f9fc6783f217e7f18ad5badc038f03', 'hex'), Buffer.from('338eb27667267366', 'hex'));
    const data = deobfuscatedValueToOutputData(deobfuscated);
    assert.strictEqual(data.nsize, 40);
    assert.strictEqual(data.address, 'bc1pvkpqgqe7g6sl4rxwhpqp8nlz6dmv5uk47k2nr9yhh9ds32ny49cqdcghmx');
});
