'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';

import Background from './components/Background';
import StickyHeader from './components/StickyHeader';
import GiftCardForm from './components/GiftCardForm';
import { Toaster } from 'sonner';
import { Loader } from '@react-three/drei';

const queryClient = new QueryClient();
const networks = {
  devnet: { url: getFullnodeUrl('devnet') },
  mainnet: { url: getFullnodeUrl('mainnet') },
};

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="devnet">
        <WalletProvider>
          <Background />
          <StickyHeader />
          <GiftCardForm />
          <Toaster position="bottom-left" richColors />
          <Loader />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}