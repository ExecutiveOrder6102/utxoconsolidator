# UTXO Spiciness Index (Web App)

This is a static web application that helps you measure the 'spiciness' of your Bitcoin UTXOs and estimate consolidation fees. It fetches real-time data from Blockstream, mempool.space, and CoinGecko to provide accurate fee estimations in both satoshis and USD.

The goal of this tool is to illustrate how stacking lots of small UTXOs on-chain can impact your transaction fees, especially in a high-fee environment, and to give you a fun 'Arbitrary Spicy Unit' (ASU) score. For more details, you can refer to [this article on UTXOs](https://www.discreetlog.com/utxos/).

This tool is for simple use cases where you have sent bitcoin repeatedly to the same address, otherwise known as stacking sats. If you have sent to a different address each time (as you should) you will get a better idea using something like [Sparrow Wallet](https://sparrowwallet.com/)

## Features

-   **UTXO Fetching:** Retrieves all UTXOs for a specified Bitcoin address.
-   **Real-time Fee Rates:** Fetches current recommended fee rates from mempool.space.
-   **BTC Price:** Obtains the current Bitcoin price in USD for fee conversion.
-   **Transaction Size Estimation:** Estimates the virtual byte (vB) size of a consolidation transaction, considering:
    -   Standard P2PKH, P2SH, Bech32 (P2WPKH), P2WSH, and Taproot address types.
    -   Automatic detection of M-of-N multisig configurations for P2SH and P2WSH addresses based on on-chain data.
    -   Support for user-provided M-of-N values for multisig addresses, especially useful for addresses without prior transaction history or for legacy P2SH multisig.
    -   Handles P2SH-P2WPKH (single-signature SegWit wrapped in P2SH) addresses.
-   **Fee Calculation:** Calculates estimated fees for various sat/vB rates, including the current market rate.
-   **Dynamic "Spiciness" Messages & ASU:** Provides contextual messages and calculates an 'Arbitrary Spicy Unit' (ASU) score based on the number of UTXOs, estimated transaction size, and current fee rates, adding a fun element to understanding potential transaction costs.
-   **Interactive Fee Chart:** Visualizes the estimated transaction fee in USD across a range of sat/vB rates (up to 5000 sat/vB by default). It also displays the total value of the address and highlights the point where the transaction fee would exceed the address's total value.
-   **Dynamic X-axis Scaling for Chart:** A toggle allows you to automatically scale the chart's X-axis (sat/vB) to show the fee rate at which the transaction fee would consume the entire balance of the address. This critical fee level is also displayed numerically.
-   **User-Friendly Interface:** Presents a clear summary of UTXOs, total balance, estimated transaction size, and fee breakdowns with color-coded indicators, all within an intuitive web interface.

## Arbitrary Spiciness Unit (ASU) Explained

The Arbitrary Spiciness Unit (ASU) is designed to give you a quick, relative measure of how "expensive" or "complex" it might be to consolidate your Bitcoin UTXOs.

**How it's calculated:**

The ASU is derived from the following formula:

`ASU = (Number of UTXOs × Estimated Transaction Size in vB × Current Fastest Fee Rate in sat/vB) / 100,000`

Let's break down what each part contributes:

*   **Number of UTXOs:** The more individual UTXOs you have, the more inputs your consolidation transaction will require. More inputs mean a larger transaction size and, consequently, a higher fee.
*   **Estimated Transaction Size (vB):** This is the calculated size of your consolidation transaction in virtual bytes. Factors like the number of UTXOs and the type of addresses (e.g., multisig addresses are larger than single-signature ones) influence this size. A larger transaction size directly translates to a higher fee for a given fee rate.
*   **Current Fastest Fee Rate (sat/vB):** This reflects the current demand for block space on the Bitcoin network. A higher fee rate means it costs more satoshis per virtual byte to get your transaction confirmed quickly.

The `100,000` is simply a scaling factor to keep the ASU a more manageable and readable number. Essentially, the ASU represents the estimated cost of consolidating your UTXOs at the current fastest network fee rate, expressed in a scaled-down unit of satoshis.

**Validation of Units and Values:**

The units of ASU are effectively **satoshis** (scaled down). This is appropriate because transaction fees are paid in satoshis.

*   **ASU < 1 (Good 👍):** Consolidating your UTXOs would be very inexpensive. This is typically when you have a very small number of UTXOs and/or very low network fee rates.
*   **ASU < 10 (Mild 🌶️):** Consolidating your UTXOs would be relatively inexpensive. This is usually the case when you have a small number of UTXOs, simple address types, and/or low current network fee rates.
*   **ASU < 100 (Medium 🌶️🌶️):** The cost of consolidating your UTXOs is moderate. This might be due to a moderate number of UTXOs or slightly elevated network fees.
*   **ASU < 500 (Hot 🌶️🌶️🌶️):** Consolidating your UTXOs would incur a significant cost. This often happens with a larger number of UTXOs, complex address types, or high current network fee rates.
*   **ASU < 1000 (Fiery 🔥):** The cost is very high, indicating a substantial number of UTXOs and/or very high network congestion.
*   **ASU >= 1000 (Volcanic 🔥🔥🔥):** Consolidating your UTXOs would be extremely expensive, likely due to an exceptionally large number of UTXOs or extremely high network fees. In such cases, it can become prohibitively costly.

The ASU provides a quick, intuitive way to gauge the "pain" of consolidating your UTXOs, directly correlating with the actual satoshi cost.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/utxo-consolidator.git
    cd utxo-consolidator
    ```
    *(Note: Replace `https://github.com/your-username/utxo-consolidator.git` with the actual repository URL if different.)*

2.  **Open `index.html`:**
    Since this is a static web application, you can simply open the `index.html` file in your web browser. No server-side setup or additional dependencies are required beyond a modern web browser.

## Usage

1.  Open `index.html` in your web browser.
2.  Enter the Bitcoin address you want to analyze in the "Bitcoin Address" field.
3.  (Optional) If you are analyzing a multisig address and the tool cannot automatically detect the M-of-N configuration (e.g., for addresses with no prior transaction history or legacy P2SH multisig), enter the M (required signatures) and N (total keys) values in the respective fields.
4.  (Optional) In the "Fee vs. Sat/vB Chart" section, check the "Show fee level that will make me run out of money" box to adjust the chart's X-axis and display the specific sat/vB rate where the transaction cost would equal or exceed your address's total balance. Toggling this option will update the chart dynamically without needing to re-estimate fees.
5.  Click the "Estimate Fees" button.

The application will fetch the necessary data and display the UTXO summary, estimated transaction size, and fee estimates. Look out for the "spiciness" messages that provide additional context based on your UTXO count and estimated fees. The interactive chart will help you visualize the fee impact at different sat/vB rates.

## Examples

After entering a Bitcoin address and clicking "Estimate Fees", the application will display a "Spiciness Index Results" section and a "Fee vs. Sat/vB Chart".

### Spiciness Index Results

This section provides a summary of your UTXOs and estimated transaction details:

*   **Address:** The Bitcoin address you entered.
*   **Type:** The detected address type (e.g., Bech32, P2SH).
*   **Multisig Status:** Indicates if a multisig configuration was detected or if user-provided M-of-N values are being used.
*   **UTXOs:** The number of unspent transaction outputs found for the address.
*   **Total Balance:** The total balance of the address in satoshis.
*   **Estimated Transaction Size:** The calculated size of the consolidation transaction in virtual bytes (vB), with a color-coded emoji (🟢 for small, 🟡 for medium, 🔴 for large).
*   **Fee Estimation Note:** Additional context for fee estimation, especially for multisig addresses.
*   **Spiciness Message:** Dynamic messages providing context based on UTXO count and estimated fees, including advice on consolidation.
*   **Arbitrary Spicy Units (ASU):** The calculated ASU score with its corresponding spiciness rating (e.g., "Mild 🌶️", "Volcanic 🔥🔥🔥").

### Fee vs. Sat/vB Chart

This interactive chart visualizes the estimated transaction fee in USD across a range of sat/vB rates.

*   **Orange Line:** Represents the estimated fee in USD at different sat/vB rates.
*   **Green Dashed Line:** Shows the total value of the address in USD.
*   **Red Dashed Line (if applicable):** Indicates the point where the transaction fee would exceed the address's total value, along with the specific sat/vB rate.
*   **Toggle "Show fee level that will make me run out of money":** This checkbox dynamically adjusts the chart's X-axis to focus on the critical fee level where the transaction cost equals or exceeds your address's total balance.

*(Note: The displayed values and chart will vary based on real-time data and the specific address analyzed.)*
## Testing

Unit tests verify the core utility functions used for fee and size calculations. Run them with Node.js:

```bash
npm test
```

Tests are executed automatically for pull requests targeting the `main` branch via GitHub Actions.
