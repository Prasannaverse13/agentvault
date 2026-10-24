import { useCallback, useEffect, useRef, useState } from "react";
import { createWalletClient, custom, type Address } from "viem";
import { CORE } from "@agentvault/shared";
import { CHAIN_ID_HEX, mezo } from "./chain";

type Provider = Eip1193Provider;

type Eip6963Detail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: Provider;
};

const CONNECTED_KEY = "agentvault:wallet-connected";
export const METAMASK_DOWNLOAD = "https://metamask.io/download/";

function buildClient(address: Address, provider: Provider) {
  return createWalletClient({ account: address, chain: mezo, transport: custom(provider) });
}

export type ConnectedClient = ReturnType<typeof buildClient>;

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(CONNECTED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeFlag(on: boolean) {
  try {
    if (on) window.localStorage.setItem(CONNECTED_KEY, "1");
    else window.localStorage.removeItem(CONNECTED_KEY);
  } catch {
    // storage unavailable: connection just will not persist
  }
}

/** Turn wallet / RPC errors into a sentence a person can act on. */
export function walletErrorMessage(err: unknown): string {
  const e = err as { code?: number; shortMessage?: string; message?: string };
  if (e?.code === 4001) return "You rejected the request in MetaMask.";
  if (e?.code === -32002) return "MetaMask already has a pending request. Open the extension to continue.";
  if (e?.code === 4902) return "Mezo Testnet is not added to your wallet yet.";
  return (e?.shortMessage || e?.message || "Wallet request failed").slice(0, 180);
}

function pickLegacyMetaMask(): Provider | undefined {
  const eth = window.ethereum;
  if (!eth) return undefined;
  if (Array.isArray(eth.providers)) {
    const mm = eth.providers.find((p) => p.isMetaMask && !p.isRabby && !p.isBraveWallet);
    if (mm) return mm;
  }
  return eth;
}

export function useWallet() {
  const providerRef = useRef<Provider | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [isMetaMask, setIsMetaMask] = useState(false);
  const [address, setAddress] = useState<Address | undefined>();
  const [chainId, setChainId] = useState<number | undefined>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const adopt = useCallback((provider: Provider) => {
    providerRef.current = provider;
    setHasProvider(true);
    setIsMetaMask(Boolean(provider.isMetaMask));
  }, []);

  // EIP-6963 discovery: finds MetaMask even when another wallet owns window.ethereum.
  const discover = useCallback(
    () =>
      new Promise<Provider | null>((resolve) => {
        const found: Eip6963Detail[] = [];
        const onAnnounce = (event: Event) => {
          const detail = (event as CustomEvent<Eip6963Detail>).detail;
          if (detail?.provider) found.push(detail);
        };
        window.addEventListener("eip6963:announceProvider", onAnnounce);
        window.dispatchEvent(new Event("eip6963:requestProvider"));
        setTimeout(() => {
          window.removeEventListener("eip6963:announceProvider", onAnnounce);
          const mm = found.find((item) => item.info.rdns === "io.metamask");
          resolve(mm?.provider ?? pickLegacyMetaMask() ?? found[0]?.provider ?? null);
        }, 250);
      }),
    [],
  );

  const readState = useCallback(async (provider: Provider) => {
    const [accounts, chain] = (await Promise.all([
      provider.request({ method: "eth_accounts" }),
      provider.request({ method: "eth_chainId" }),
    ])) as [string[], string];
    setChainId(Number.parseInt(chain, 16));
    return (accounts[0] as Address | undefined) ?? undefined;
  }, []);

  // Discover on load and silently restore a previously approved session.
  useEffect(() => {
    let alive = true;
    let detach: (() => void) | undefined;

    (async () => {
      const provider = await discover();
      if (!alive || !provider) return;
      adopt(provider);

      const onAccounts = (...args: unknown[]) => {
        const accounts = args[0] as string[];
        const next = (accounts[0] as Address | undefined) ?? undefined;
        setAddress(next);
        if (!next) writeFlag(false);
      };
      const onChain = (...args: unknown[]) => {
        setChainId(Number.parseInt(args[0] as string, 16));
      };
      provider.on?.("accountsChanged", onAccounts);
      provider.on?.("chainChanged", onChain);
      detach = () => {
        provider.removeListener?.("accountsChanged", onAccounts);
        provider.removeListener?.("chainChanged", onChain);
      };

      try {
        const current = await readState(provider);
        if (alive && current && readFlag()) setAddress(current);
      } catch {
        // wallet locked or unavailable: stay disconnected
      }
    })();

    return () => {
      alive = false;
      detach?.();
    };
  }, [adopt, discover, readState]);

  const ensureChain = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) throw new Error("No wallet found");
    const current = Number.parseInt((await provider.request({ method: "eth_chainId" })) as string, 16);
    if (current === mezo.id) {
      setChainId(current);
      return;
    }
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
    } catch (err) {
      if ((err as { code?: number }).code !== 4902) throw err;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: CHAIN_ID_HEX,
            chainName: mezo.name,
            nativeCurrency: mezo.nativeCurrency,
            rpcUrls: mezo.rpcUrls.default.http,
            ...(mezo.blockExplorers ? { blockExplorerUrls: [mezo.blockExplorers.default.url] } : {}),
          },
        ],
      });
    }
    setChainId(mezo.id);
  }, []);

  const connect = useCallback(async () => {
    setError(undefined);
    setConnecting(true);
    try {
      let provider = providerRef.current;
      if (!provider) {
        provider = await discover();
        if (provider) adopt(provider);
      }
      if (!provider) {
        setError("MetaMask was not found. Install it, then refresh this page.");
        return;
      }
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const next = accounts[0] as Address | undefined;
      if (!next) throw new Error("No account was shared with the app");
      setAddress(next);
      writeFlag(true);
      setChainId(Number.parseInt((await provider.request({ method: "eth_chainId" })) as string, 16));
      // Connected either way; a refused network switch is surfaced by the header.
      try {
        await ensureChain();
      } catch (err) {
        setError(walletErrorMessage(err));
      }
    } catch (err) {
      setError(walletErrorMessage(err));
    } finally {
      setConnecting(false);
    }
  }, [adopt, discover, ensureChain]);

  const switchNetwork = useCallback(async () => {
    setError(undefined);
    try {
      await ensureChain();
    } catch (err) {
      setError(walletErrorMessage(err));
    }
  }, [ensureChain]);

  const disconnect = useCallback(async () => {
    writeFlag(false);
    setAddress(undefined);
    setError(undefined);
    try {
      await providerRef.current?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // older wallets cannot revoke; the app is still disconnected locally
    }
  }, []);

  const getClient = useCallback((): ConnectedClient | null => {
    const provider = providerRef.current;
    if (!address || !provider) return null;
    return buildClient(address, provider);
  }, [address]);

  /** Client for sending a transaction: makes sure the wallet is on Mezo first. */
  const requireClient = useCallback(async (): Promise<ConnectedClient | null> => {
    const provider = providerRef.current;
    if (!address || !provider) return null;
    await ensureChain();
    return buildClient(address, provider);
  }, [address, ensureChain]);

  const watchMusd = useCallback(async () => {
    const provider = providerRef.current;
    if (!provider) return false;
    try {
      const added = await provider.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: { address: CORE.MUSD, symbol: "MUSD", decimals: 18 },
        },
      });
      return Boolean(added);
    } catch (err) {
      setError(walletErrorMessage(err));
      return false;
    }
  }, []);

  return {
    address,
    chainId,
    connecting,
    error,
    hasProvider,
    isMetaMask,
    connect,
    disconnect,
    getClient,
    requireClient,
    switchNetwork,
    watchMusd,
    isCorrectChain: chainId === undefined || chainId === mezo.id,
    ensureChain,
  };
}
