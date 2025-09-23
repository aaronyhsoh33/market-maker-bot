export interface PriceFeedConfig {
  ticker: string;
  priceId: string;
  description: string;
}

export const PRICE_FEEDS: Record<string, PriceFeedConfig> = {
  'BTCUSD': {
    ticker: 'BTCUSD',
    priceId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    description: 'Bitcoin / US Dollar'
  },
  'ETHUSD': {
    ticker: 'ETHUSD',
    priceId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    description: 'Ethereum / US Dollar'
  },
  'SOLUSD': {
    ticker: 'SOLUSD',
    priceId: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
    description: 'Solana / US Dollar'
  },
};

export const getAllPriceIds = (): string[] => {
  return Object.values(PRICE_FEEDS).map(feed => feed.priceId);
};

export const getPriceFeedByTicker = (ticker: string): PriceFeedConfig | undefined => {
  return PRICE_FEEDS[ticker];
};

export const getPriceFeedById = (priceId: string): PriceFeedConfig | undefined => {
  // Handle both with and without 0x prefix
  const normalizedId = priceId.startsWith('0x') ? priceId : `0x${priceId}`;
  return Object.values(PRICE_FEEDS).find(feed => feed.priceId === normalizedId);
};