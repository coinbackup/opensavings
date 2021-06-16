### Changelog
All notable changes to this project will be documented in this file.

#### [1.0.3](https://github.com/coinbackup/opensavings/releases/tag/1.0.3)
- Update bitcore API endpoint
- Fixed bug with scanning QR code in the browser

#### [1.0.2](https://github.com/coinbackup/opensavings/releases/tag/1.0.2)
- Removed broken blockchain API endpoints and added new ones
- Added `getBalance` method to blockchain explorers
- Added a fallback for when the app can't get the USD rate of a coin; it just won't show the USD value of the balance or of the fee
- Added a fallback for when the transaction can't be broadcast via APIs

#### [1.0.1](https://github.com/coinbackup/opensavings/releases/tag/1.0.1)
- Removed blockchain API endpoints which were unreliable or broken
- Added new blockchain API endpoints: bitcoinfees.earn.com (for BTC fees), chain.so (for BTC and tBTC), rest.bitcoin.com and trest.bitcoin.com (for BCH and tBCH)
- Switched to different block explorers for viewing transactions
- Corrected the donor's name
- Added a fallback for the user to enter a fee amount, when the fee can't be obtained from a blockchain API
- Added a button for the user to define a custom fee whether or not an appropriate fee can be automatically obtained
- Added version number check, to notify the user if an update is available
- Removed changelog entries from the project this was forked from

#### [1.0.0](https://github.com/coinbackup/opensavings/releases/tag/1.0.0)
- Initial release.
