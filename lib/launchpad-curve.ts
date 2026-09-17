// Bonding-curve constants the launchpad UI needs. These mirror the values the on-chain
// curve uses; the SDK keeps its own private copies for its math helpers.

// Whole tokens, for market caps computed against a float price.
export const TOTAL_SUPPLY = 1_000_000_000

// durianfun.xyz shows mcap as price × 2e9 even though the ERC20 totalSupply() is 1e9. Not a typo:
// it is their own display base, shown only as a side reference next to our real (1e9) mcap.
export const DURIANFUN_MCAP_SUPPLY = 2_000_000_000

// Wei. The full supply a curve holds before any buys.
export const INITIAL_TOKEN_SUPPLY = 1000000000n * 10n ** 18n
