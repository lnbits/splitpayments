# Split Payments - <small>[LNbits](https://github.com/lnbits/lnbits) extension</small>

<small>For more about LNBits extension check [this tutorial](https://github.com/lnbits/lnbits/wiki/LNbits-Documentation#use-cases-of-lnbits)</small>

## Have payments split between multiple wallets

LNbits Split Payments extension allows for distributing payments across multiple wallets. Set it and forget it. It will keep splitting your payments across wallets forever.

## Usage

1. After enabling the extension, choose the source wallet that will receive and distribute the Payments

![choose wallet](https://i.imgur.com/nPQudqL.png)

2. Add the wallet or wallets info to split payments to

![split wallets](https://i.imgur.com/5hCNWpg.png) - get the LNURLp, a LNaddress, wallet id, or an invoice key from a different wallet. It can be a completely different user on another instance/domain. You can get the wallet information on the API Info section on every wallet page\
 ![wallet info](https://i.imgur.com/betqflC.png) - set a wallet _Alias_ for your own identification\

- set how much, in percentage, this wallet will receive from every payment sent to the source wallet

3. When done with adding or deleting a set of targets, click "SAVE TARGETS" to make the splits effective.

4. You can have several wallets to split to, as long as the sum of the percentages is under or equal to 100%. It can only reach 100% if the targets are all internal ones.

5. When the source wallet receives a payment, the extension will automatically split the corresponding values to every wallet.
   - on receiving a 20 sats payment\
     ![get 20 sats payment](https://i.imgur.com/BKp0xvy.png)
   - source wallet gets 18 sats\
     ![source wallet](https://i.imgur.com/GCxDZ5s.png)
   - Ben's wallet (the wallet from the example) instantly, and feeless, gets the corresponding 10%, or 2 sats\
     ![ben wallet](https://i.imgur.com/MfsccNa.png)

IMPORTANT:

- If you split to a LNURLp or LNaddress through the LNURLp extension make sure your receipients allow comments ! Split&Scrub add a comment in your transaction - and if it is not allowed, the split/scrub will not take place.
- Make sure the LNURLp / LNaddress of the receipient has its min-sats set very low (e.g. 1 sat). If the wallet does not belong to you you can [check with a Decoder](https://lightningdecoder.com/), if that is the case already
- Yes, there is fees - internal and external! Updating your own wallets on your own instance will not cost any fees but sending to an external instance will. Please notice that you should therefore not split up to 100% if you send to a wallet that is external (leave 1-2% reserve for routing fees!). External fees are deducted from the individual payment percentage of the receipient

<img width="1148" alt="Bildschirm­foto 2023-05-01 um 22 14 36" src="https://user-images.githubusercontent.com/63317640/235534056-49296aeb-7295-4b4e-9f57-914a677f5ad4.png">
<img width="1402" alt="Bildschirm­foto 2023-05-01 um 22 17 52" src="https://user-images.githubusercontent.com/63317640/235534063-b2734654-7c1a-48a3-b48e-32798c232b49.png">

## Sponsored by

[![](https://cdn.shopify.com/s/files/1/0826/9235/files/cryptograffiti_logo_clear_background.png?v=1504730421)](https://cryptograffiti.com/)
