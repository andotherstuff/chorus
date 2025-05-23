import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import LoginDialog from "@/components/auth/LoginDialog";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { EditProfileForm } from "@/components/EditProfileForm";
import { generateFakeName } from "@/lib/utils";
import { useNostrLogin, NLogin } from "@nostrify/react/login";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { generateSecretKey, nip19 } from "nostr-tools";
import { toast } from "@/hooks/useToast";
import { useCreateCashuWallet } from "@/hooks/useCreateCashuWallet";
import { PWAInstallButton } from "@/components/PWAInstallButton";
import { Smartphone } from "lucide-react";
import { useCashuStore } from "@/stores/cashuStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { getTokenAmount } from "@/lib/cashu";
import { useCurrencyDisplayStore } from "@/stores/currencyDisplayStore";
import { useBitcoinPrice, satsToUSD, formatUSD } from "@/hooks/useBitcoinPrice";
import { usePWA } from "@/hooks/usePWA";
import { OnboardingContext } from "@/contexts/OnboardingContext";

const Index = () => {
  const { t } = useTranslation();
  const { currentUser } = useLoggedInAccounts();
  const [loginOpen, setLoginOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { addLogin } = useNostrLogin();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [newUser, setNewUser] = useState(false);
  const { mutateAsync: createCashuWallet } = useCreateCashuWallet();
  const [generatedName, setGeneratedName] = useState<string | null>(null);
  const cashuStore = useCashuStore();
  const onboardingStore = useOnboardingStore();
  const { showSats } = useCurrencyDisplayStore();
  const { data: btcPrice, isLoading: btcPriceLoading } = useBitcoinPrice();
  const [tokenProcessed, setTokenProcessed] = useState(false);
  const { isRunningAsPwa } = usePWA();

  // Check for token in URL on mount
  useEffect(() => {
    // Don't process if already processed
    if (tokenProcessed) return;

    // Check if user has already claimed an onboarding token
    if (onboardingStore.isTokenClaimed()) {
      setTokenProcessed(true);
      // Clean up the URL
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    const hash = window.location.hash;
    if (hash && hash.includes("token=")) {
      const tokenMatch = hash.match(/token=([^&]+)/);
      if (tokenMatch && tokenMatch[1]) {
        const token = tokenMatch[1];

        // If USD mode and price is still loading, wait
        if (!showSats && btcPriceLoading) {
          return;
        }

        try {
          // Get the token amount
          const amount = getTokenAmount(token);

          // Store the token for later redemption
          cashuStore.setPendingOnboardingToken(token);

          // Clean up the URL
          window.history.replaceState(null, "", window.location.pathname);

          // Format the amount based on user preference
          let displayAmount: string;
          if (showSats) {
            displayAmount = `${amount.toLocaleString()} sats`;
          } else {
            const usd = satsToUSD(amount, btcPrice?.USD || null);
            displayAmount =
              usd !== null ? formatUSD(usd) : `${amount.toLocaleString()} sats`;
          }

          // Show notification with animated icon
          toast({
            title: t("onboarding.ecashWaiting"),
            description: t("onboarding.completeSignup", { amount: displayAmount }),
          });

          // Mark as processed
          setTokenProcessed(true);
        } catch (error) {
          console.error("Error processing token:", error);
          setTokenProcessed(true);
        }
      }
    }
  }, [
    cashuStore,
    onboardingStore,
    showSats,
    btcPrice,
    btcPriceLoading,
    tokenProcessed,
    t,
  ]);

  // Redirect to /groups after user is logged in
  useEffect(() => {
    if (currentUser && !newUser) {
      navigate("/groups", { replace: true });
    }
  }, [newUser, currentUser, navigate]);

  // Handle account creation inline
  const handleCreateAccount = async () => {
    setNewUser(true);
    setCreating(true);
    try {
      // Generate new secret key
      const sk = generateSecretKey();
      const nsec = nip19.nsecEncode(sk);
      // Create login and sign in
      const login = NLogin.fromNsec(nsec);
      addLogin(login);
      // Generate fake name and publish kind:0 metadata
      const fakeName = generateFakeName();
      // Store the generated name in state immediately
      setGeneratedName(fakeName);

      // Wait for login to be available (since addLogin is sync but state update is async)
      setTimeout(async () => {
        try {
          await createCashuWallet();
          await publishEvent({
            kind: 0,
            content: JSON.stringify({ name: fakeName, display_name: fakeName }),
          });
        } catch {
          // fallthrough
        }
      }, 100);
      toast({
        title: t("onboarding.accountCreated"),
        description: t("onboarding.loggedIn"),
      });
      setNewUser(true); // Mark as new user
    } catch (e) {
      toast({
        title: t("common.error"),
        description: t("errors.failedToSave"),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // Handler for login dialog
  const handleLogin = () => {
    setLoginOpen(false);
  };

  // Onboarding step 1: Not logged in
  if (!currentUser) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-dark-background p-8">
          <div className="w-full max-w-md mx-auto px-8 text-center mb-8">
            <h1 className="text-4xl font-extralight mb-4">
              <div className="flex flex-row items-baseline justify-center flex-wrap">
                <span className="font-extralight mr-2 whitespace-nowrap">
                  {t("welcome.title")}
                </span>
                <div className="flex flex-row items-baseline">
                  <span className="text-red-500 font-extrabold">+</span>
                  <span className="text-black dark:text-white font-extrabold">
                    chorus
                  </span>
                </div>
              </div>
            </h1>
            <div className="text-lg text-muted-foreground font-extralight">
              {t("welcome.tagline")}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleCreateAccount}
            disabled={creating}
            className="w-full max-w-[200px] flex items-center justify-center gap-2 mb-6"
          >
            {creating ? t("common.creating") : t("common.getStarted")}
          </Button>
          <div className="text-sm text-muted-foreground flex items-center justify-center mt-3">
            <span>{t("welcome.haveAccount")}</span>&nbsp;
            <Button
              variant="link"
              size="sm"
              className="text-primary font-medium hover:underline p-0 h-auto"
              onClick={() => setLoginOpen(true)}
            >
              {t("common.signIn")}
            </Button>
          </div>

          {/* PWA Install Section - Only show if not already running as PWA */}
          {!isRunningAsPwa && (
            <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {t("welcome.getTheApp")}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                {t("welcome.installForBest")}
              </p>
              <PWAInstallButton
                variant="outline"
                size="sm"
                className="w-full max-w-[200px]"
              />
            </div>
          )}
        </div>
        <LoginDialog
          isOpen={loginOpen}
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
        />
      </>
    );
  }

  // Onboarding step 2: New user (just created account) or user without metadata
  if (currentUser && newUser) {
    return (
      <OnboardingContext.Provider value={{ generatedName }}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-dark-background">
          <div className="w-full max-w-lg mx-auto p-8 bg-card dark:bg-dark-card rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">
              {t("onboarding.setupProfile")}
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              {t("onboarding.setupProfileDesc")}
            </p>
            <EditProfileForm showSkipLink={true} initialName={generatedName} />
          </div>
        </div>
      </OnboardingContext.Provider>
    );
  }

  // Fallback (should redirect to /groups in most cases)
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <div>{t("common.loading")}</div>
    </div>
  );
};

export default Index;
