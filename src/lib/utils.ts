import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ADJECTIVES = [
  "Brave", "Clever", "Swift", "Gentle", "Fierce", "Mighty", "Nimble", "Quiet", "Lively", "Bold",
  "Curious", "Daring", "Eager", "Friendly", "Gallant", "Happy", "Jolly", "Kind", "Lucky", "Merry",
  "Noble", "Playful", "Quick", "Silly", "Witty", "Zany", "Charming", "Dazzling", "Energetic", "Fearless",
  "Graceful", "Humble", "Inventive", "Jovial", "Keen", "Loyal", "Mysterious", "Nifty", "Optimistic", "Patient",
  "Quirky", "Radiant", "Sincere", "Thoughtful", "Upbeat", "Vivid", "Wise", "Youthful", "Zealous", "Adventurous",
  "Bouncy", "Calm", "Dreamy", "Excited", "Funky", "Gleeful", "Heroic", "Imaginative", "Jazzy", "Kindhearted"
];

const ANIMALS = [
  "Lion", "Tiger", "Bear", "Wolf", "Fox", "Eagle", "Hawk", "Falcon", "Panther", "Leopard",
  "Jaguar", "Cheetah", "Otter", "Beaver", "Rabbit", "Hare", "Squirrel", "Deer", "Moose", "Elk",
  "Buffalo", "Bison", "Horse", "Zebra", "Giraffe", "Elephant", "Rhino", "Hippo", "Monkey", "Gorilla",
  "Chimpanzee", "Orangutan", "Koala", "Kangaroo", "Wallaby", "Wombat", "Sloth", "Armadillo", "Opossum", "Raccoon",
  "Badger", "Weasel", "Mink", "Ferret", "Skunk", "Porcupine", "Hedgehog", "Bat", "Mole", "Shrew",
  "Dog", "Cat", "Mouse", "Rat", "Hamster", "Gerbil", "GuineaPig", "Goat", "Sheep", "Pig",
  "Cow", "Bull", "Ox", "Camel", "Llama", "Alpaca", "Antelope", "Gazelle", "Reindeer", "Caribou",
  "Seal", "Walrus", "SeaLion", "Dolphin", "Whale", "Shark", "Octopus", "Squid", "Crab", "Lobster",
  "Shrimp", "Jellyfish", "Starfish", "Seahorse", "Penguin", "Puffin", "Albatross", "Pelican", "Swan", "Goose",
  "Duck", "Chicken", "Rooster", "Turkey", "Peacock", "Pigeon", "Dove", "Crow", "Raven", "Magpie"
];

export function generateFakeName() {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  return `${adj} ${animal}`;
}

/**
 * Fetches the postExpiration value from localStorage settings and returns a future unix timestamp.
 * Returns null if expiration is off or not set.
 */
export function getPostExpirationTimestamp(): number | null {
  const settingsStr = localStorage.getItem("settings");
  if (!settingsStr) return null;
  let postExpiration: string | undefined;
  try {
    const settings = JSON.parse(settingsStr);
    postExpiration = settings.postExpiration;
  } catch {
    return null;
  }
  if (!postExpiration || postExpiration === "off") return null;

  const now = Math.floor(Date.now() / 1000); // current unix timestamp in seconds
  let seconds = 0;
  switch (postExpiration) {
    case "1-week":
      seconds = 7 * 24 * 60 * 60;
      break;
    case "1-month":
      seconds = 30 * 24 * 60 * 60;
      break;
    case "3-months":
      seconds = 90 * 24 * 60 * 60;
      break;
    case "12-months":
      seconds = 365 * 24 * 60 * 60;
      break;
    default:
      return null;
  }
  return now + seconds;
}

/**
 * Formats a timestamp as a relative time string (e.g., "5m", "2h", "3d")
 * Falls back to absolute date for older timestamps (more than 30 days)
 * @param timestamp Unix timestamp in seconds
 * @param includeAbbreviation Whether to add 'ago' suffix for timestamps > 1 day
 * @returns Formatted relative time string
 */
export function formatRelativeTime(timestamp: number, includeAbbreviation = false): string {
  const now = new Date();
  const date = new Date(timestamp * 1000);
  const differenceInSeconds = Math.floor((date.getTime() - now.getTime()) / 1000);
  const isPast = differenceInSeconds < 0;
  
  // Work with absolute difference for calculations
  const absDifferenceInSeconds = Math.abs(differenceInSeconds);
  
  // For very recent timestamps (less than 5 seconds)
  if (absDifferenceInSeconds < 5) {
    return "now";
  }
  
  // For times less than a minute ago/from now
  if (absDifferenceInSeconds < 60) {
    return `${absDifferenceInSeconds}s`;
  }
  
  // For times less than an hour ago/from now
  if (absDifferenceInSeconds < 3600) {
    const minutes = Math.floor(absDifferenceInSeconds / 60);
    return `${minutes}m`;
  }
  
  // For times less than a day ago/from now
  if (absDifferenceInSeconds < 86400) {
    const hours = Math.floor(absDifferenceInSeconds / 3600);
    return `${hours}h`;
  }
  
  // For times less than 7 days ago/from now
  if (absDifferenceInSeconds < 604800) {
    const days = Math.floor(absDifferenceInSeconds / 86400);
    return `${days}d`;
  }
  
  // For times less than 30 days ago/from now
  if (absDifferenceInSeconds < 2592000) {
    const days = Math.floor(absDifferenceInSeconds / 86400);
    return `${days}d`;
  }
  
  // For older timestamps, use a more readable format
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}

