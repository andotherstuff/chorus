import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

// Create context for storing generated name during onboarding
export const OnboardingContext = React.createContext<{ generatedName: string | null }>({ 
  generatedName: null 
});

const Index = () => {
  const { currentUser } = useLoggedInAccounts();
  const [loginOpen, setLoginOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { addLogin } = useNostrLogin();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const [newUser, setNewUser] = useState(false);
  const { mutateAsync: createCashuWallet } = useCreateCashuWallet();
  const [generatedName, setGeneratedName] = useState<string | null>(null);

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
      toast({ title: "Account created", description: "You are now logged in." });
      setNewUser(true); // Mark as new user
    } catch (e) {
      toast({ title: "Error", description: "Failed to create account. Please try again.", variant: "destructive" });
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
                <span className="font-extralight mr-2 whitespace-nowrap">welcome to</span>
                <div className="flex flex-row items-baseline">
                  <span className="text-red-500 font-extrabold">+</span>
                  <span className="text-black dark:text-white font-extrabold">chorus</span>
                </div>
              </div>
            </h1>
            <div className="text-lg text-muted-foreground font-extralight">
              public/private groups are money
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleCreateAccount}
            disabled={creating}
            className="w-full max-w-[200px] flex items-center justify-center gap-2 mb-6"
          >
            {creating ? "Creating..." : "Get Started"}
          </Button>
          <div className="text-sm text-muted-foreground flex items-center justify-center mt-3">
            <span>Have a Nostr/+chorus account?</span>&nbsp;
            <Button variant="link" size="sm" className="text-primary font-medium hover:underline p-0 h-auto" onClick={() => setLoginOpen(true)}>
              Sign in
            </Button>
          </div>
          
          {/* PWA Install Section */}
          <div className="mt-8 p-4 bg-muted/50 rounded-lg text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Get the App</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Install +chorus for the best experience
            </p>
            <PWAInstallButton variant="outline" size="sm" className="w-full max-w-[200px]" />
          </div>
        </div>
        <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
      </>
    );
  }

  // Onboarding step 2: New user (just created account) or user without metadata
  if (currentUser && newUser) {
    return (
      <OnboardingContext.Provider value={{ generatedName }}>
        <div className="min-h-screen flex flex-col items-center justify-center bg-background dark:bg-dark-background">
          <div className="w-full max-w-lg mx-auto p-8 bg-card dark:bg-dark-card rounded-2xl shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-center">Set up your profile</h2>
            <p className="text-gray-600 mb-6 text-center">
              Add your display name and picture. You can always update them later.
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
      <div>Redirecting to groups...</div>
    </div>
  );
};

export default Index;