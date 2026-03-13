import type { Address, Hash, Hex } from "viem";

export type { Address, Hash, Hex };

export interface AgentWalletConfig {
  /** Private key of the agent wallet */
  privateKey: Hex;
  /** RPC URL (defaults to Base mainnet) */
  rpcUrl?: string;
  /** Chain ID (defaults to 8453 = Base) */
  chainId?: number;
}

export interface SendEthParams {
  to: Address;
  /** Amount in ETH (e.g. "0.001") */
  amount: string;
  /** Optional data payload */
  data?: Hex;
}

export interface SendTokenParams {
  /** ERC-20 token contract address */
  token: Address;
  to: Address;
  /** Amount in token units (e.g. "100.0") */
  amount: string;
}

export interface ContractCallParams {
  to: Address;
  abi: readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  /** ETH value to send with call (in ETH string) */
  value?: string;
}

export interface WalletBalance {
  address: Address;
  ethBalance: string;
  ethBalanceWei: bigint;
}

export interface TokenBalance {
  token: Address;
  balance: string;
  balanceRaw: bigint;
  symbol: string;
  decimals: number;
}

export interface TxReceipt {
  hash: Hash;
  status: "success" | "reverted";
  blockNumber: bigint;
  gasUsed: bigint;
  effectiveGasPrice: bigint;
}

export interface SignedMessage {
  message: string;
  signature: Hex;
  address: Address;
}

export interface WatchEventParams {
  contractAddress: Address;
  abi: readonly unknown[];
  eventName: string;
  onEvent: (log: unknown) => void;
}
