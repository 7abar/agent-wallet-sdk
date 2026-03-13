import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  parseEther,
  formatEther,
  formatUnits,
  parseUnits,
  getContract,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base } from "viem/chains";
import type {
  AgentWalletConfig,
  SendEthParams,
  SendTokenParams,
  ContractCallParams,
  WalletBalance,
  TokenBalance,
  TxReceipt,
  SignedMessage,
  WatchEventParams,
  Address,
  Hash,
  Hex,
} from "./types.js";

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * AgentWallet — a self-contained wallet for AI agents.
 *
 * Wraps viem to provide simple, typed methods for the most common
 * onchain operations an autonomous agent needs:
 * - Check balances (ETH + ERC-20)
 * - Send ETH and tokens
 * - Call arbitrary contracts
 * - Sign messages (for authentication / attestation)
 * - Watch events (to react to onchain triggers)
 */
export class AgentWallet {
  private account;
  private client;
  private publicClient;

  constructor(config: AgentWalletConfig) {
    const chain =
      config.chainId && config.chainId !== 8453
        ? defineChain({
            id: config.chainId,
            name: "Custom",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: {
              default: { http: [config.rpcUrl ?? "http://localhost:8545"] },
            },
          })
        : base;

    const transport = http(config.rpcUrl ?? "https://mainnet.base.org");

    this.account = privateKeyToAccount(config.privateKey);

    this.client = createWalletClient({
      account: this.account,
      chain,
      transport,
    }).extend(publicActions);

    this.publicClient = createPublicClient({
      chain,
      transport,
    });
  }

  /** The agent's wallet address */
  get address(): Address {
    return this.account.address;
  }

  // ─── Balance ──────────────────────────────────────────────────────────────

  /**
   * Get ETH balance of any address (defaults to this wallet).
   */
  async getBalance(address?: Address): Promise<WalletBalance> {
    const target = address ?? this.account.address;
    const wei = await this.publicClient.getBalance({ address: target });
    return {
      address: target,
      ethBalance: formatEther(wei),
      ethBalanceWei: wei,
    };
  }

  /**
   * Get ERC-20 token balance for any address (defaults to this wallet).
   */
  async getTokenBalance(
    token: Address,
    address?: Address
  ): Promise<TokenBalance> {
    const target = address ?? this.account.address;
    const contract = getContract({
      address: token,
      abi: ERC20_ABI,
      client: this.publicClient,
    });

    const [raw, decimals, symbol] = await Promise.all([
      contract.read.balanceOf([target]),
      contract.read.decimals(),
      contract.read.symbol(),
    ]);

    return {
      token,
      balance: formatUnits(raw, decimals),
      balanceRaw: raw,
      symbol,
      decimals,
    };
  }

  // ─── Send ─────────────────────────────────────────────────────────────────

  /**
   * Send ETH to an address.
   *
   * @example
   * const receipt = await wallet.sendEth({ to: "0x...", amount: "0.001" });
   */
  async sendEth(params: SendEthParams): Promise<TxReceipt> {
    const hash = await this.client.sendTransaction({
      to: params.to,
      value: parseEther(params.amount),
      data: params.data,
    });
    return this.waitForReceipt(hash);
  }

  /**
   * Send an ERC-20 token.
   *
   * @example
   * const receipt = await wallet.sendToken({
   *   token: USDC_ADDRESS,
   *   to: "0x...",
   *   amount: "10.5",
   * });
   */
  async sendToken(params: SendTokenParams): Promise<TxReceipt> {
    const contract = getContract({
      address: params.token,
      abi: ERC20_ABI,
      client: this.client,
    });

    const decimals = await this.publicClient.readContract({
      address: params.token,
      abi: ERC20_ABI,
      functionName: "decimals",
    });

    const amount = parseUnits(params.amount, decimals);
    const hash = await contract.write.transfer([params.to, amount]);
    return this.waitForReceipt(hash);
  }

  // ─── Contract ─────────────────────────────────────────────────────────────

  /**
   * Call a write function on any contract.
   *
   * @example
   * const receipt = await wallet.contractCall({
   *   to: SCOPE_TOKEN_ADDRESS,
   *   abi: SCOPE_TOKEN_ABI,
   *   functionName: "grantSpendScope",
   *   args: [agentAddress, limit, dailyCap],
   * });
   */
  async contractCall(params: ContractCallParams): Promise<TxReceipt> {
    const hash = await this.client.writeContract({
      address: params.to,
      abi: params.abi as never,
      functionName: params.functionName,
      args: (params.args ?? []) as never,
      value: params.value ? parseEther(params.value) : undefined,
    });
    return this.waitForReceipt(hash);
  }

  /**
   * Read from a contract (no gas, no tx).
   */
  async contractRead<T = unknown>(params: ContractCallParams): Promise<T> {
    return this.publicClient.readContract({
      address: params.to,
      abi: params.abi as never,
      functionName: params.functionName,
      args: (params.args ?? []) as never,
    }) as Promise<T>;
  }

  // ─── Sign ─────────────────────────────────────────────────────────────────

  /**
   * Sign an arbitrary message (EIP-191).
   * Useful for offchain authentication or onchain attestations.
   */
  async signMessage(message: string): Promise<SignedMessage> {
    const signature = await this.client.signMessage({ message });
    return { message, signature, address: this.account.address };
  }

  /**
   * Sign typed data (EIP-712).
   */
  async signTypedData(params: {
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    primaryType: string;
    message: Record<string, unknown>;
  }): Promise<Hex> {
    return this.client.signTypedData(params as never);
  }

  // ─── Watch ────────────────────────────────────────────────────────────────

  /**
   * Watch for contract events and react in real time.
   * Returns an unwatch function to stop listening.
   *
   * @example
   * const stop = wallet.watchEvent({
   *   contractAddress: AGENT_SCOPE_ADDRESS,
   *   abi: AGENT_SCOPE_ABI,
   *   eventName: "ActionReceipt",
   *   onEvent: (log) => console.log("Agent acted:", log),
   * });
   * // Later: stop()
   */
  watchEvent(params: WatchEventParams): () => void {
    return this.publicClient.watchContractEvent({
      address: params.contractAddress,
      abi: params.abi as never,
      eventName: params.eventName as never,
      onLogs: (logs) => logs.forEach((log) => params.onEvent(log)),
    });
  }

  // ─── Utils ────────────────────────────────────────────────────────────────

  /**
   * Wait for a transaction to be mined and return a structured receipt.
   */
  async waitForReceipt(hash: Hash): Promise<TxReceipt> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
    });
    return {
      hash: receipt.transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
    };
  }

  /**
   * Get the current gas price.
   */
  async getGasPrice(): Promise<string> {
    const price = await this.publicClient.getGasPrice();
    return formatUnits(price, 9) + " gwei";
  }

  /**
   * Estimate gas for a transaction.
   */
  async estimateGas(params: {
    to: Address;
    value?: string;
    data?: Hex;
  }): Promise<bigint> {
    return this.publicClient.estimateGas({
      account: this.account.address,
      to: params.to,
      value: params.value ? parseEther(params.value) : undefined,
      data: params.data,
    });
  }
}
