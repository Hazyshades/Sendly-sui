module GiftCard {

    use sui::tx_context::{TxContext};
    use sui::object::{UID, ID};
    use sui::balance::{Balance, withdraw, deposit};
    use sui::coin::{Coin};

    /// Структура подарочной карты (NFT)
    struct GiftCard has key, store {
        id: UID,
        owner: address,
        amount: u64,
        token_type: Type, // Тип токена (например, USDC или USDT)
        redeemed: bool,
        message: vector<u8>,
        metadata_uri: vector<u8>,
    }

    /// Создание подарочной карты
    /// Создаёт NFT с балансом токенов, которые блокируются в контракте
    public entry fun create_gift_card<TokenType>(
        recipient: address,
        amount: u64,
        message: vector<u8>,
        metadata_uri: vector<u8>,
        ctx: &mut TxContext
    ) acquires GiftCard {
        // Получаем монеты TokenType из отправителя
        let coins: Coin<TokenType> = withdraw<TokenType>(amount, ctx);

        // Создаём NFT подарочной карты
        let gift_card = GiftCard {
            id: UID::new(ctx),
            owner: recipient,
            amount,
            token_type: Type::of<TokenType>(),
            redeemed: false,
            message,
            metadata_uri,
        };

        // Депонируем монеты в контракт (храним в объекте)
        // В SUI нет прямого контракта, поэтому монеты можно хранить в структуре или в отдельном объекте
        // Для простоты считаем, что монеты "заперты" в GiftCard (логика зависит от реализации)

        // Сохраняем NFT в объектном хранилище
        // В SUI NFT — это объект, поэтому GiftCard должен быть объектом
        // Для примера возвращаем объект
        move_to(recipient, gift_card);
    }

    /// Погашение подарочной карты
    /// Владелец NFT получает токены обратно и NFT помечается как погашенный
    public entry fun redeem_gift_card<TokenType>(
        gift_card: &mut GiftCard,
        ctx: &mut TxContext
    ) acquires GiftCard {
        // Проверяем, что вызывающий — владелец
        assert!(gift_card.owner == tx_context::sender(ctx), 1);

        // Проверяем, что карта не погашена
        assert!(!gift_card.redeemed, 2);

        // Помечаем как погашенную
        gift_card.redeemed = true;

        // Возвращаем токены владельцу
        deposit<TokenType>(gift_card.amount, gift_card.owner);

        // Можно уничтожить NFT или оставить с флагом redeemed
    }

    /// Получить информацию о подарочной карте
    public fun get_gift_card_info(gift_card: &GiftCard): (u64, bool, vector<u8>, vector<u8>) {
        (gift_card.amount, gift_card.redeemed, gift_card.message, gift_card.metadata_uri)
    }
}