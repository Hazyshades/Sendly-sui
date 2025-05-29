import { useState, useEffect } from 'react';
import { WalletAccount } from '@mysten/wallet-standard';
import { getAdapter } from '../misc/adapter';

export function useWallet() {
  const [userAccount, setUserAccount] = useState<WalletAccount | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

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
      } finally {
        setIsLoading(false);
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
        return true;
      }
      return false;
    } catch (error) {
      console.error('Connect wallet error:', error);
      try {
        const adapter = await getAdapter();
        await adapter.disconnect();
      } catch {}
      throw error;
    }
  };

  const disconnectWallet = async () => {
    try {
      const adapter = await getAdapter();
      await adapter.disconnect();
      setUserAccount(undefined);
    } catch (e) {
      console.error('Disconnect wallet error:', e);
      throw e;
    }
  };

  const signAndExecuteTransaction = async (transactionBlock: any) => {
    try {
      const adapter = await getAdapter();
      
      // Check which methods are available in the adapter
      console.log('Adapter methods:', Object.getOwnPropertyNames(adapter));
      console.log('Adapter prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(adapter)));
      
      // Try different method name variations
      if (typeof adapter.signAndExecuteTransaction === 'function') {
        const result = await adapter.signAndExecuteTransaction({
          transactionBlock,
        });
        return result;
      } else if (typeof adapter.signAndExecuteTransactionBlock === 'function') {
        const result = await adapter.signAndExecuteTransactionBlock({
          transactionBlock,
        });
        return result;
      } else if (typeof adapter.executeTransactionBlock === 'function') {
        const result = await adapter.executeTransactionBlock({
          transactionBlock,
        });
        return result;
      } else {
        // If no method is found, output all available methods
        const methods = Object.getOwnPropertyNames(adapter).filter(name => typeof adapter[name] === 'function');
        console.error('Available adapter methods:', methods);
        throw new Error(`signAndExecuteTransaction method not found. Available methods: ${methods.join(', ')}`);
      }
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  };

  return {
    userAccount,
    isLoading,
    connectWallet,
    disconnectWallet,
    signAndExecuteTransaction,
    isConnected: !!userAccount,
  };
}