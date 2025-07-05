# Guidelines for Contributors

This repository contains a static web application called **UTXO Spiciness Index**.
The project estimates the cost of consolidating Bitcoin UTXOs and visualizes the
results in the browser. The application consists of vanilla HTML, CSS and
JavaScript and does not require a build step.

## Repository Structure

- `index.html` – main HTML page and entry point.
- `script.js` – client‑side JavaScript which fetches data from external APIs and
  performs fee and "spiciness" calculations.
- `style.css` – styling for the page.
- `README.md` – detailed explanation of features, usage and background.

## Running Locally

Open `index.html` directly in a modern web browser. For a lightweight local
server you may also run:

```bash
python3 -m http.server
```

and then browse to `http://localhost:8000`.

The app makes network requests to public APIs (Blockstream, mempool.space and
CoinGecko) to gather UTXO data, fee rates and BTC price information.

## Development Notes

- Keep the project dependency‑free. Avoid adding frameworks or bundlers unless
  absolutely necessary.
- Maintain readability: prefer clear variable names and concise comments.
- When editing the JavaScript, test the page in a browser to verify inputs and
  chart updates work as expected.
- If you modify `script.js` or `style.css`, check that `index.html` still loads
  correctly with no console errors.
- Update `README.md` whenever you add features or change behaviour.
- There are currently no automated tests. Perform manual testing by opening the
  page and using a variety of Bitcoin addresses.

## Contributing

- Follow standard Git practices: commit logically grouped changes with clear
  messages.
- Ensure that new code or documentation keeps the project usable without a
  complex setup.

