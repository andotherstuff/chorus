import { LoginArea } from "@/components/auth/LoginArea";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { ClaimOnboardingTokenButton } from "@/components/ClaimOnboardingTokenButton";
import { useCashuStore } from "@/stores/cashuStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type React from "react";
import { Link } from "react-router-dom";

interface HeaderProps {
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ className }) => {
  const cashuStore = useCashuStore();
  const onboardingStore = useOnboardingStore();
  const { user } = useCurrentUser();

  // Check if we should show the claim button
  const pendingToken = cashuStore.getPendingOnboardingToken();
  const hasClaimedToken = onboardingStore.isTokenClaimed();
  const showClaimButton = user && pendingToken && !hasClaimedToken;

  return (
    <div className={`flex justify-between items-center ${className || ""}`}>
      <Link to="/" className="contents">
        <h1 className="text-2xl font-bold flex flex-row items-center leading-none">
          <span className="text-red-500 font-extrabold text-3xl">+</span>
          chorus
        </h1>
      </Link>
      <div className="flex items-center gap-2">
        {showClaimButton ? <ClaimOnboardingTokenButton /> : <BalanceDisplay />}
        <LoginArea />
      </div>
    </div>
  );
};

export default Header;
