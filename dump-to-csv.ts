import {
    deobfuscatedValueToOutputData, deobfuscateValue,
    EVENT_TYPE_OBFUSCATE_KEY,
    EVENT_TYPE_UTXO,
    keyToEventType,
    keyToObfuscationKey,
    keyToOutPoint
} from "./util";

var dbPath = '/home/ghost/Documents/chainstate';

const levelup = require('levelup')
const leveldown = require('leveldown')

const db = levelup(leveldown(dbPath))

let c = 0;
const start = +new Date();
let obfuscateKey: Buffer = Buffer.from('338eb27667267366', 'hex'); // init value, not sure if its ever used at all

db.createReadStream()
    .on('data', function (data: { key:Buffer; value:Buffer}) {
        c++;

        const eventType = keyToEventType(data.key);
        switch (eventType) {
            case EVENT_TYPE_OBFUSCATE_KEY:
                obfuscateKey = keyToObfuscationKey(data.key, data.value);
                console.log('new obfuscate key:', obfuscateKey.toString('hex'));
                break;

            case EVENT_TYPE_UTXO:
                const outp = keyToOutPoint(data.key);
                // debug console.log('\n\n\nvalue=', data.value.toString('hex'), 'txid=', outp.txid.toString('hex')+':'+outp.vout);

                const deobfuscated = deobfuscateValue(data.value, obfuscateKey);
                const outputData = deobfuscatedValueToOutputData(deobfuscated);

                console.log([
                    outp.txid.toString('hex'),
                    outp.vout,
                    outputData.address,
                    outputData.amount,
                    outputData.script.toString('hex'),
                ].join('\t'));
                break;
        }
    })
    .on('error', function (err: any) {
        console.log('Oh my!', err)
    })
    .on('close', function () {
        console.log('Stream closed')
    })
    .on('end', function () {
        const end = +new Date();
        console.log('Stream ended')
        console.log((end-start)/1000, 'sec');
    })




