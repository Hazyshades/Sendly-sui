"use client";

import { PaymasterProvider } from '../lib/PaymasterProvider';
import { WagmiConfig, createConfig, http } from 'wagmi';
import { base } from 'wagmi/chains';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { coinbaseWallet, metaMask } from 'wagmi/connectors';

const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    coinbaseWallet({
      appName: 'Sendly Gift Cards',
      chains: [base],
    }),
    metaMask({
      chains: [base],
    }),
  ],
});

export default function ProvidersWrapper({ children }) {
  return (
    <WagmiConfig config={config}>
      <OnchainKitProvider>
        <PaymasterProvider>
          {children}
        </PaymasterProvider>
      </OnchainKitProvider>
    </WagmiConfig>
  );
}