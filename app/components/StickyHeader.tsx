'use client';

import React from 'react';
import { toast } from 'sonner';
import { useWallet } from '../hook/useWallet';

export default function StickyHeader() {
  const { userAccount, connectWallet, disconnectWallet, isLoading } = useWallet();

  const handleConnect = async () => {
    try {
      await connectWallet();
      toast.success('Wallet connected');
    } catch (error) {
      console.error('Connect wallet error:', error);
      toast.error('Failed to connect wallet');
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectWallet();
      toast('Wallet disconnected');
    } catch (e) {
      toast.error('Failed to disconnect wallet');
      console.error(e);
    }
  };

  if (isLoading) {
    return (
      <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-sm shadow-lg px-6 py-4 z-50 rounded-b-3xl flex items-center justify-between">
        <div className="text-2xl font-bold text-indigo-700">Sendly Gift Cards</div>
        <div className="px-6 py-3 bg-gray-200 text-gray-500 rounded-xl font-bold text-lg">
          Loading...
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 w-full bg-white/80 backdrop-blur-sm shadow-lg px-6 py-4 z-50 rounded-b-3xl flex items-center justify-between">
      <div className="text-2xl font-bold text-indigo-700">Sendly Gift Cards</div>
      <div>
        {!userAccount ? (
          <button
            onClick={handleConnect}
            className="px-6 py-3 bg-indigo-500 text-white rounded-xl font-bold text-lg shadow hover:bg-indigo-600 transition"
          >
            Connect Wallet
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="font-semibold text-indigo-700 break-all">
              {userAccount.address}
            </div>
            <button
              onClick={handleDisconnect}
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