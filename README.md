# agent-wallet-sdk

Lightweight TypeScript SDK for AI agents to interact with Ethereum wallets onchain.

Built on top of [viem](https://viem.sh). Designed for autonomous agents that need to spend, transfer, call contracts, sign messages, and react to onchain events — without the overhead of a full wallet library.

## Why

AI agents are getting real wallets. Most wallet SDKs are built for humans (UI flows, MetaMask, browser extensions). This SDK is built for agents: pure TypeScript, private key input, typed responses, no browser dependencies.

Pairs naturally with [AgentScope](https://github.com/7abar/agent-scope) for scoped permission enforcement.

## Install

```bash
npm install @7abar/agent-wallet-sdk
```

## Quick Start

```typescript
import { AgentWallet } from "@7abar/agent-wallet-sdk";

const wallet = new AgentWallet({
  privateKey: process.env.AGENT_PRIVATE_KEY as `0x${string}`,
  // defaults to Base mainnet
});

console.log("Agent address:", wallet.address);

// Check ETH balance
const balance = await wallet.getBalance();
console.log("Balance:", balance.ethBalance, "ETH");

// Send ETH
const receipt = await wallet.sendEth({
  to: "0xRecipient...",
  amount: "0.001",
});
console.log("TX:", receipt.hash, "status:", receipt.status);
```

## API

### Constructor

```typescript
new AgentWallet({
  privateKey: "0x...",   // required
  rpcUrl?: string,        // optional, defaults to Base mainnet
  chainId?: number,       // optional, defaults to 8453
})
```

### Balance

```typescript
// ETH balance (this wallet or any address)
const bal = await wallet.getBalance(address?)
// { address, ethBalance: "1.0", ethBalanceWei: 1000000000000000000n }

// ERC-20 balance
const tokenBal = await wallet.getTokenBalance(tokenAddress, address?)
// { token, balance: "100.0", symbol: "USDC", decimals: 6, balanceRaw: 100000000n }
```

### Send

```typescript
// Send ETH
const receipt = await wallet.sendEth({ to, amount: "0.001" })

// Send ERC-20
const receipt = await wallet.sendToken({ token, to, amount: "10.5" })
```

### Contract

```typescript
// Write (state-changing)
const receipt = await wallet.contractCall({
  to: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: "myFunction",
  args: [arg1, arg2],
  value?: "0.01",  // ETH to send with call
})

// Read (free, no gas)
const result = await wallet.contractRead({
  to: CONTRACT_ADDRESS,
  abi: CONTRACT_ABI,
  functionName: "myView",
  args: [arg1],
})
```

### Sign

```typescript
// EIP-191 message signing
const signed = await wallet.signMessage("authenticate agent 0x1234")
// { message, signature, address }

// EIP-712 typed data
const sig = await wallet.signTypedData({ domain, types, primaryType, message })
```

### Watch Events

```typescript
// React to onchain events in real time
const stop = wallet.watchEvent({
  contractAddress: AGENT_SCOPE_ADDRESS,
  abi: AGENT_SCOPE_ABI,
  eventName: "ActionReceipt",
  onEvent: (log) => {
    console.log("Agent action recorded:", log)
  }
})

// Stop watching
stop()
```

### Utils

```typescript
const gasPrice = await wallet.getGasPrice()      // "0.001 gwei"
const gas      = await wallet.estimateGas({ to, value?, data? })
const receipt  = await wallet.waitForReceipt(hash)
```

## Integration with AgentScope

```typescript
import { AgentWallet } from "@7abar/agent-wallet-sdk";
import { AGENT_SCOPE_ABI } from "./abis";

const agent = new AgentWallet({ privateKey: process.env.AGENT_KEY });

// Agent spends ETH through AgentScope (scoped + receipted)
const receipt = await agent.contractCall({
  to: AGENT_SCOPE_ADDRESS,
  abi: AGENT_SCOPE_ABI,
  functionName: "spend",
  args: [recipientAddress, parseEther("0.001")],
});

// Watch for receipts
agent.watchEvent({
  contractAddress: AGENT_SCOPE_ADDRESS,
  abi: AGENT_SCOPE_ABI,
  eventName: "ActionReceipt",
  onEvent: (log) => console.log("Receipted:", log),
});
```

## Network Support

Works with any EVM chain. Pass `rpcUrl` and `chainId` to target a different network:

```typescript
const wallet = new AgentWallet({
  privateKey: "0x...",
  rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
  chainId: 1, // Ethereum mainnet
})
```

## Built With

- [viem](https://viem.sh) — TypeScript Ethereum library
- [Base](https://base.org) — Default network

## License

MIT
