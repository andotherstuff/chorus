import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Returns a random two-word name, e.g. "Happy Hamster"
export function randomTwoWordName() {
	const adjectives = [
		"Happy",
		"Brave",
		"Clever",
		"Lucky",
		"Gentle",
		"Swift",
		"Quiet",
		"Bold",
		"Sunny",
		"Mighty",
		"Jolly",
		"Witty",
		"Chill",
		"Nimble",
		"Calm",
		"Daring",
		"Fuzzy",
		"Glowing",
		"Peppy",
		"Zesty",
	];
	const animals = [
		"Hamster",
		"Otter",
		"Fox",
		"Panda",
		"Tiger",
		"Hawk",
		"Dolphin",
		"Wolf",
		"Bear",
		"Rabbit",
		"Sparrow",
		"Lynx",
		"Seal",
		"Falcon",
		"Moose",
		"Badger",
		"Finch",
		"Mole",
		"Fawn",
		"Crane",
	];
	const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
	const animal = animals[Math.floor(Math.random() * animals.length)];
	return `${adj} ${animal}`;
}
