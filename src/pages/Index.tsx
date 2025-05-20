import { EditProfileForm } from "@/components/EditProfileForm";
import LoginDialog from "@/components/auth/LoginDialog";
import SignupDialog from "@/components/auth/SignupDialog";
import { Button } from "@/components/ui/button";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { toast } from "@/hooks/useToast";
import { randomTwoWordName } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

const ONBOARDED_KEY = "hasOnboarded";

const Index = () => {
	const { currentUser } = useLoggedInAccounts();
	const [step, setStep] = useState<
		"start" | "signup" | "login" | "profile" | "done"
	>("start");
	const [randomName, setRandomName] = useState<string>("");
	const { mutateAsync: publishEvent, isPending: isPublishing } =
		useNostrPublish();
	const [profileSaved, setProfileSaved] = useState(false);
	const [hasOnboarded, setHasOnboarded] = useState(() => {
		try {
			return localStorage.getItem(ONBOARDED_KEY) === "true";
		} catch {
			return false;
		}
	});
	const [initialProfileSaved, setInitialProfileSaved] = useState(false);

	// Helper: check if currentUser has a name (existing profile)
	const hasProfile = !!currentUser?.metadata?.name;

	// On login/signup, handle onboarding logic
	useEffect(() => {
		if (!currentUser) return;

		if (!hasOnboarded && !hasProfile && !initialProfileSaved) {
			// New user: generate fake name and save kind:0 event
			const generatedName = randomTwoWordName();
			setRandomName(generatedName);
			setStep("profile");
			setInitialProfileSaved(true);
			(async () => {
				try {
					await publishEvent({
						kind: 0,
						content: JSON.stringify({ name: generatedName }),
					});
					// Optionally: invalidate queries here if needed
				} catch (e) {
					toast({
						title: "Error",
						description: "Failed to save initial profile",
						variant: "destructive",
					});
					setInitialProfileSaved(false); // allow retry on error
				}
			})();
		} else if (!hasOnboarded && hasProfile) {
			// Existing user: mark as onboarded, skip onboarding
			setHasOnboarded(true);
			try {
				localStorage.setItem(ONBOARDED_KEY, "true");
			} catch {}
			setStep("done");
		}
	}, [
		currentUser,
		hasOnboarded,
		hasProfile,
		initialProfileSaved,
		publishEvent,
	]);

	// Handler for finishing onboarding (after profile save or skip)
	const handleFinish = useCallback(() => {
		setStep("done");
		setProfileSaved(true);
		setHasOnboarded(true);
		try {
			localStorage.setItem(ONBOARDED_KEY, "true");
		} catch {}
	}, []);

	// Handler for skipping profile setup (should not double-save kind:0)
	const handleSkip = useCallback(async () => {
		handleFinish();
	}, [handleFinish]);

	// Handler for when EditProfileForm is submitted
	const handleProfileSaved = useCallback(() => {
		toast({
			title: "Profile updated",
			description: "Your profile has been saved.",
		});
		handleFinish();
	}, [handleFinish]);

	// UI rendering logic
	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
			{/* Header */}
			<header className="border-b">
				<div className="container mx-auto p-4 flex justify-between items-center">
					<h1 className="text-4xl font-bold flex flex-row items-baseline gap-0">
						<span className="text-red-500 font-black text-5xl">+</span>
						Chorus
					</h1>
				</div>
			</header>

			<main className="flex-1 flex items-center justify-center">
				<div className="container mx-auto px-4 py-16 max-w-md w-full">
					{!hasOnboarded && step === "start" && (
						<div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
							<h2 className="text-3xl font-bold mb-2">Welcome to Chorus</h2>
							<p className="text-gray-600 mb-6">
								Join decentralized communities on Nostr. To get started, create
								a new account or sign in with your existing Nostr key.
							</p>
							<Button
								className="w-full py-6 text-lg"
								onClick={() => setStep("signup")}
							>
								Create a new account
							</Button>
							<div className="text-sm text-gray-500 mt-4">
								Already have an account?{" "}
								<button
									type="button"
									className="text-blue-600 hover:underline font-medium"
									onClick={() => setStep("login")}
								>
									Sign in with existing Nostr account
								</button>
							</div>
						</div>
					)}

					{!hasOnboarded && step === "signup" && (
						<SignupDialog isOpen={true} onClose={() => setStep("start")} />
					)}

					{!hasOnboarded && step === "login" && (
						<LoginDialog
							isOpen={true}
							onClose={() => setStep("start")}
							onLogin={() => setStep("profile")}
						/>
					)}

					{!hasOnboarded &&
						step === "profile" &&
						currentUser &&
						!profileSaved && (
							<div className="bg-white rounded-2xl shadow-lg p-8">
								<h2 className="text-2xl font-bold mb-4 text-center">
									Set up your profile
								</h2>
								<p className="text-gray-600 text-center mb-6">
									This is how you'll appear to others. You can change it later.
								</p>
								<EditProfileForm
									key={currentUser.pubkey}
									initialName={randomName}
									onSaved={handleProfileSaved}
								/>
								<Button
									variant="outline"
									className="w-full mt-4"
									onClick={handleSkip}
									disabled={isPublishing}
								>
									Skip for now
								</Button>
							</div>
						)}

					{step === "done" && (
						<div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-6">
							<h2 className="text-2xl font-bold">You're all set!</h2>
							<p className="text-gray-600">
								Your account is ready. You can now join communities and start
								connecting.
							</p>
							<Button className="w-full py-6 text-lg" asChild>
								<a href="/groups">Continue to Communities</a>
							</Button>
						</div>
					)}
				</div>
			</main>

			{/* Footer */}
			<footer className="bg-gray-100 py-8 mt-auto">
				<div className="container mx-auto px-4 text-center text-gray-600">
					<p>Built with Nostr NIP-72 • Decentralized Communities</p>
				</div>
			</footer>
		</div>
	);
};

export default Index;
