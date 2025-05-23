module Sendly::GiftCard {

    use sui::object::{UID, ID};
    use sui::coin::{Coin};
    use sui::tx_context::{TxContext};
    use sui::tx_context;
    use sui::object;

    /// Структура NFT подарочной карты
    struct GiftCard<CoinType> has key, store {
        id: UID,
        amount: u64,          // Сумма в минимальных единицах стабильной монеты
        message: vector<u8>,  // Сообщение в виде байтов
        owner: address,       // Владелец NFT
    }

    /// Создание новой подарочной карты NFT
    public fun create_gift_card<CoinType: coin::Coin>(
        amount: u64,
        message: vector<u8>,
        ctx: &mut TxContext
    ): GiftCard<CoinType> {
        // Проверяем, что сумма больше 0
        assert!(amount > 0, 1);

        let sender = tx_context::sender(ctx);

        let gift_card = GiftCard<CoinType> {
            id: object::new_uid(ctx),
            amount,
            message,
            owner: sender,
        };

        gift_card
    }
}