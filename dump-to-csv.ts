import {
    deobfuscatedValueToOutputData, deobfuscateValue,
    EVENT_TYPE_OBFUSCATE_KEY,
    EVENT_TYPE_UTXO,
    keyToEventType,
    keyToObfuscationKey,
    keyToOutPoint
} from "./util";

const fs = require('fs');
const levelup = require('levelup')
const leveldown = require('leveldown')

const dbPath = '/home/ghost/Documents/chainstate';
const csvFilePath = 'utxo-dump.csv';

fs.writeFileSync(csvFilePath, '');
const db = levelup(leveldown(dbPath))

const totalEstimated = 101956999;
let c = 0;
let start = +new Date();
let obfuscateKey: Buffer = Buffer.from('338eb27667267366', 'hex'); // init value, not sure if its ever used at all
let flushBuffer = '';

db.createReadStream()
    .on('data', function (data: { key:Buffer; value:Buffer}) {
        c++;
        if (c % 1000000 === 0) {
            // reporting progress
            const current = +new Date();
            const elapsed = (current - start) / 1000;
            const remaining = totalEstimated - c;
            const ETA = (elapsed * remaining) / c
            console.log('elapsed:', Math.floor(elapsed), 'sec;', 'ETA:', Math.ceil(ETA / 60), 'min');
        }

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

                flushBuffer +=[
                    outp.txid.toString('hex'),
                    outp.vout,
                    outputData.address,
                    outputData.amount,
                    outputData.script.toString('hex'),
                ].join('\t') + '\n';

                if (c % 100000 === 0) {
                    // flushing to file async
                    fs.appendFile(csvFilePath, flushBuffer, (err: any) => {
                        if (err) throw err;
                    });
                    flushBuffer = '';
                }
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
        fs.appendFile(csvFilePath, flushBuffer, (err: any) => {
            if (err) throw err;
        });
        flushBuffer = '';
        const end = +new Date();
        console.log('Stream ended')
        console.log((end-start)/1000, 'sec;', 'total:', c, 'records');
    })




