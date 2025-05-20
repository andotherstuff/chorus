// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import { Button } from "@/components/ui/button.tsx";
import { useLoggedInAccounts } from "@/hooks/useLoggedInAccounts";
import { User } from "lucide-react";
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AccountSwitcher } from "./AccountSwitcher";
import LoginDialog from "./LoginDialog";
import SignupDialog from "./SignupDialog";

export function LoginArea() {
	const { currentUser } = useLoggedInAccounts();
	const [loginDialogOpen, setLoginDialogOpen] = useState(false);
	const [signupDialogOpen, setSignupDialogOpen] = useState(false);
	const navigate = useNavigate();

	const handleLogin = () => {
		setLoginDialogOpen(false);
		setSignupDialogOpen(false);
	};

	return (
		<>
			{currentUser ? (
				<button
					onClick={() => navigate("/settings")}
					type="button"
					className="flex items-center gap-3 p-3 rounded-full w-full text-foreground max-w-60 focus:outline-none focus:ring-2 focus:ring-primary"
					title="Account settings"
				>
					<img
						src={currentUser.metadata.picture}
						alt={currentUser.metadata.name}
						className="w-10 h-10 rounded-full object-cover"
					/>
					<div className="flex-1 text-left hidden md:block truncate">
						<p className="font-medium text-sm truncate">
							{currentUser.metadata.name || currentUser.pubkey}
						</p>
					</div>
				</button>
			) : (
				<Button
					onClick={() => setLoginDialogOpen(true)}
					className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground w-full font-medium transition-all hover:bg-primary/90 animate-scale-in"
				>
					<User className="w-4 h-4" />
					<span>Log in</span>
				</Button>
			)}

			<LoginDialog
				isOpen={loginDialogOpen}
				onClose={() => setLoginDialogOpen(false)}
				onLogin={handleLogin}
				onSignup={() => setSignupDialogOpen(true)}
			/>

			<SignupDialog
				isOpen={signupDialogOpen}
				onClose={() => setSignupDialogOpen(false)}
			/>
		</>
	);
}
