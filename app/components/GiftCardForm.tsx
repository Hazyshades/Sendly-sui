'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useWallet } from '../hook/useWallet';
import axios from 'axios';
import { giftCard_Pink } from './svg/giftCard_Pink.js';
import { giftCard_Blue } from './svg/giftCard_Blue.js';
import { giftCard_Green } from './svg/giftCard_Green.js';

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_API_KEY = process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY || '';

const cardDesigns = [
  { name: 'Pink', generator: giftCard_Pink },
  { name: 'Blue', generator: giftCard_Blue },
  { name: 'Green', generator: giftCard_Green },
];

function isValidSuiAddress(address: any) {
  if (typeof address !== 'string') return false;
  return /^0x[a-fA-F0-9]+$/.test(address) && address.length >= 3;
}

async function getCoinsViaFetch(address: string, coinType: string) {
  const response = await fetch('https://sui-rpc.publicnode.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getCoins',
      params: [address, coinType],
    }),
  });
  const data = await response.json();
  console.log('RPC response for suix_getCoins:', JSON.stringify(data, null, 2));
  if (!data.result?.data) {
    console.log('No coins found for address:', address, 'coinType:', coinType);
    return [];
  }
  const coins = data.result.data.filter((coin: any) => coin.coinType === coinType);
  console.log('Filtered coins:', coins);
  return coins;
}

async function getSuiBalance(address: string): Promise<number> {
  const suiCoins = await getCoinsViaFetch(address, '0x2::sui::SUI');
  const totalBalance = suiCoins.reduce((sum: number, coin: any) => sum + parseInt(coin.balance), 0);
  return totalBalance;
}

async function checkObjectExists(objectId: string): Promise<boolean> {
  try {
    const response = await fetch('https://sui-rpc.publicnode.com/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getObject',
        params: [objectId, { showContent: true }],
      }),
    });
    const data = await response.json();
    return data.result && !data.result.error;
  } catch (e) {
    console.error('Error checking object:', e);
    return false;
  }
}

async function checkCollectionObject() {
  const response = await fetch('https://sui-rpc.publicnode.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sui_getObject',
      params: ['0x598bb18b8f112550eeb0f3491dd18fe7165de552b8e891362e65ed5a7311950f', { showContent: true, showType: true }],
    }),
  });
  const data = await response.json();
  console.log('Collection object details:', JSON.stringify(data, null, 2));
  return data.result;
}

async function getSuitableCoinObjectId(address: string, coinType: string, requiredAmount: number): Promise<string[] | null> {
  const coins = await getCoinsViaFetch(address, coinType);
  console.log('Fetched coins for address', address, 'coinType', coinType, ':', coins);
  if (!coins || coins.length === 0) {
    console.log('No coins found for coinType:', coinType);
    return null;
  }

  const validCoins = coins.filter((coin: any) => coin.coinType === coinType);
  if (validCoins.length === 0) {
    console.log('No valid coins found for coinType:', coinType);
    return null;
  }

  const totalBalance = validCoins.reduce((sum: number, coin: any) => sum + parseInt(coin.balance), 0);
  console.log('Total USDT balance:', totalBalance, 'Required:', requiredAmount);

  if (totalBalance < requiredAmount) {
    console.log('Insufficient total balance. Required:', requiredAmount, 'Available:', totalBalance);
    return null;
  }

  validCoins.sort((a: any, b: any) => parseInt(b.balance) - parseInt(a.balance));

  for (const coin of validCoins) {
    const coinExists = await checkObjectExists(coin.coinObjectId);
    if (!coinExists) {
      console.log(`Coin ${coin.coinObjectId} is outdated or does not exist`);
      continue;
    }
    if (parseInt(coin.balance) >= requiredAmount) {
      console.log(`Found suitable coin: ${coin.coinObjectId} with balance ${coin.balance}, version ${coin.version}`);
      return [coin.coinObjectId];
    }
  }

  let accumulatedBalance = 0;
  const selectedCoinIds: string[] = [];
  for (const coin of validCoins) {
    const coinExists = await checkObjectExists(coin.coinObjectId);
    if (!coinExists) {
      console.log(`Coin ${coin.coinObjectId} is outdated or does not exist`);
      continue;
    }
    accumulatedBalance += parseInt(coin.balance);
    selectedCoinIds.push(coin.coinObjectId);
    console.log(`Adding coin ${coin.coinObjectId} with balance ${coin.balance}. Accumulated: ${accumulatedBalance}`);
    if (accumulatedBalance >= requiredAmount) {
      console.log('Selected coins:', selectedCoinIds);
      return selectedCoinIds;
    }
  }

  console.log('No combination of coins found with sufficient balance');
  return null;
}

export default function GiftCardForm() {
  const { userAccount, signAndExecuteTransaction, isConnected, isLoading } = useWallet();
  const [activeTab, setActiveTab] = useState<'create' | 'redeem'>('create');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [selectedDesign, setSelectedDesign] = useState(cardDesigns[0]);
  const [svgPreview, setSvgPreview] = useState('');

  useEffect(() => {
    if (amount && Number(amount) > 0) {
      const svgString = selectedDesign.generator(Number(amount), 'USDT');
      const encoded = `data:image/svg+xml;base64,${btoa(svgString)}`;
      setSvgPreview(encoded);
    } else {
      setSvgPreview('');
    }
  }, [amount, selectedDesign]);

  async function uploadSVGAndMetadataToPinata({ amount, serviceName }: { amount: number; serviceName: string }) {
    try {
      toast.success('Uploading SVG to Pinata...');
      const svgString = selectedDesign.generator(amount, 'USDT');
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
      const svgForm = new FormData();
      svgForm.append('file', svgBlob, 'image.svg');

      const svgRes = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', svgForm, {
        maxContentLength: Infinity,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${svgForm._boundary || 'boundary'}`,
          pinata_api_key: PINATA_API_KEY,
          pinata_secret_api_key: PINATA_SECRET_API_KEY,
        },
      });

      const svgHash = svgRes.data.IpfsHash;
      const svgUrl = `https://gateway.pinata.cloud/ipfs/${svgHash}`;

      toast.success('Uploading metadata to Pinata...');

      const metadataObj = {
        name: `Gift Card $${amount}`,
        description: `Gift card for $${amount}`,
        image: svgUrl,
        attributes: [
          { trait_type: 'Amount', value: amount },
          { trait_type: 'Service', value: serviceName },
          { trait_type: 'Design', value: selectedDesign.name },
          { trait_type: 'Token', value: 'USDT' },
        ],
      };

      const metadataRes = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        metadataObj,
        {
          headers: {
            pinata_api_key: PINATA_API_KEY,
            pinata_secret_api_key: PINATA_SECRET_API_KEY,
          },
        }
      );

      const metadataHash = metadataRes.data.IpfsHash;
      return `https://gateway.pinata.cloud/ipfs/${metadataHash}`;
    } catch (e: any) {
      toast.error('Error uploading to Pinata: ' + e.message);
      throw e;
    }
  }

  async function createGiftCard() {
    console.log('createGiftCard called');
    console.log('User account:', userAccount);
    console.log('Recipient:', recipient, 'Type:', typeof recipient);

    if (!userAccount?.address) {
      toast.error('Connect wallet');
      return;
    }

    if (!amount || !recipient) {
      toast.error('Enter amount and recipient');
      return;
    }

    const cleanRecipient = recipient.trim();

    if (!isValidSuiAddress(cleanRecipient)) {
      toast.error('Invalid recipient address. Address must start with 0x');
      console.log('Invalid recipient address:', cleanRecipient);
      return;
    }

    try {
      toast.loading('Checking SUI balance for gas...', { id: 'create-gift-card' });

      const suiBalance = await getSuiBalance(userAccount.address);
      const minGasRequired = 40_000_000; // 0.05 SUI in MIST

      console.log('SUI balance:', suiBalance, 'Required for gas:', minGasRequired);

      if (suiBalance < minGasRequired) {
        const suiInSui = (suiBalance / 1_000_000_000).toFixed(4);
        const requiredInSui = (minGasRequired / 1_000_000_000).toFixed(3);
        toast.error(`Insufficient SUI for gas. You have: ${suiInSui} SUI, minimum required: ${requiredInSui} SUI`, {
          id: 'create-gift-card',
          duration: 8000
        });
        return;
      }

      const PACKAGE_ID = '0x9302c376dad40128acfe5b7c641eca13544b4d7296b59eb654d41e640dd85c67';
      const COLLECTION_OBJECT_ID = '0x598bb18b8f112550eeb0f3491dd18fe7165de552b8e891362e65ed5a7311950f';

      toast.loading('Checking collection objects...', { id: 'create-gift-card' });

      const collectionExists = await checkObjectExists(COLLECTION_OBJECT_ID);
      if (!collectionExists) {
        toast.error('Collection object not found or unavailable. The contract may have been changed.', {
          id: 'create-gift-card'
        });
        return;
      }

      const collectionDetails = await checkCollectionObject();
      if (!collectionDetails || collectionDetails.data.type !== '0x9302c376dad40128acfe5b7c641eca13544b4d7296b59eb654d41e640dd85c67::gift_card::GiftCardCollection') {
        toast.error('Collection object has invalid type or is unavailable', { id: 'create-gift-card' });
        return;
      }

      toast.loading('Creating gift card...', { id: 'create-gift-card' });

      const metadataUrl = await uploadSVGAndMetadataToPinata({
        amount: Number(amount),
        serviceName: 'Sendly Gift'
      });

      const coinType = '0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT';
      const decimals = 6; // USDT has 6 decimal places
      const amountInMinorUnits = Math.floor(Number(amount) * Math.pow(10, decimals));

      const coinObjectIds = await getSuitableCoinObjectId(userAccount.address, coinType, amountInMinorUnits);
      console.log('Found coin object IDs:', coinObjectIds, 'Required amount:', amountInMinorUnits);

      if (!coinObjectIds || coinObjectIds.length === 0) {
        toast.error(`No sufficient USDT coins found in your wallet. Required: ${amount} USDT`, {
          id: 'create-gift-card'
        });
        return;
      }

      toast.loading('Checking USDT coins...', { id: 'create-gift-card' });

      for (const coinId of coinObjectIds) {
        const coinExists = await checkObjectExists(coinId);
        if (!coinExists) {
          toast.error(`Coin ${coinId} not found or unavailable. Try refreshing the page.`, {
            id: 'create-gift-card'
          });
          return;
        }
      }

      const tx = new TransactionBlock();
      tx.setSender(userAccount.address);

      console.log('Transaction parameters:', {
        packageId: PACKAGE_ID,
        collectionObjectId: COLLECTION_OBJECT_ID,
        recipient: cleanRecipient,
        coinObjectIds: coinObjectIds,
        metadataUrl: metadataUrl,
        message: message
      });

      let coinToUse;
      if (coinObjectIds.length > 1) {
        const [firstCoin, ...restCoins] = coinObjectIds;
        coinToUse = tx.object(firstCoin);
        for (const coinId of restCoins) {
          tx.mergeCoins(coinToUse, [tx.object(coinId)]);
        }
      } else {
        coinToUse = tx.object(coinObjectIds[0]);
      }

      const [splitCoin] = tx.splitCoins(coinToUse, [tx.pure(amountInMinorUnits)]);

      tx.moveCall({
        target: `${PACKAGE_ID}::gift_card::create_gift_card`,
        typeArguments: [coinType],
        arguments: [
          tx.object(COLLECTION_OBJECT_ID),
          tx.pure.address(cleanRecipient),
          splitCoin,
          tx.pure(new TextEncoder().encode(metadataUrl), 'vector<u8>'),
          tx.pure(new TextEncoder().encode(message || ''), 'vector<u8>'),
        ],
      });

      console.log('Executing transaction...');
      let gasBudget = Math.min(suiBalance - 10_000_000, 100_000_000);
      if (gasBudget < 40_000_000) {
        gasBudget = 40_000_000;
      }

      console.log('Using gas budget:', gasBudget);

      tx.setGasBudget(gasBudget);

      const result = await signAndExecuteTransaction(tx);
      console.log('Transaction result:', result);

      toast.success('Gift card created! Tx digest: ' + result.digest, {
        id: 'create-gift-card'
      });

      setRecipient('');
      setAmount('');
      setMessage('');

    } catch (e: any) {
      console.error('Error creating gift card:', e);
      let errorMessage = 'Error creating gift card';
      if (e.message.includes('VMVerificationOrDeserializationError')) {
        errorMessage += ': Check object addresses and USDT type';
      }
      toast.error(`${errorMessage}: ${e.message}`, {
        id: 'create-gift-card'
      });
    }
  }

  async function redeemGiftCard() {
    console.log('redeemGiftCard called');
    console.log('User account:', userAccount);
    console.log('Token ID:', tokenId);

    if (!userAccount?.address) {
      toast.error('Connect wallet');
      return;
    }

    if (!tokenId) {
      toast.error('Enter token ID');
      return;
    }

    if (!isValidSuiAddress(tokenId)) {
      toast.error('Invalid token ID. ID must start with 0x');
      console.log('Invalid token ID:', tokenId);
      return;
    }

    try {
      toast.loading('Checking SUI balance for gas...', { id: 'redeem-gift-card' });

      const suiBalance = await getSuiBalance(userAccount.address);
      const minGasRequired = 20_000_000; // 0.02 SUI in MIST

      if (suiBalance < minGasRequired) {
        const suiInSui = (suiBalance / 1_000_000_000).toFixed(4);
        const requiredInSui = (minGasRequired / 1_000_000_000).toFixed(3);
        toast.error(`Insufficient SUI for gas. You have: ${suiInSui} SUI, minimum required: ${requiredInSui} SUI`, {
          id: 'redeem-gift-card',
          duration: 8000
        });
        return;
      }

      toast.loading('Redeeming gift card...', { id: 'redeem-gift-card' });

      const PACKAGE_ID = '0x9302c376dad40128acfe5b7c641eca13544b4d7296b59eb654d41e640dd85c67';

      const tx = new TransactionBlock();
      tx.setSender(userAccount.address);

      console.log('Transaction parameters:', {
        packageId: PACKAGE_ID,
        tokenId: tokenId
      });

      tx.moveCall({
        target: `${PACKAGE_ID}::gift_card::redeem_gift_card`,
        arguments: [
          tx.object(tokenId),
        ],
      });

      console.log('Executing transaction...');
      const gasBudget = Math.min(suiBalance - 5_000_000, 50_000_000);
      const result = await signAndExecuteTransaction(tx, { gasBudget });
      console.log('Transaction result:', result);

      toast.success('Gift card redeemed! Tx digest: ' + result.digest, {
        id: 'redeem-gift-card'
      });

      setTokenId('');

    } catch (e: any) {
      console.error('Error redeeming gift card:', e);
      toast.error('Error redeeming gift card: ' + e.message, {
        id: 'redeem-gift-card'
      });
    }
  }

  if (isLoading) {
    return (
      <main className="pt-28 max-w-xl mx-auto bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4">
            Loading...
          </h2>
        </div>
      </main>
    );
  }

  if (!isConnected) {
    return (
      <main className="pt-28 max-w-xl mx-auto bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4">
            Connect Wallet
          </h2>
          <p className="text-gray-600">
            To create gift cards, you need to connect your wallet using the button in the header.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="pt-28 max-w-xl mx-auto bg-white rounded-3xl shadow-2xl p-8">
      <div className="flex justify-center mb-6 space-x-4">
        <button
          className={`px-6 py-3 rounded-t-2xl font-bold text-lg transition ${
            activeTab === 'create' ? 'bg-indigo-500 text-white shadow' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
          }`}
          onClick={() => setActiveTab('create')}
        >
          Создать карту
        </button>
        <button
          className={`px-6 py-3 rounded-t-2xl font-bold text-lg transition ${
            activeTab === 'redeem' ? 'bg-indigo-500 text-white shadow' : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
          }`}
          onClick={() => setActiveTab('redeem')}
        >
          Использовать карту
        </button>
      </div>

      {activeTab === 'create' && (
        <>
          <div className="mb-4">
            <label className="block font-semibold mb-2 text-indigo-700">Card Design:</label>
            <div className="flex gap-4">
              {cardDesigns.map((design) => (
                <button
                  key={design.name}
                  type="button"
                  className={`px-4 py-2 rounded-lg border-2 font-medium transition ${
                    selectedDesign.name === design.name
                      ? 'border-indigo-500 bg-indigo-100'
                      : 'border-gray-200 bg-white hover:border-indigo-300'
                  }`}
                  onClick={() => setSelectedDesign(design)}
                >
                  {design.name}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="font-medium text-indigo-700">Token: USDT</p>
          </div>

          {svgPreview && (
            <div className="mb-6 flex justify-center">
              <img src={svgPreview} alt="Gift card preview" className="rounded-xl shadow-lg" />
            </div>
          )}

          <input
            type="text"
            placeholder="Recipient address (0x...)"
            value={recipient}
            onChange={(e) => {
              console.log('Recipient input changed:', e.target.value);
              setRecipient(e.target.value);
            }}
            className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          />
          <input
            type="number"
            placeholder="Amount (e.g., 10)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          />
          <input
            type="text"
            placeholder="Message (e.g., Happy Birthday!)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          />
          <button
            onClick={() => {
              console.log('Create Card button clicked');
              createGiftCard();
            }}
            className="w-full py-3 bg-gradient-to-r from-indigo-500 to-indigo-400 text-white rounded-xl font-bold text-lg shadow hover:from-indigo-600 hover:to-indigo-500 transition"
          >
            Создать карту
          </button>
        </>
      )}

      {activeTab === 'redeem' && (
        <div>
          <input
            type="text"
            placeholder="Token ID"
            value={tokenId}
            onChange={(e) => setTokenId(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          />
          <button
            onClick={() => {
              console.log('Redeem Card button clicked');
              redeemGiftCard();
            }}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-green-400 text-white rounded-xl font-bold text-lg shadow hover:from-green-600 hover:to-green-500 transition"
          >
            Использовать карту
          </button>
        </div>
      )}
    </main>
  );
}