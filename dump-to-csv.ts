import {
	deobfuscatedValueToOutputData, deobfuscateValue,
	EVENT_TYPE_OBFUSCATE_KEY,
	EVENT_TYPE_UTXO,
	keyToEventType,
	keyToObfuscationKey,
	keyToOutPoint,
} from './util';

const fs = require('node:fs');
const levelup = require('levelup');
const leveldown = require('leveldown');

const dbPath = '/home/ghost/Documents/chainstate';
const csvFilePath = 'utxo-dump.csv';

fs.writeFileSync(csvFilePath, '');
const db = levelup(leveldown(dbPath));

const totalEstimated = 101_956_999;
let c = 0;
const start = Date.now();
let obfuscateKey: Buffer = Buffer.from('338eb27667267366', 'hex'); // Init value, not sure if its ever used at all
let flushBuffer = '';

db.createReadStream()
	.on('data', (data: {key: Buffer; value: Buffer}) => {
		c++;
		if (c % 1_000_000 === 0) {
			// Reporting progress
			const current = Date.now();
			const elapsed = (current - start) / 1000;
			const remaining = totalEstimated - c;
			const ETA = (elapsed * remaining) / c;
			console.log('elapsed:', Math.floor(elapsed), 'sec;', 'ETA:', Math.ceil(ETA / 60), 'min');
		}

		const eventType = keyToEventType(data.key);
		switch (eventType) {
			case EVENT_TYPE_OBFUSCATE_KEY: {
				obfuscateKey = keyToObfuscationKey(data.key, data.value);
				console.log('new obfuscate key:', obfuscateKey.toString('hex'));
				break;
			}

			case EVENT_TYPE_UTXO: {
				const outp = keyToOutPoint(data.key);
				// Debug console.log('\n\n\nvalue=', data.value.toString('hex'), 'txid=', outp.txid.toString('hex')+':'+outp.vout);

				const deobfuscated = deobfuscateValue(data.value, obfuscateKey);
				const outputData = deobfuscatedValueToOutputData(deobfuscated);

				flushBuffer += [
					outp.txid.toString('hex'),
					outp.vout,
					outputData.address,
					outputData.amount,
					outputData.script.toString('hex'),
				].join('\t') + '\n';

				if (c % 100_000 === 0) {
					// Flushing to file async
					fs.appendFile(csvFilePath, flushBuffer, (error: any) => {
						if (error) {
							throw error;
						}
					});
					flushBuffer = '';
				}

				break;
			}
		}
	})
	.on('error', (error: any) => {
		console.log('Oh my!', error);
	})
	.on('close', () => {
		console.log('Stream closed');
	})
	.on('end', () => {
		fs.appendFile(csvFilePath, flushBuffer, (error: any) => {
			if (error) {
				throw error;
			}
		});
		flushBuffer = '';
		const end = Date.now();
		console.log('Stream ended');
		console.log((end - start) / 1000, 'sec;', 'total:', c, 'records');
	});

