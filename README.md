## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

- **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
- **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
- **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
- **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

## ElevenLabs Voice Previews

Creators can now share a 10-second AI narration for every locked post.

1. In Supabase Storage, create two public buckets: `creator-voices` (raw uploads) and `post-voice-previews` (generated clips). If you need different names, override them with `SUPABASE_VOICE_BUCKET` and `SUPABASE_POST_AUDIO_BUCKET`.
2. Add the following to `.env.local` (and keep the real secrets out of git):
   - `ELEVENLABS_API_KEY`
   - `ELEVENLABS_MODEL_ID` (optional, defaults to `eleven_turbo_v2`)
3. Creators visit `/creator`, record a quick clip in-browser (or upload a short <10 MB sample), enable the toggle, then use "Generate audio" beside each post. We automatically trim text so every clip stays within the free 10-second ElevenLabs tier, and unlocked supporters see an inline audio player above the post body.
