import { useQuery } from "@tanstack/react-query";

interface BitcoinPrice {
  USD: number;
}

export function useBitcoinPrice() {
  return useQuery({
    queryKey: ["bitcoin-price"],
    queryFn: async () => {
      const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=BTC");

      if (!response.ok) {
        throw new Error("Failed to fetch Bitcoin price");
      }

      const data = await response.json();
      const usdPrice = parseFloat(data.data.rates.USD);

      return { USD: usdPrice };
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    staleTime: 5000, // Consider data fresh for 5 seconds
  });
}

export function satsToUSD(sats: number, bitcoinPrice: number | null): number {
  if (!bitcoinPrice) return 0;
  // Convert sats to BTC (1 BTC = 100,000,000 sats)
  const btc = sats / 100_000_000;
  // Convert BTC to USD
  return btc * bitcoinPrice;
}

export function formatUSD(amount: number): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  // Remove the $ symbol from the formatted string
  const withoutDollar = formatted.replace('$', '');

  return `${withoutDollar} usd`;
}