import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentWallet } from "./wallet.js";

// Mock viem to avoid real network calls in tests
vi.mock("viem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("viem")>();
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBalance: vi.fn().mockResolvedValue(1000000000000000000n), // 1 ETH
      readContract: vi.fn().mockResolvedValue(1000000n), // 1 USDC
      waitForTransactionReceipt: vi.fn().mockResolvedValue({
        transactionHash: "0xabc123",
        status: "success",
        blockNumber: 100n,
        gasUsed: 21000n,
        effectiveGasPrice: 1000000000n,
      }),
      watchContractEvent: vi.fn().mockReturnValue(() => {}),
      getGasPrice: vi.fn().mockResolvedValue(1000000000n),
      estimateGas: vi.fn().mockResolvedValue(21000n),
    })),
    createWalletClient: vi.fn(() => ({
      sendTransaction: vi.fn().mockResolvedValue("0xsendtx"),
      writeContract: vi.fn().mockResolvedValue("0xwritetx"),
      signMessage: vi.fn().mockResolvedValue("0xsignature"),
      signTypedData: vi.fn().mockResolvedValue("0xtypeddata"),
      extend: vi.fn().mockReturnThis(),
    })),
    getContract: vi.fn(() => ({
      read: {
        balanceOf: vi.fn().mockResolvedValue(1000000n),
        decimals: vi.fn().mockResolvedValue(6),
        symbol: vi.fn().mockResolvedValue("USDC"),
      },
      write: {
        transfer: vi.fn().mockResolvedValue("0xtransfertx"),
      },
    })),
  };
});

vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(() => ({
    address: "0x2012F75004C6e889405D078780AB41AE8606b85b",
  })),
}));

const TEST_PK =
  "0xe103a93ff6adde4826e0daa8cf2ba713a8cfcd1855482517512acad85f3e27dc" as const;

describe("AgentWallet", () => {
  let wallet: AgentWallet;

  beforeEach(() => {
    wallet = new AgentWallet({ privateKey: TEST_PK });
  });

  it("exposes the agent address", () => {
    expect(wallet.address).toBe("0x2012F75004C6e889405D078780AB41AE8606b85b");
  });

  it("getBalance returns formatted ETH", async () => {
    const bal = await wallet.getBalance();
    expect(bal.ethBalance).toBe("1.0");
    expect(bal.ethBalanceWei).toBe(1000000000000000000n);
  });

  it("getTokenBalance returns symbol and formatted amount", async () => {
    const bal = await wallet.getTokenBalance(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    );
    expect(bal.symbol).toBe("USDC");
    expect(bal.decimals).toBe(6);
  });

  it("sendEth returns a structured receipt", async () => {
    const receipt = await wallet.sendEth({
      to: "0xeba5076a9f5C62Cab0b8C11ac3075B725a6eE842",
      amount: "0.001",
    });
    expect(receipt.status).toBe("success");
    expect(receipt.hash).toBe("0xabc123");
  });

  it("signMessage returns address + signature", async () => {
    const signed = await wallet.signMessage("hello agent");
    expect(signed.message).toBe("hello agent");
    expect(signed.address).toBe("0x2012F75004C6e889405D078780AB41AE8606b85b");
    expect(signed.signature).toBe("0xsignature");
  });

  it("watchEvent returns an unwatch function", () => {
    const stop = wallet.watchEvent({
      contractAddress: "0x29Ff65DBA69Af3edEBC0570a7cd7f1000B66e1BA",
      abi: [],
      eventName: "ActionReceipt",
      onEvent: () => {},
    });
    expect(typeof stop).toBe("function");
  });

  it("getGasPrice returns a gwei string", async () => {
    const price = await wallet.getGasPrice();
    expect(price).toContain("gwei");
  });
});
