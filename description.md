Split Payments across multiple wallets/lnaddresses/lnurlps seamlessly!
Once configured, it continuously splits your payments across different wallets.

Usage:

- Enable the Extension: Start by enabling the Split Payments extension.
- Select the Source Wallet: Identify and select the wallet that will receive and subsequently distribute the payments.
- Add Wallet Information for Payment Splitting: Enter the details of the wallets where the payments will be split. This could include LNURLp, LNaddress, wallet ID, or an invoice key from a different wallet. Wallet details can be found under the API Info section on each wallet's page. Optionally, assign an alias to each wallet for easier identification.
- Set Distribution Percentages: Specify the percentage of each payment that each wallet should receive. Ensure the total distribution does not exceed 100%.
- Save Your Settings: After adding or deleting wallet information, click “SAVE TARGETS” to activate the payment splits.

Note:
You can distribute payments to multiple wallets as long as their combined percentage is at or below 100%. Distribution can only total exactly 100% if all target wallets are internal.

Automatic Payment Splitting:
When the source wallet receives a payment, the extension automatically allocates the specified percentages to each designated wallet.
