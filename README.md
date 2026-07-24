# Forex Divergence Risk Simulator

**Estimate what the gap between the official NBE rate and the parallel market rate could cost your import business.**

## About

This tool implements the methodology described in my paper "Modeling Exchange Rate Divergence Risk in a Liberalized Forex Regime." It uses a two-state Markov switching model with Monte Carlo simulation to generate probabilistic loss distributions for Ethiopian importers.

## How It Works

1. Enter your monthly import volume and the share purchased at parallel rates
2. Set your risk threshold (the extra cost you're worried about)
3. The tool simulates 5,000 possible futures
4. See the probability of exceeding your threshold, plus median and worst-case costs

## Key Features

- Interactive simulator with instant results
- One-click stress test for NBE policy shocks
- Visual cost distribution comparison

## Technology

- Pure JavaScript/HTML/CSS
- Plotly.js for visualizations
- No data is stored or transmitted

## Related Tools

- [Markowitz Calculator](https://fitsum-asegahegn.github.io/markowitz-calculator/)
- [Bootstrap Forecaster](https://fitsum-asegahegn.github.io/bootstrap-forecaster/)

## License

MIT
