// Global variables to store data needed for chart updates
let globalEstimatedSize = 0;
let globalTotalBalanceUsd = 0;
let globalBtcPriceUsd = 0;
let globalIntersectionFeeRate = null;
let globalCurrentRate = 0; // Store current rate for chart point
let globalPredefinedRates = {}; // Store predefined rates for chart points
let feeChartInstance = null; // To store the Chart.js instance

// Base URL for all API calls. Change this if you are running your own
// self-hosted instance of mempool.space.
const MEMPOOL_API_BASE = 'https://mempool.space';

// Helper function to fetch data from an API
async function fetchData(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
}

// Fetches the UTXOs for a given Bitcoin address using the mempool.space API.
async function getUtxos(address) {
    const url = `${MEMPOOL_API_BASE}/api/address/${address}/utxo`;
    return await fetchData(url);
}

// Fetches the current fee rate recommendations from the mempool.space API.
async function getFeeRates() {
    const url = `${MEMPOOL_API_BASE}/api/v1/fees/recommended`;
    return await fetchData(url);
}

// Fetches the current price of Bitcoin in USD from mempool.space.
async function getBtcPriceUsd() {
    const url = `${MEMPOOL_API_BASE}/api/v1/prices`;
    const data = await fetchData(url);
    return data.USD;
}

// Fetches the address details from the mempool.space API.
async function getAddressDetails(address) {
    const url = `${MEMPOOL_API_BASE}/api/address/${address}/txs`;
    return await fetchData(url);
}

// Determines the Witness Script Length Prefix Bytes (WSLPB).
function getWslpb(wss) {
    if (wss <= 75) {
        return 1;
    } else if (wss <= 255) {
        return 2;
    } else {
        return 3;
    }
}

// Determines the address type based on its prefix.
function getAddressType(address) {
    if (address.startsWith("1")) {
        return "P2PKH";
    } else if (address.startsWith("3")) {
        return "P2SH";
    } else if (address.startsWith("bc1q") && address.length === 42) {
        return "Bech32";
    } else if (address.startsWith("bc1q") && address.length === 62) {
        return "P2WSH";
    } else if (address.startsWith("bc1p")) {
        return "Taproot";
    } else {
        return "Unknown";
    }
}

// Estimates the virtual byte (vB) size of a transaction.
function estimateTransactionSize(
    addressType,
    numInputs,
    numOutputs = 1,
    m = null,
    n = null,
    isLegacyP2shMultisig = false
) {
    const txOverhead = 10.5;
    const outputSize = {
        "P2PKH": 34,
        "P2SH": 32,
        "Bech32": 31,
        "P2WSH": 43,
        "Taproot": 43,
    };
    const inputSize = {
        "P2PKH": 148,
        "P2SH": 91,  // P2SH-P2WPKH (single-sig)
        "Bech32": 68,  // P2WPKH
        "P2WSH": 140,  // P2WSH 2-of-3 multisig (generic fallback)
        "Taproot": 57.5,
    };

    let inputSizeVal;

    if (isLegacyP2shMultisig && m !== null && n !== null) {
        inputSizeVal = 41 + (m * 72) + (n * 34);
    } else if (addressType === "P2SH" && m !== null && n !== null) {
        const pubkeySize = 33;
        const sigSize = 72;
        const wss = 1 + (n * (1 + pubkeySize)) + 1 + 1;
        const wslpb = getWslpb(wss);
        const wds = 1 + 1 + (m * (1 + sigSize)) + wslpb + wss;
        inputSizeVal = 76 + (wds / 4);
    } else if (addressType === "P2WSH" && m !== null && n !== null) {
        const pubkeySize = 33;
        const sigSize = 72;
        const wss = 1 + (n * (1 + pubkeySize)) + 1 + 1;
        const wslpb = getWslpb(wss);
        const wds = 1 + (m * (1 + sigSize)) + wslpb + wss;
        inputSizeVal = wds / 4;
    } else {
        if (!(addressType in inputSize) || !(addressType in outputSize)) {
            throw new Error(`Unknown address type for size estimation: ${addressType}`);
        }
        inputSizeVal = inputSize[addressType];
    }

    const estimatedSize = (
        txOverhead
        + (numInputs * inputSizeVal)
        + (numOutputs * outputSize[addressType])
    );
    return Math.floor(estimatedSize);
}

function updateFeeChart(estimatedSize, totalBalanceUsd, btcPriceUsd, intersectionFeeRate, currentRate, predefinedRates, scaleXAxis) {
    const feeRatesForChart = [];
    const feeValuesUsdForChart = [];
    const defaultMaxFeeRate = 5000; // Increased default max

    let chartMaxX = defaultMaxFeeRate;

    // Calculate the fee rate at which the fee equals the total balance
    let maxFeeRateToCalculate = Infinity;
    if (estimatedSize > 0 && btcPriceUsd > 0) {
        maxFeeRateToCalculate = (totalBalanceUsd / btcPriceUsd) * 100_000_000 / estimatedSize; // sat/vB
        maxFeeRateToCalculate = Math.ceil(maxFeeRateToCalculate * 1.2); // Add a 20% buffer
    }

    if (scaleXAxis) {
        let dynamicMax = 0;
        if (intersectionFeeRate !== null && intersectionFeeRate > 0) {
            dynamicMax = Math.max(dynamicMax, intersectionFeeRate * 1.5); // 50% buffer for intersection
        }
        // No need to consider currentRate for dynamicMax if we're capping by totalBalanceUsd
        chartMaxX = Math.max(dynamicMax, 100); // Ensure a minimum visible range, e.g., up to 100 sat/vB
    }

    // Ensure chartMaxX does not exceed the point where fee equals total balance
    chartMaxX = Math.min(chartMaxX, maxFeeRateToCalculate);

    // Generate fee rates for chart with dynamic granularity
    for (let rate = 1; rate <= chartMaxX;) {
        const fee = Math.floor(estimatedSize * rate);
        const feeUsd = (fee / 100_000_000) * btcPriceUsd;
        feeRatesForChart.push(rate);
        feeValuesUsdForChart.push(feeUsd);

        if (rate < 10) { // Very fine granularity for very low rates
            rate += 1;
        } else if (rate < 50) { // Fine granularity
            rate += 2;
        } else if (rate < 200) { // Medium granularity
            rate += 5;
        } else if (rate < 1000) { // Coarse granularity
            rate += 25;
        } else if (rate < 10000) { // Even coarser granularity
            rate += 100;
        } else { // Very coarse granularity for extremely high rates
            rate += 1000;
        }
    }

    const ctx = document.getElementById('feeChart').getContext('2d');

    if (feeChartInstance) {
        feeChartInstance.destroy(); // Destroy existing chart instance
    }

    // Prepare data for current rate and predefined rates as scatter points
    const currentRatePoint = {
        x: currentRate,
        y: (Math.floor(estimatedSize * currentRate) / 100_000_000) * btcPriceUsd
    };

    const predefinedPoints = Object.keys(predefinedRates).map(rate => ({
        x: parseInt(rate),
        y: (Math.floor(estimatedSize * parseInt(rate)) / 100_000_000) * btcPriceUsd
    }));

    feeChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: feeRatesForChart,
            datasets: [
                {
                    label: 'Estimated Fee (USD)',
                    data: feeValuesUsdForChart,
                    borderColor: '#f7931a', // Bitcoin orange
                    backgroundColor: 'rgba(247, 147, 26, 0.2)',
                    fill: true,
                    tension: 0.1
                },
                {
                    label: 'Total Address Value (USD)',
                    data: Array(feeRatesForChart.length).fill(totalBalanceUsd),
                    borderColor: '#28a745', // Green
                    borderDash: [5, 5],
                    fill: false,
                    pointRadius: 0
                },

            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                x: {
                    type: 'linear',
                    position: 'bottom',
                    title: {
                        display: true,
                        text: 'Sat/vB'
                    },
                    min: 0,
                    max: chartMaxX // Use dynamic max
                },
                y: {
                    title: {
                        display: true,
                        text: 'Fee (USD)'
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            xMin: intersectionFeeRate,
                            xMax: intersectionFeeRate,
                            borderColor: '#dc3545', // Red
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                content: intersectionFeeRate ? `Fee exceeds value at ~${Math.ceil(intersectionFeeRate)} sat/vB` : '',
                                enabled: intersectionFeeRate !== null && intersectionFeeRate <= chartMaxX,
                                position: 'top',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                font: { size: 12 }
                            }
                        }
                    }
                }
            }
        }
    });

    const runOutOfMoneyFeeLevelDisplay = document.querySelector('#runOutOfMoneyFeeLevel .highlight-value');
    const runOutOfMoneyFeeLevelContainer = document.getElementById('runOutOfMoneyFeeLevel');

    if (intersectionFeeRate !== null) {
        runOutOfMoneyFeeLevelDisplay.textContent = Math.ceil(intersectionFeeRate);
        runOutOfMoneyFeeLevelContainer.style.display = 'block';
    } else {
        runOutOfMoneyFeeLevelDisplay.textContent = '';
        runOutOfMoneyFeeLevelContainer.style.display = 'none';
    }
}

// Main function to handle the estimation process
document.getElementById('estimateFeesBtn').addEventListener('click', async () => {
    const address = document.getElementById('bitcoinAddress').value.trim();
    const multisigM = document.getElementById('multisigM').value;
    const multisigN = document.getElementById('multisigN').value;
    const scaleXAxisToggle = document.getElementById('scaleXAxisToggle');

    const resultsSection = document.getElementById('resultsSection');
    const errorSection = document.getElementById('errorSection');
    const errorMessage = document.getElementById('errorMessage');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const spicinessMessageDiv = document.getElementById('spicinessMessage');

    resultsSection.style.display = 'none';
    errorSection.style.display = 'none';
    errorMessage.textContent = '';
    spicinessMessageDiv.style.display = 'none';
    spicinessMessageDiv.textContent = '';
    spicinessMessageDiv.classList.remove('high-utxo');

    if (!address) {
        errorMessage.textContent = 'Please enter a Bitcoin address.';
        errorSection.style.display = 'block';
        return;
    }

    loadingOverlay.style.display = 'flex'; // Show loading spinner

    try {
        const addressType = getAddressType(address);
        const utxos = await getUtxos(address);
        const feeRates = await getFeeRates();
        const btcPriceUsd = await getBtcPriceUsd();

        const numUtxos = utxos.length;
        const totalBalance = utxos.reduce((sum, utxo) => sum + utxo.value, 0);

        if (numUtxos === 0) {
            errorMessage.textContent = 'No UTXOs found for this address.';
            errorSection.style.display = 'block';
            loadingOverlay.style.display = 'none';
            return;
        }

        let m = null;
        let n = null;
        let isMultisigConfirmed = false;
        let isP2shP2wpkh = false;
        let isPotentialMultisigFallback = false;

        const userProvidedM = multisigM ? parseInt(multisigM) : null;
        const userProvidedN = multisigN ? parseInt(multisigN) : null;

        let isLegacyP2shMultisig = false;

        if (addressType === "P2SH" || addressType === "P2WSH") {
            const addressDetails = await getAddressDetails(address);
            if (!addressDetails || addressDetails.length === 0) {
                isPotentialMultisigFallback = true;
            } else {
                for (const tx of addressDetails) {
                    for (const vin of tx.vin || []) {
                        if (vin.prevout && vin.prevout.scriptpubkey_address === address) {
                            if (vin.inner_witnessscript_asm) {
                                const scriptAsm = vin.inner_witnessscript_asm.split(" ");
                                if (scriptAsm[scriptAsm.length - 1] === "OP_CHECKMULTISIG") {
                                    try {
                                        m = parseInt(scriptAsm[0].replace("OP_PUSHNUM_", ""));
                                        n = parseInt(scriptAsm[scriptAsm.length - 2].replace("OP_PUSHNUM_", ""));
                                        isMultisigConfirmed = true;
                                        break;
                                    } catch (e) {
                                        // Continue if parsing fails
                                    }
                                }
                            } else if (addressType === "P2SH" && vin.scriptsig_asm && vin.scriptsig_asm.includes("0014")) {
                                isP2shP2wpkh = true;
                                break;
                            }
                        }
                    }
                    if (isMultisigConfirmed || isP2shP2wpkh) {
                        break;
                    }
                }
            }
        }

        if (!isMultisigConfirmed && userProvidedM !== null && userProvidedN !== null) {
            if (addressType === "P2SH") {
                m = userProvidedM;
                n = userProvidedN;
                isLegacyP2shMultisig = true;
                console.log(`Using user-provided M-of-N for legacy P2SH multisig: ${m}-of-${n}.`);
            } else if (addressType === "P2WSH") {
                m = userProvidedM;
                n = userProvidedN;
                isMultisigConfirmed = true;
                console.log(`Using user-provided M-of-N for P2WSH multisig: ${m}-of-${n}.`);
            }
        } else if (isMultisigConfirmed && userProvidedM !== null && userProvidedN !== null) {
            console.log(`On-chain data for ${m}-of-${n} multisig overrides user-provided flags.`);
        }

        globalEstimatedSize = estimateTransactionSize(
            addressType,
            numUtxos,
            1, // num_outputs is always 1 for consolidation
            m,
            n,
            isLegacyP2shMultisig
        );

        let sizeEmoji;
        if (globalEstimatedSize < 500) {
            sizeEmoji = "🟢";
        } else if (globalEstimatedSize < 1000) {
            sizeEmoji = "🟡";
        } else {
            sizeEmoji = "🔴";
        }

        // Display Results
        document.getElementById('displayAddress').textContent = address;
        document.getElementById('displayAddressType').textContent = addressType;

        const multisigStatusElement = document.getElementById('multisigStatus');
        if (m && n && isMultisigConfirmed) {
            multisigStatusElement.innerHTML = `✅ Detected ${m}-of-${n} Multisig!`;
        } else if (m && n && isLegacyP2shMultisig) {
            multisigStatusElement.innerHTML = `✅ Using user-provided ${m}-of-${n} legacy P2SH Multisig!`;
        } else if (isP2shP2wpkh) {
            multisigStatusElement.innerHTML = `ℹ️ P2SH-P2WPKH (single-signature SegWit wrapped in P2SH).`;
        } else if (isPotentialMultisigFallback) {
            multisigStatusElement.innerHTML = `⚠️ Potential Multisig Detected (no transaction history to confirm M-of-N).`;
        } else {
            multisigStatusElement.innerHTML = `ℹ️ Standard ${addressType} address (single-signature).`;
        }

        document.getElementById('displayUtxos').textContent = numUtxos;
        document.getElementById('displayTotalBalance').textContent = totalBalance;
        document.getElementById('displayEstimatedSize').textContent = globalEstimatedSize;
        document.getElementById('sizeEmoji').textContent = sizeEmoji;

        const feeEstimationNoteElement = document.getElementById('feeEstimationNote');
        if (isMultisigConfirmed) {
            feeEstimationNoteElement.textContent = `(Fee estimation based on a ${m}-of-${n} multisig input size)`;
        } else if (isLegacyP2shMultisig) {
            feeEstimationNoteElement.textContent = `(Fee estimation based on a ${m}-of-${n} legacy P2SH multisig input size)`;
        } else if (isPotentialMultisigFallback) {
            feeEstimationNoteElement.textContent = `(Fee estimation based on a generic 2-of-3 multisig input size)`;
        } else {
            feeEstimationNoteElement.textContent = '';
        }

        // Spiciness messages
        let spicyMessage = '';
        if (numUtxos > 10) {
            spicyMessage += `🌶️ You have ${numUtxos} UTXOs! Consolidating them will be a spicy transaction.`;
            spicinessMessageDiv.classList.add('high-utxo');
        }

        const currentFee = Math.floor(globalEstimatedSize * (feeRates.fastestFee || 0));
        if (currentFee > 100000) { // Example threshold for high fee (100,000 sats)
            if (spicyMessage) spicyMessage += '\n';
            spicyMessage += `🔥 Your estimated fee of ${currentFee} sats is quite high! Consider consolidating during lower network activity.`;
        }

        if (spicyMessage) {
            spicinessMessageDiv.textContent = spicyMessage;
            spicinessMessageDiv.style.display = 'block';
        }

        // Store global values for chart updates
        globalTotalBalanceUsd = (totalBalance / 100_000_000) * btcPriceUsd;
        globalBtcPriceUsd = btcPriceUsd;
        globalCurrentRate = feeRates.fastestFee || 0;

        // Calculate Arbitrary Spicy Units (ASU)
        const asu = (numUtxos * globalEstimatedSize * globalCurrentRate) / 100000; // Divide by 100,000 to keep the number manageable
        let asuRatingText = '';
        if (asu < 1) {
            asuRatingText = '(Good 👍)';
        } else if (asu < 10) {
            asuRatingText = '(Mild 🌶️)';
        } else if (asu < 100) {
            asuRatingText = '(Medium 🌶️🌶️)';
        } else if (asu < 500) {
            asuRatingText = '(Hot 🌶️🌶️🌶️)';
        } else if (asu < 1000) {
            asuRatingText = '(Fiery 🔥)';
        } else {
            asuRatingText = '(Volcanic 🔥🔥🔥)';
        }

        const displayAsuElement = document.getElementById('displayAsu');
        if (displayAsuElement) {
            displayAsuElement.textContent = asu.toFixed(2);
        }
        const asuRatingElement = document.getElementById('asuRating');
        if (asuRatingElement) {
            asuRatingElement.textContent = asuRatingText;
        }

        // Add consolidation advice
        let adviceMessage = '';
        if (numUtxos > 0) { // Only show advice if there are UTXOs
            const currentRateForDisplay = globalCurrentRate > 0 ? globalCurrentRate : 1; // Ensure at least 1 for display
            const currentRateCostUsd = (Math.floor(globalEstimatedSize * currentRateForDisplay) / 100_000_000) * btcPriceUsd;
            const highFeeRate = 500; // Example high fee rate
            const highFeeCostUsd = (Math.floor(globalEstimatedSize * highFeeRate) / 100_000_000) * btcPriceUsd;

            const formattedCurrentCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentRateCostUsd);
            const formattedHighCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(highFeeCostUsd);

            const lowFeeRate = 1; // Example low fee rate
            const lowFeeCostUsd = (Math.floor(globalEstimatedSize * lowFeeRate) / 100_000_000) * btcPriceUsd;
            const formattedLowCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(lowFeeCostUsd);

            adviceMessage += `Your UTXOs are ${asuRatingText.toLowerCase().replace(/\(|\)/g, '')} with an ASU of ${asu.toFixed(2)}.\n\n`;
            adviceMessage += `Consolidating them at the current rate (${currentRateForDisplay} sat/vB) would cost ${formattedCurrentCost}.

`;

            if (highFeeRate > currentRateForDisplay) {
                const difference = highFeeCostUsd - currentRateCostUsd;
                const formattedDifference = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(difference));
                const comparisonWord = difference > 0 ? 'more' : 'less';
                adviceMessage += `If fees were to rise to ${highFeeRate} sat/vB, the cost would be ${formattedHighCost}. This is ${formattedDifference} ${comparisonWord} than the current rate.

`;
            } else {
                adviceMessage += `Even at ${highFeeRate} sat/vB, the cost would be ${formattedHighCost}.

`;
            }

            if (globalCurrentRate > lowFeeRate) {
                adviceMessage += `For comparison, consolidating at a very low rate (${lowFeeRate} sat/vB) would cost ${formattedLowCost}.

`;
            }

            // Calculate and display future savings if consolidated to 1 UTXO
            const singleUtxoEstimatedSize = estimateTransactionSize(
                addressType,
                1, // numInputs = 1 for a single UTXO
                1, // num_outputs is always 1 for consolidation
                m,
                n,
                isLegacyP2shMultisig
            );

            const singleUtxoCurrentCostUsd = (Math.floor(singleUtxoEstimatedSize * currentRateForDisplay) / 100_000_000) * btcPriceUsd;
            const singleUtxoHighCostUsd = (Math.floor(singleUtxoEstimatedSize * highFeeRate) / 100_000_000) * btcPriceUsd;
            const singleUtxoLowCostUsd = (Math.floor(singleUtxoEstimatedSize * lowFeeRate) / 100_000_000) * btcPriceUsd;

            const formattedSingleUtxoCurrentCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(singleUtxoCurrentCostUsd);
            const formattedSingleUtxoHighCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(singleUtxoHighCostUsd);
            const formattedSingleUtxoLowCost = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(singleUtxoLowCostUsd);

            adviceMessage += `If you were to consolidate your UTXOs into a single UTXO, future transactions from this address would be significantly cheaper. For example, a transaction with just one UTXO would cost:
`;

            const currentSaving = currentRateCostUsd - singleUtxoCurrentCostUsd;
            const highSaving = highFeeCostUsd - singleUtxoHighCostUsd;
            const lowSaving = lowFeeCostUsd - singleUtxoLowCostUsd;

            const formattedCurrentSaving = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentSaving);
            const formattedHighSaving = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(highSaving);
            const formattedLowSaving = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(lowSaving);

            adviceMessage += `- At current rates (${currentRateForDisplay} sat/vB): ${formattedSingleUtxoCurrentCost} - saving ${formattedCurrentSaving} 💰💰
`;
            adviceMessage += `- At high rates (${highFeeRate} sat/vB): ${formattedSingleUtxoHighCost} - saving ${formattedHighSaving} 💰💰
`;
            adviceMessage += `- At low rates (${lowFeeRate} sat/vB): ${formattedSingleUtxoLowCost} - saving ${formattedLowSaving} 💰💰

`;

            adviceMessage += `Consult the chart above to see how bad things can get if you don't consolidate!`;
        }

        // Combine spicyMessage and adviceMessage and set content
        let finalMessage = spicyMessage;
        if (spicyMessage && adviceMessage) {
            finalMessage += '\n\n'; // Add two newlines if both messages exist
        } else if (!spicyMessage && adviceMessage) {
            // If only adviceMessage exists, it already handles its own leading newlines
            // No extra newlines needed here
        }
        finalMessage += adviceMessage;

        if (finalMessage) {
            spicinessMessageDiv.textContent = finalMessage;
            spicinessMessageDiv.style.display = 'block';
        }

        // Calculate intersection fee rate
        if (globalEstimatedSize > 0) {
            globalIntersectionFeeRate = (totalBalance / globalEstimatedSize);
        } else {
            globalIntersectionFeeRate = null;
        }

        // Initial chart render
        updateFeeChart(globalEstimatedSize, globalTotalBalanceUsd, globalBtcPriceUsd, globalIntersectionFeeRate, globalCurrentRate, globalPredefinedRates, scaleXAxisToggle.checked);

        resultsSection.style.display = 'block';

    } catch (e) {
        errorMessage.textContent = `Error: ${e.message}`;
        errorSection.style.display = 'block';
        console.error(e);
    } finally {
        loadingOverlay.style.display = 'none'; // Hide loading spinner
    }
});

// Event listener for the new toggle
document.getElementById('scaleXAxisToggle').addEventListener('change', () => {
    const scaleXAxisToggle = document.getElementById('scaleXAxisToggle');
    // Redraw chart with updated scale preference using globally stored data
    updateFeeChart(globalEstimatedSize, globalTotalBalanceUsd, globalBtcPriceUsd, globalIntersectionFeeRate, globalCurrentRate, globalPredefinedRates, scaleXAxisToggle.checked);
});