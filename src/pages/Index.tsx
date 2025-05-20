import { EditProfileForm } from "@/components/EditProfileForm";
import LoginDialog from "@/components/auth/LoginDialog";
import SignupDialog from "@/components/auth/SignupDialog";
import { Button } from "@/components/ui/button";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { toast } from "@/hooks/useToast";
import { randomTwoWordName } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";

const Index = () => {
	const { currentUser } = useLoggedInAccounts();
	const [step, setStep] = useState<
		"start" | "signup" | "login" | "profile" | "done"
	>("start");
	const [randomName, setRandomName] = useState<string>("");
	const { mutateAsync: publishEvent, isPending: isPublishing } =
		useNostrPublish();
	const [profileSaved, setProfileSaved] = useState(false);

	// When a user logs in (after signup or login), go to profile step if not done
	useEffect(() => {
		if (currentUser && step !== "profile" && !profileSaved) {
			// Only trigger onboarding if user has no name (or is just created)
			setStep("profile");
			if (!randomName) setRandomName(randomTwoWordName());
		}
	}, [currentUser, step, randomName, profileSaved]);

	// Handler for finishing onboarding (after profile save or skip)
	const handleFinish = useCallback(() => {
		setStep("done");
		setProfileSaved(true);
	}, []);

	// Handler for skipping profile setup
	const handleSkip = useCallback(async () => {
		if (!currentUser) return;
		try {
			await publishEvent({
				kind: 0,
				content: JSON.stringify({ name: randomName }),
			});
			toast({
				title: "Profile created",
				description: `Welcome, ${randomName}!`,
			});
			handleFinish();
		} catch (e) {
			toast({
				title: "Error",
				description: "Failed to save profile",
				variant: "destructive",
			});
		}
	}, [currentUser, publishEvent, randomName, handleFinish]);

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
					{step === "start" && (
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

					{step === "signup" && (
						<SignupDialog isOpen={true} onClose={() => setStep("start")} />
					)}

					{step === "login" && (
						<LoginDialog
							isOpen={true}
							onClose={() => setStep("start")}
							onLogin={() => setStep("profile")}
						/>
					)}

					{step === "profile" && currentUser && !profileSaved && (
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
