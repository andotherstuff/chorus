import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import LoginDialog from "@/components/auth/LoginDialog";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { EditProfileForm } from "@/components/EditProfileForm";
import { generateFakeName } from "@/lib/utils";
import { useNostr } from "@nostrify/react";
import { useNostrLogin, NLogin } from "@nostrify/react/login";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { generateSecretKey, nip19 } from "nostr-tools";
import { toast } from "@/hooks/useToast";
import { useRef } from "react";

const Index = () => {
  const { currentUser } = useLoggedInAccounts();
  const [loginOpen, setLoginOpen] = useState(false);
  const [profileComplete, setProfileComplete] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();
  const { nostr } = useNostr();
  const { addLogin } = useNostrLogin();
  const { mutateAsync: publishEvent } = useNostrPublish();

  // Track if the user is new (created in this session)
  const [newUser, setNewUser] = useState(() => {
    // Read from sessionStorage if available
    const stored = sessionStorage.getItem("newUser");
    return stored === "true";
  });

  // Helper to update both state and sessionStorage
  const setNewUserState = useCallback((val: boolean) => {
    setNewUser(val);
    sessionStorage.setItem("newUser", val ? "true" : "false");
  }, []);

  // Check if the user has filled out their profile (basic check: has name or about or picture)
  useEffect(() => {
    if (currentUser && (currentUser.metadata?.name || currentUser.metadata?.about || currentUser.metadata?.picture)) {
      setProfileComplete(true);
    } else {
      setProfileComplete(false);
    }
  }, [currentUser]);

  // Redirect to /groups after profile is complete
  useEffect(() => {
    if (profileComplete && currentUser) {
      navigate("/groups", { replace: true });
    }
  }, [profileComplete, currentUser, navigate]);

  // If a user logs in and newUser is true, but they are not a new account, set newUser to false
  useEffect(() => {
    if (
      currentUser &&
      newUser &&
      (currentUser.metadata?.name || currentUser.metadata?.about || currentUser.metadata?.picture)
    ) {
      setNewUserState(false);
    }
  }, [currentUser, newUser, setNewUserState]);

  // Handle account creation inline
  const handleCreateAccount = async () => {
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
      // Wait for login to be available (since addLogin is sync but state update is async)
      setTimeout(async () => {
        try {
          await publishEvent({
            kind: 0,
            content: JSON.stringify({ name: fakeName, display_name: fakeName }),
          });
        } catch {}
      }, 100);
      toast({ title: "Account created", description: "You are now logged in." });
      setNewUserState(true); // Mark as new user
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-8">
        <div className="w-full max-w-md mx-auto p-8 bg-white rounded-2xl shadow-lg text-center">
          <h1 className="text-4xl font-extralight mb-4">
            <div className="text-4xl">welcome to</div>
            <div className="flex flex-row gap-0 items-baseline justify-center">
              <span className="text-red-500 font-extrabold text-4xl">+</span>
              <span className="text-black font-extrabold text-4xl">chorus</span>
            </div>
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            public/private groups are money
          </p>
          <Button size="lg" className="w-full mb-4" onClick={handleCreateAccount} disabled={creating}>
            {creating ? "Creating..." : "Start"}
          </Button>
          <div className="text-sm text-gray-600">
            Have a Nostr/+chorus account?{' '}
            <button type="button" className="text-primary font-medium hover:underline" onClick={() => setLoginOpen(true)}>
              Sign in
            </button>
          </div>
        </div>
        <LoginDialog isOpen={loginOpen} onClose={() => setLoginOpen(false)} onLogin={handleLogin} />
      </div>
    );
  }

  // Onboarding step 2: New user (just created account)
  if (currentUser && newUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white">
        <div className="w-full max-w-lg mx-auto p-8 bg-white rounded-2xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-center">Set up your profile</h2>
          <p className="text-gray-600 mb-6 text-center">
            Add your display name and picture. You can always update them later.
          </p>
          <EditProfileForm showSkipLink={true} />
        </div>
      </div>
    );
  }

  // Fallback (should not be seen)
  return null;
};

export default Index;
