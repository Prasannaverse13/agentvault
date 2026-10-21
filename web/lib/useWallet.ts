import { useCallback, useEffect, useState } from "react";
import { createWalletClient, custom, type Address } from "viem";
import { CHAIN_ID_HEX, mezo } from "./chain";

type Provider = NonNullable<Window["ethereum"]>;

function buildClient(address: Address, provider: Provider) {
  return createWalletClient({ account: address, chain: mezo, transport: custom(provider) });
}

export type ConnectedClient = ReturnType<typeof buildClient>;

export function useWallet() {
  const [address, setAddress] = useState<Address | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const sync = useCallback(async () => {
    if (!window.ethereum) return;
    const [accounts, chain] = (await Promise.all([
      window.ethereum.request({ method: "eth_accounts" }),
      window.ethereum.request({ method: "eth_chainId" }),
    ])) as [string[], string];
    setAddress((accounts[0] as Address) ?? undefined);
    setChainId(Number.parseInt(chain, 16));
  }, []);

  useEffect(() => {
    void sync();
    if (!window.ethereum?.on) return;
    const onAccounts = (...args: unknown[]) => {
      const accounts = args[0] as string[];
      setAddress((accounts[0] as Address) ?? undefined);
    };
    const onChain = (...args: unknown[]) => {
      setChainId(Number.parseInt(args[0] as string, 16));
    };
    window.ethereum.on("accountsChanged", onAccounts);
    window.ethereum.on("chainChanged", onChain);
    return () => {
      window.ethereum?.removeListener?.("accountsChanged", onAccounts);
      window.ethereum?.removeListener?.("chainChanged", onChain);
    };
  }, [sync]);

  const ensureChain = useCallback(async () => {
    if (!window.ethereum) return;
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CHAIN_ID_HEX,
              chainName: mezo.name,
              nativeCurrency: mezo.nativeCurrency,
              rpcUrls: mezo.rpcUrls.default.http,
              blockExplorerUrls: [mezo.blockExplorers?.default.url],
            },
          ],
        });
      } else {
        throw err;
      }
    }
    setChainId(mezo.id);
  }, []);

  const connect = useCallback(async () => {
    setError(undefined);
    if (!window.ethereum) {
      setError("No browser wallet found. Install Rabby or MetaMask.");
      return;
    }
    setConnecting(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      await ensureChain();
      setAddress((accounts[0] as Address) ?? undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect wallet");
    } finally {
      setConnecting(false);
    }
  }, [ensureChain]);

  const disconnect = useCallback(() => {
    setAddress(undefined);
  }, []);

  const getClient = useCallback((): ConnectedClient | null => {
    if (!address || !window.ethereum) return null;
    return buildClient(address, window.ethereum);
  }, [address]);

  return {
    address,
    chainId,
    connecting,
    error,
    connect,
    disconnect,
    getClient,
    isCorrectChain: chainId === undefined || chainId === mezo.id,
    ensureChain,
  };
}
