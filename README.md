Bitcoin  UTXO dump, written in typescript
=========================================

*Heavily inspired by https://github.com/in3rsha/bitcoin-utxo-dump*


Parses bitoind's `chainstate/` directory




Usage
-----

* `git clone`
* `bun install`
* edit `dump-to-csv.ts` & `pull-chainstate.mjs` and put your own path to `chainstate`
* `./pull-chainstate.mjs` (needs `rsync`)
* `bun run dump-to-csv.ts`




Tests
-----

Tests live in `tests/`

* `bun test`
