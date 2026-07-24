# Forex Divergence Risk Simulator

Estimate what the gap between the official NBE rate and the parallel market rate could cost your import business.

## About

This tool implements the methodology described in my paper *"Modeling Exchange Rate Divergence Risk in a Liberalized Forex Regime"*. It uses a two-state Markov switching model with Monte Carlo simulation to generate probabilistic loss distributions for Ethiopian importers.

## How It Works

1. Enter your monthly import volume and the share purchased at parallel rates
2. Set your risk threshold (the extra cost you're worried about)
3. The tool simulates 5,000 possible futures
4. See the probability of exceeding your threshold, plus median and worst-case costs

## Key Features

- Interactive simulator with instant results
- One-click stress test for NBE policy shocks
- Visual cost distribution comparison

## Methodology

This tool implements a two-state Markov switching model with Monte Carlo simulation:

1. **Regime switching**: The spread between official and parallel rates moves between "low spread" and "high spread" regimes, each with its own mean and volatility, governed by a Markov transition matrix.

2. **Monte Carlo simulation**: 5,000 future spread paths are generated over the forecast horizon, including parameter uncertainty via bootstrap-style resampling.

3. **Blended cost calculation**: For each path, the tool computes the additional cost based on your parallel-market exposure: `V × (1-α) × s_t`.

4. **Stress testing**: One-click scenarios (official devaluation, parallel crackdown) allow you to test tail-risk exposure.

For the complete methodology, see the accompanying paper:  
[Modeling Exchange Rate Divergence Risk in a Liberalized Forex Regime](docs/Forex_Divergence_Risk_Simulator.docx)

## Technology

- Pure JavaScript/HTML/CSS
- Plotly.js for visualizations
- No data is stored or transmitted

## Related Tools

- [Markowitz Calculator](https://fitsum-asegahegn.github.io/markowitz-calculator/)
- [Bootstrap Forecaster](https://fitsum-asegahegn.github.io/bootstrap-forecaster/)

## License

MIT
