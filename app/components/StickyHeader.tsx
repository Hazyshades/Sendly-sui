'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { WalletAccount } from '@mysten/wallet-standard';
import { getAdapter } from '../misc/adapter';

export default function StickyHeader() {
  const [userAccount, setUserAccount] = useState<WalletAccount | undefined>(undefined);

  useEffect(() => {
    const init = async () => {
      try {
        const adapter = await getAdapter();
        if (await adapter.canEagerConnect()) {
          await adapter.connect();
          const accounts = await adapter.getAccounts();
          if (accounts[0]) {
            setUserAccount(accounts[0]);
          }
        }
      } catch (e) {
        console.error('Eager connect failed', e);
      }
    };
    init();
  }, []);

  const connectWallet = async () => {
    try {
      const adapter = await getAdapter();
      await adapter.connect();
      const accounts = await adapter.getAccounts();
      if (accounts[0]) {
        setUserAccount(accounts[0]);
        toast.success('Wallet connected');
      }
    } catch (error) {
      console.error('Connect wallet error:', error);
      toast.error('Failed to connect wallet');
      try {
        const adapter = await getAdapter();
        await adapter.disconnect();
      } catch {}
    }
  };

  const disconnectWallet = async () => {
    try {
      const adapter = await getAdapter();
      await adapter.disconnect();
      setUserAccount(undefined);
      toast('Wallet disconnected');
    } catch (e) {
      toast.error('Failed to disconnect wallet');
      console.error(e);
    }
  };

  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-sm shadow-lg px-6 py-4 z-50 rounded-b-3xl flex items-center justify-between">
      <div className="text-2xl font-bold text-indigo-700">Sendly Gift Cards</div>
      <div>
        {!userAccount ? (
          <button
            onClick={connectWallet}
            className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold text-lg shadow hover:bg-indigo-600 transition"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="font-semibold text-indigo-700 break-all">{userAccount.address}</div>
            <button
              onClick={disconnectWallet}
              className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    </header>
  );
}