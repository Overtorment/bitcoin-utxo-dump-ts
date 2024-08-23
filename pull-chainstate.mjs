#!/usr/bin/env zx
$.verbose = true

setInterval(async () => {
    try {
        await $`du -h -d 1 /home/ghost/Downloads/chainstate/`
    } catch (_) {}
}, 5000);

await $`rsync -avz root@electrum1.bluewallet.io:/mnt/volume_fra1_02/bitcoin_datadir/chainstate/*  /home/ghost/Downloads/chainstate/`
process.exit(0);




