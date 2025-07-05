// Utility functions used by the UTXO Spiciness Index

function getWslpb(wss) {
    if (wss <= 75) {
        return 1;
    } else if (wss <= 255) {
        return 2;
    } else {
        return 3;
    }
}

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

if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { getWslpb, getAddressType, estimateTransactionSize };
}
