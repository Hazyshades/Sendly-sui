'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { TransactionBlock } from '@mysten/sui.js/transactions';
import { useWallet } from '../hook/useWallet';
import axios from 'axios';
// Импорты SVG генераторов (пример)
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
  // Улучшенная валидация адреса Sui
  const cleanAddress = address.trim();
  if (!cleanAddress.startsWith('0x')) return false;
  
  // Проверяем длину (должна быть 66 символов для полного адреса или меньше для сокращенного)
  if (cleanAddress.length < 3 || cleanAddress.length > 66) return false;
  
  // Проверяем что после 0x только hex символы
  const hexPart = cleanAddress.slice(2);
  return /^[a-fA-F0-9]+$/.test(hexPart);
}

// Функция для нормализации адреса Sui
function normalizeAddress(address: string): string {
  const cleaned = address.trim().toLowerCase();
  if (cleaned.startsWith('0x')) {
    // Убираем 0x, добавляем нули до длины 64 символа, затем возвращаем 0x
    const hex = cleaned.slice(2);
    const padded = hex.padStart(64, '0');
    return `0x${padded}`;
  }
  return address;
}

async function getCoinsViaFetch(address: string, coinType: string) {
  const normalizedAddress = normalizeAddress(address);
  
  const response = await fetch('https://sui-rpc.publicnode.com/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getCoins',
      params: [normalizedAddress, coinType],
    }),
  });
  const data = await response.json();
  console.log('RPC response for suix_getCoins:', JSON.stringify(data, null, 2));
  if (!data.result?.data) {
    console.log('No coins found for address:', normalizedAddress, 'coinType:', coinType);
    return [];
  }
  const coins = data.result.data.filter((coin: any) => coin.coinType === coinType);
  console.log('Filtered coins:', coins);
  return coins;
}

// Новая функция для проверки баланса SUI
async function getSuiBalance(address: string): Promise<number> {
  const suiCoins = await getCoinsViaFetch(address, '0x2::sui::SUI');
  const totalBalance = suiCoins.reduce((sum: number, coin: any) => sum + parseInt(coin.balance), 0);
  return totalBalance;
}

export default function GiftCardForm() {
  const { userAccount, signAndExecuteTransaction, isConnected, isLoading } = useWallet();
  const [activeTab, setActiveTab] = useState<'create' | 'redeem'>('create');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [tokenId, setTokenId] = useState('');
  const [tokenType, setTokenType] = useState<'USDC' | 'USDT' | 'SUI'>('USDC');
  const [selectedDesign, setSelectedDesign] = useState(cardDesigns[0]);
  const [svgPreview, setSvgPreview] = useState('');

  useEffect(() => {
    if (amount && Number(amount) > 0) {
      const svgString = selectedDesign.generator(Number(amount), tokenType);
      const encoded = `data:image/svg+xml;base64,${btoa(svgString)}`;
      setSvgPreview(encoded);
    } else {
      setSvgPreview('');
    }
  }, [amount, selectedDesign, tokenType]);

  async function uploadSVGAndMetadataToPinata({ amount, serviceName }: { amount: number; serviceName: string }) {
    try {
      toast.success('Uploading SVG to Pinata...');
      const svgString = selectedDesign.generator(amount, tokenType);
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
          { trait_type: 'Token', value: tokenType },
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
    console.log('Total USDC balance:', totalBalance, 'Required:', requiredAmount);
  
    if (totalBalance < requiredAmount) {
      console.log('Insufficient total balance. Required:', requiredAmount, 'Available:', totalBalance);
      return null;
    }
  
    validCoins.sort((a: any, b: any) => parseInt(b.balance) - parseInt(a.balance));
  
    for (const coin of validCoins) {
      if (parseInt(coin.balance) >= requiredAmount) {
        console.log(`Found suitable coin: ${coin.coinObjectId} with balance ${coin.balance}`);
        return [coin.coinObjectId];
      }
    }
  
    let accumulatedBalance = 0;
    const selectedCoinIds: string[] = [];
    for (const coin of validCoins) {
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

  // Функция для проверки существования объекта
  async function checkObjectExists(objectId: string): Promise<{ exists: boolean; error?: string }> {
    try {
      const normalizedId = normalizeAddress(objectId);
      const response = await fetch('https://sui-rpc.publicnode.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sui_getObject',
          params: [normalizedId, { showContent: true }],
        }),
      });
      const data = await response.json();
      
      if (data.error) {
        return { exists: false, error: data.error.message };
      }
      
      if (data.result?.error) {
        return { exists: false, error: data.result.error };
      }
      
      return { exists: !!data.result && !data.result.error };
    } catch (e) {
      console.error('Error checking object:', e);
      return { exists: false, error: e.message };
    }
  }

  async function createGiftCard() {
    console.log('createGiftCard called');
    console.log('User account:', userAccount);
    console.log('Recipient:', recipient, 'Type:', typeof recipient);
  
    if (!userAccount?.address) {
      toast.error('Подключите кошелек');
      return;
    }
  
    if (!amount || !recipient) {
      toast.error('Введите сумму и адрес получателя');
      return;
    }
  
    const cleanRecipient = recipient.trim();
  
    if (!isValidSuiAddress(cleanRecipient)) {
      toast.error('Неверный адрес получателя. Адрес должен начинаться с 0x');
      console.log('Invalid recipient address:', cleanRecipient);
      return;
    }
  
    try {
      toast.loading('Проверяем баланс SUI для газа...', { id: 'create-gift-card' });
      
      // Проверяем баланс SUI для газа
      const suiBalance = await getSuiBalance(userAccount.address);
      const minGasRequired = 50_000_000; // 0.05 SUI в MIST
      
      console.log('SUI balance:', suiBalance, 'Required for gas:', minGasRequired);
      
      if (suiBalance < minGasRequired) {
        const suiInSui = (suiBalance / 1_000_000_000).toFixed(4);
        const requiredInSui = (minGasRequired / 1_000_000_000).toFixed(3);
        toast.error(`Недостаточно SUI для оплаты газа. У вас: ${suiInSui} SUI, требуется минимум: ${requiredInSui} SUI`, {
          id: 'create-gift-card',
          duration: 8000
        });
        return;
      }

      // Проверяем объекты перед созданием транзакции
      const PACKAGE_ID = '0x99d953bfd9e91e1447548952dbd138f7fe0c442acec543ccad3d0da4c85771f5';
      const COLLECTION_OBJECT_ID = '0x93d02b26c108f198d8d27af85d438e6a19ed2e0a7d0d9d3a7e577d8017406160';
      
      toast.loading('Проверяем объекты коллекции...', { id: 'create-gift-card' });
      
      const collectionCheck = await checkObjectExists(COLLECTION_OBJECT_ID);
      if (!collectionCheck.exists) {
        toast.error(`Объект коллекции не найден: ${collectionCheck.error || 'неизвестная ошибка'}`, {
          id: 'create-gift-card'
        });
        return;
      }

      toast.loading('Создание подарочной карты...', { id: 'create-gift-card' });
  
      const metadataUrl = await uploadSVGAndMetadataToPinata({
        amount: Number(amount), 
        serviceName: 'Sendly Gift'
      });
  
      const coinType = '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC';
      const decimals = 6;
      const amountInMinorUnits = Math.floor(Number(amount) * Math.pow(10, decimals));
  
      const coinObjectIds = await getSuitableCoinObjectId(userAccount.address, coinType, amountInMinorUnits);
      console.log('Found coin object IDs:', coinObjectIds, 'Required amount:', amountInMinorUnits);
  
      if (!coinObjectIds || coinObjectIds.length === 0) {
        toast.error(`В вашем кошельке не найдено достаточно монет USDC. Требуется: ${amount} USDC`, {
          id: 'create-gift-card'
        });
        return;
      }

      // Проверяем существование всех монет
      toast.loading('Проверяем монеты USDC...', { id: 'create-gift-card' });
      
      for (const coinId of coinObjectIds) {
        const coinCheck = await checkObjectExists(coinId);
        if (!coinCheck.exists) {
          toast.error(`Монета ${coinId} не найдена: ${coinCheck.error || 'неизвестная ошибка'}`, {
            id: 'create-gift-card'
          });
          return;
        }
      }
  
      const tx = new TransactionBlock();
      
      // Нормализуем адреса
      const normalizedSender = normalizeAddress(userAccount.address);
      const normalizedRecipient = normalizeAddress(cleanRecipient);
      
      tx.setSender(normalizedSender);
      
      console.log('Transaction parameters:', {
        packageId: PACKAGE_ID,
        collectionObjectId: COLLECTION_OBJECT_ID,
        sender: normalizedSender,
        recipient: normalizedRecipient,
        coinObjectIds: coinObjectIds,
        metadataUrl: metadataUrl,
        message: message
      });

      // Если нужно объединить монеты
      let coinToUse;
      if (coinObjectIds.length > 1) {
        const [firstCoin, ...restCoins] = coinObjectIds.map(id => normalizeAddress(id));
        coinToUse = tx.object(firstCoin);
        
        // Объединяем остальные монеты с первой
        for (const coinId of restCoins) {
          tx.mergeCoins(coinToUse, [tx.object(coinId)]);
        }
      } else {
        coinToUse = tx.object(normalizeAddress(coinObjectIds[0]));
      }

      // Разделяем нужную сумму из монеты
      const [splitCoin] = tx.splitCoins(coinToUse, [tx.pure.u64(amountInMinorUnits)]);
  
      // Вызов Move функции с правильными типами параметров
      tx.moveCall({
        target: `${PACKAGE_ID}::gift_card::create_gift_card`,
        typeArguments: [coinType],
        arguments: [
          tx.object(normalizeAddress(COLLECTION_OBJECT_ID)),
          tx.pure.address(normalizedRecipient),
          splitCoin,
          tx.pure.string(metadataUrl),
          tx.pure.string(message || ''),
        ],
      });
  
      console.log('Executing transaction...');
      
      // Устанавливаем разумный газовый бюджет
      const gasBudget = 100_000_000; // 0.1 SUI
      tx.setGasBudget(gasBudget);
      
      console.log('Using gas budget:', gasBudget);
      
      const result = await signAndExecuteTransaction(tx);
      console.log('Transaction result:', result);
  
      toast.success('Подарочная карта создана! Tx digest: ' + result.digest, {
        id: 'create-gift-card'
      });
  
      setRecipient('');
      setAmount('');
      setMessage('');
  
    } catch (e: any) {
      console.error('Error creating gift card:', e);
      toast.error('Ошибка создания подарочной карты: ' + e.message, {
        id: 'create-gift-card'
      });
    }
  }

  async function redeemGiftCard() {
    console.log('redeemGiftCard called');
    console.log('User account:', userAccount);
    console.log('Token ID:', tokenId);
  
    if (!userAccount?.address) {
      toast.error('Подключите кошелек');
      return;
    }
  
    if (!tokenId) {
      toast.error('Введите ID токена');
      return;
    }
  
    if (!isValidSuiAddress(tokenId)) {
      toast.error('Неверный ID токена. ID должен начинаться с 0x');
      console.log('Invalid token ID:', tokenId);
      return;
    }
  
    try {
      toast.loading('Проверяем баланс SUI для газа...', { id: 'redeem-gift-card' });
      
      // Проверяем баланс SUI для газа
      const suiBalance = await getSuiBalance(userAccount.address);
      const minGasRequired = 20_000_000; // 0.02 SUI в MIST
      
      if (suiBalance < minGasRequired) {
        const suiInSui = (suiBalance / 1_000_000_000).toFixed(4);
        const requiredInSui = (minGasRequired / 1_000_000_000).toFixed(3);
        toast.error(`Недостаточно SUI для оплаты газа. У вас: ${suiInSui} SUI, требуется минимум: ${requiredInSui} SUI`, {
          id: 'redeem-gift-card',
          duration: 8000
        });
        return;
      }

      // Проверим существование токена
      toast.loading('Проверяем токен...', { id: 'redeem-gift-card' });
      
      const tokenCheck = await checkObjectExists(tokenId);
      if (!tokenCheck.exists) {
        toast.error(`Токен не найден: ${tokenCheck.error || 'неизвестная ошибка'}`, {
          id: 'redeem-gift-card'
        });
        return;
      }

      toast.loading('Погашение подарочной карты...', { id: 'redeem-gift-card' });
  
      const PACKAGE_ID = '0x99d953bfd9e91e1447548952dbd138f7fe0c442acec543ccad3d0da4c85771f5';
      
      const tx = new TransactionBlock();
      
      const normalizedSender = normalizeAddress(userAccount.address);
      const normalizedTokenId = normalizeAddress(tokenId);
      
      tx.setSender(normalizedSender);
  
      console.log('Transaction parameters:', {
        packageId: PACKAGE_ID,
        sender: normalizedSender,
        tokenId: normalizedTokenId
      });
  
      tx.moveCall({
        target: `${PACKAGE_ID}::gift_card::redeem_gift_card`,
        arguments: [
          tx.object(normalizedTokenId),
        ],
      });
  
      console.log('Executing transaction...');
      
      // Устанавливаем газовый бюджет
      const gasBudget = 50_000_000; // 0.05 SUI
      tx.setGasBudget(gasBudget);
      
      const result = await signAndExecuteTransaction(tx);
      console.log('Transaction result:', result);
  
      toast.success('Подарочная карта погашена! Tx digest: ' + result.digest, {
        id: 'redeem-gift-card'
      });
  
      setTokenId('');
  
    } catch (e: any) {
      console.error('Error redeeming gift card:', e);
      toast.error('Ошибка погашения подарочной карты: ' + e.message, {
        id: 'redeem-gift-card'
      });
    }
  }

  if (isLoading) {
    return (
      <main className="pt-28 max-w-xl mx-auto bg-white rounded-3xl shadow-2xl p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-indigo-700 mb-4">
            Загрузка...
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
            Подключите кошелек
          </h2>
          <p className="text-gray-600">
            Для создания подарочных карт необходимо подключить кошелек через кнопку в шапке сайта.
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
            <label className="block font-semibold mb-2 text-indigo-700">Дизайн карты:</label>
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

          <div className="flex gap-8 items-center mb-3">
            <label className="font-medium flex items-center">
              <input
                type="radio"
                value="USDC"
                checked={tokenType === 'USDC'}
                onChange={() => setTokenType('USDC')}
                className="mr-2 accent-indigo-500"
              />
              USDC
            </label>
            <label className="font-medium flex items-center">
              <input
                type="radio"
                value="USDT"
                checked={tokenType === 'USDT'}
                onChange={() => setTokenType('USDT')}
                className="mr-2 accent-indigo-500"
              />
              USDT
            </label>
            <label className="font-medium flex items-center">
              <input
                type="radio"
                value="SUI"
                checked={tokenType === 'SUI'}
                onChange={() => setTokenType('SUI')}
                className="mr-2 accent-indigo-500"
              />
              SUI
            </label>
          </div>

          {svgPreview && (
            <div className="mb-6 flex justify-center">
              <img src={svgPreview} alt="Gift card preview" className="rounded-xl shadow-lg" />
            </div>
          )}

          <input
            type="text"
            placeholder="Адрес получателя (0x...)"
            value={recipient}
            onChange={(e) => {
              console.log('Recipient input changed:', e.target.value);
              setRecipient(e.target.value);
            }}
            className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          />
          <input
            type="number"
            placeholder="Сумма (например, 10)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-indigo-200 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
          />
          <input
            type="text"
            placeholder="Сообщение (например, С Днем Рождения!)"
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
            placeholder="ID токена"
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