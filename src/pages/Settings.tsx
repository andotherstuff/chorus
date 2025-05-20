import { EditProfileForm } from "@/components/EditProfileForm";
import { LoginArea } from "@/components/auth/LoginArea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { Link, useNavigate } from "react-router-dom";

export default function Settings() {
	const { currentUser, removeLogin } = useLoggedInAccounts();
	const navigate = useNavigate();

	if (!currentUser) {
		return (
			<div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
				<header className="border-b">
					<div className="container mx-auto p-4 flex justify-between items-center">
						<Link
							to="/groups"
							className="text-4xl font-bold flex flex-row items-baseline gap-0 hover:opacity-80 transition-opacity"
						>
							<span className="text-red-500 font-black text-5xl">+</span>
							Chorus
						</Link>
						<div className="account-switcher-small">
							<LoginArea />
						</div>
					</div>
				</header>
				<main className="flex-1 flex items-center justify-center">
					<Card className="max-w-md w-full">
						<CardHeader>
							<CardTitle>Settings</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-center text-muted-foreground">
								You must be logged in to view your settings.
							</p>
						</CardContent>
					</Card>
				</main>
			</div>
		);
	}

	const handleLogout = () => {
		removeLogin(currentUser.id);
		navigate("/");
	};

	return (
		<div className="min-h-screen flex flex-col bg-gradient-to-b from-blue-50 to-white">
			<header className="border-b">
				<div className="container mx-auto p-4 flex justify-between items-center">
					<Link
						to="/groups"
						className="text-4xl font-bold flex flex-row items-baseline gap-0 hover:opacity-80 transition-opacity"
					>
						<span className="text-red-500 font-black text-5xl">+</span>
						Chorus
					</Link>
					<div className="account-switcher-small">
						<LoginArea />
					</div>
				</div>
			</header>
			<main className="flex-1 flex items-center justify-center">
				<Card className="max-w-md w-full">
					<CardHeader>
						<CardTitle>Settings</CardTitle>
					</CardHeader>
					<CardContent className="space-y-8">
						<section>
							<h2 className="text-lg font-semibold mb-2">Update Profile</h2>
							<EditProfileForm />
						</section>
						<Separator />
						<section>
							<h2 className="text-lg font-semibold mb-2">Log out</h2>
							<Button
								variant="destructive"
								className="w-full"
								onClick={handleLogout}
							>
								Log out
							</Button>
						</section>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
