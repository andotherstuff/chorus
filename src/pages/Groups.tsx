import { LoginArea } from "@/components/auth/LoginArea";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostr } from "@/hooks/useNostr";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function Groups() {
	const { nostr } = useNostr();
	const { user } = useCurrentUser();

	const { data: communities, isLoading } = useQuery({
		queryKey: ["communities"],
		queryFn: async (c) => {
			const signal = AbortSignal.any([c.signal, AbortSignal.timeout(5000)]);
			const events = await nostr.query([{ kinds: [34550], limit: 50 }], {
				signal,
			});
			return events;
		},
		enabled: !!nostr,
	});

	if (isLoading) {
		return (
			<div className="container mx-auto p-4">
				<h1 className="text-2xl font-bold mb-4">Loading communities...</h1>
			</div>
		);
	}

	return (
		<>
			<style>{`
				.account-switcher-small button { padding: 0.25rem !important; gap: 0.25rem !important; }
				.account-switcher-small .w-10, .account-switcher-small .h-10 { width: 2rem !important; height: 2rem !important; }
				.account-switcher-small .md\\:block { display: none !important; }
			`}</style>
			<div className="container mx-auto p-4">
				<div className="flex justify-between items-center mb-6 gap-2 sm:gap-4">
					<h1 className="font-bold text-2xl sm:text-3xl tracking-tight whitespace-nowrap flex items-baseline gap-0">
						<span className="text-red-500 font-black text-3xl sm:text-4xl mr-1">
							+
						</span>
						Chorus
					</h1>
					<div className="flex items-center gap-2 sm:gap-3">
						<div className="account-switcher-small">
							<LoginArea />
						</div>
						{user && (
							<Button asChild size="icon">
								<Link to="/create-group">
									<Plus className="h-5 w-5" />
								</Link>
							</Button>
						)}
					</div>
				</div>

				<Separator className="my-6" />

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{communities && communities.length > 0 ? (
						communities.map((community) => {
							// Extract community data from tags
							const nameTag = community.tags.find((tag) => tag[0] === "name");
							const descriptionTag = community.tags.find(
								(tag) => tag[0] === "description",
							);
							const imageTag = community.tags.find((tag) => tag[0] === "image");
							const dTag = community.tags.find((tag) => tag[0] === "d");
							const moderatorTags = community.tags.filter(
								(tag) => tag[0] === "p" && tag[3] === "moderator",
							);

							const name = nameTag
								? nameTag[1]
								: dTag
									? dTag[1]
									: "Unnamed Community";
							const description = descriptionTag
								? descriptionTag[1]
								: "No description available";
							const image = imageTag
								? imageTag[1]
								: "/placeholder-community.jpg";
							const communityId = `34550:${community.pubkey}:${dTag ? dTag[1] : ""}`;

							return (
								<Card
									key={community.id}
									className="overflow-hidden flex flex-col"
								>
									<div className="h-40 overflow-hidden">
										{image && (
											<img
												src={image}
												alt={name}
												className="w-full h-full object-cover"
												onError={(e) => {
													e.currentTarget.src =
														"https://placehold.co/600x400?text=Community";
												}}
											/>
										)}
									</div>
									<CardHeader>
										<CardTitle>{name}</CardTitle>
										<CardDescription className="flex items-center">
											<Users className="h-4 w-4 mr-1" />
											{moderatorTags.length} moderator
											{moderatorTags.length !== 1 ? "s" : ""}
										</CardDescription>
									</CardHeader>
									<CardContent className="flex-grow">
										<p className="line-clamp-3">{description}</p>
									</CardContent>
									<CardFooter>
										<Button asChild className="w-full">
											<Link to={`/group/${encodeURIComponent(communityId)}`}>
												View Community
											</Link>
										</Button>
									</CardFooter>
								</Card>
							);
						})
					) : (
						<div className="col-span-full text-center py-10">
							<h2 className="text-xl font-semibold mb-2">
								No communities found
							</h2>
							<p className="text-muted-foreground mb-4">
								Be the first to create a community on this platform!
							</p>
							{user ? (
								<Button asChild>
									<Link to="/create-group">
										<Plus className="mr-2 h-4 w-4" /> Create Community
									</Link>
								</Button>
							) : (
								<p className="text-sm text-muted-foreground">
									Please log in to create a community
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
