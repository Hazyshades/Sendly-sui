module gift_card::gift_card {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::event;
    use sui::url::{Self, Url};
    use std::string::{Self, String};
    use sui::balance::{Self, Balance};
    //use 0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT;
    struct USDC has drop {}


    struct GiftCard has key, store {
        id: UID,
        amount: u64,
        redeemed: bool,
        message: String,
        metadata_uri: Url,
        balance_usdt: Balance<USDT>,
    }

    struct GiftCardCollection has key {
        id: UID,
        token_id_counter: u64,
        admin: address,
    }

    struct GiftCardCreated has copy, drop {
        gift_card_id: ID,
        recipient: address,
        amount: u64,
        uri: String,
        message: String,
    }

    struct GiftCardRedeemed has copy, drop {
        gift_card_id: ID,
        redeemer: address,
        amount: u64,
    }

    const EAlreadyRedeemed: u64 = 1;

    fun init(ctx: &mut TxContext) {
        let collection = GiftCardCollection {
            id: object::new(ctx),
            token_id_counter: 0,
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(collection);
    }

    public entry fun create_gift_card(
        collection: &mut GiftCardCollection,
        recipient: address,
        coin: Coin<USDT>, 
        metadata_uri: vector<u8>,
        message: vector<u8>,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&coin);
        let balance = coin::into_balance(coin);
        
        collection.token_id_counter = collection.token_id_counter + 1;
        
        let gift_card = GiftCard {
            id: object::new(ctx),
            amount,
            redeemed: false,
            message: string::utf8(message),
            metadata_uri: url::new_unsafe_from_bytes(metadata_uri),
            balance_usdt: balance, 
        };
        
        let gift_card_id = object::id(&gift_card);
        
        event::emit(GiftCardCreated {
            gift_card_id,
            recipient,
            amount,
            uri: string::from_ascii(url::inner_url(&gift_card.metadata_uri)),
            message: gift_card.message,
        });
        
        transfer::transfer(gift_card, recipient);
    }

    public entry fun redeem_gift_card(
        gift_card: &mut GiftCard,
        ctx: &mut TxContext
    ) {
        assert!(!gift_card.redeemed, EAlreadyRedeemed);
        
        gift_card.redeemed = true;
        
        let balance = balance::withdraw_all(&mut gift_card.balance_usdt); 
        let coin = coin::from_balance(balance, ctx);
        
        event::emit(GiftCardRedeemed {
            gift_card_id: object::id(gift_card),
            redeemer: tx_context::sender(ctx),
            amount: gift_card.amount,
        });
        
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    public fun get_gift_card_info(gift_card: &GiftCard): (u64, bool, String, String) {
        (
            gift_card.amount,
            gift_card.redeemed,
            gift_card.message,
            string::from_ascii(url::inner_url(&gift_card.metadata_uri))
        )
    }

    #[test_only]
    public fun mint_usdt_for_testing(amount: u64, ctx: &mut TxContext): Coin<USDT> { 
        coin::mint_for_testing<USDT>(amount, ctx)
    }
}