import { LoginArea } from "@/components/auth/LoginArea";
import { CashuHistoryCard } from "@/components/cashu/CashuHistoryCard";
import { CashuTokenCard } from "@/components/cashu/CashuTokenCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { CashuWalletLightningCard } from "@/components/cashu/CashuWalletLightningCard";
import { CashuWalletCard } from "@/components/cashu/CashuWalletCard";
import { NutzapCard } from "@/components/cashu/NutzapCard";
import Header from "@/components/ui/Header";
import { Separator } from "@/components/ui/separator";

export function CashuWallet() {
  const { user } = useCurrentUser();

  return (
    <div className="container mx-auto py-3 px-3 sm:px-4">
      <Header />
      <Separator className="my-4" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CashuWalletCard />
        <NutzapCard />
        <CashuWalletLightningCard />
        {/* <CashuTokenCard /> */}
        <CashuHistoryCard />
      </div>

      {!user && (
        <div className="mt-8 p-4 bg-muted rounded-lg text-center">
          <p className="text-lg font-medium">Log in to use your Cashu wallet</p>
          <p className="text-muted-foreground">
            Your wallet data is stored encrypted on Nostr relays and follows you
            across applications.
          </p>
        </div>
      )}
    </div>
  );
}

export default CashuWallet;
