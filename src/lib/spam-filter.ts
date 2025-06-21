/**
 * Spam filtering utilities for Chorus
 * 
 * This module provides functions to detect and filter spam content
 * based on hardcoded keywords and patterns.
 */

// Hardcoded spam keywords - these can be easily modified as needed
const SPAM_KEYWORDS = [
  "Has nostr figured out spam yet?",
  // Add more spam keywords here as needed
  // "another spam phrase",
  // "yet another spam phrase",
];

/**
 * Check if text contains any spam keywords
 * @param text - The text to check for spam
 * @returns true if spam is detected, false otherwise
 */
export function containsSpam(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const lowerText = text.toLowerCase();
  
  return SPAM_KEYWORDS.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
}

/**
 * Check if a group should be filtered based on its name or description
 * @param groupName - The group name to check
 * @param groupDescription - The group description to check (optional)
 * @returns true if the group should be filtered, false otherwise
 */
export function isSpamGroup(groupName: string, groupDescription?: string): boolean {
  // Check group name for spam
  if (containsSpam(groupName)) {
    return true;
  }

  // Check group description for spam if provided
  if (groupDescription && containsSpam(groupDescription)) {
    return true;
  }

  return false;
}

/**
 * Check if a post should be filtered based on its content
 * @param postContent - The post content to check
 * @returns true if the post should be filtered, false otherwise
 */
export function isSpamPost(postContent: string): boolean {
  return containsSpam(postContent);
}

/**
 * Filter an array of groups to remove spam groups
 * @param groups - Array of group objects with name and description tags
 * @returns Filtered array with spam groups removed
 */
export function filterSpamGroups<T extends { tags: Array<Array<string>> }>(groups: T[]): T[] {
  return groups.filter(group => {
    const nameTag = group.tags.find(tag => tag[0] === "name");
    const descriptionTag = group.tags.find(tag => tag[0] === "description");
    
    const name = nameTag ? nameTag[1] : "";
    const description = descriptionTag ? descriptionTag[1] : "";
    
    return !isSpamGroup(name, description);
  });
}

/**
 * Filter an array of posts to remove spam posts
 * @param posts - Array of post objects with content property
 * @returns Filtered array with spam posts removed
 */
export function filterSpamPosts<T extends { content: string }>(posts: T[]): T[] {
  return posts.filter(post => !isSpamPost(post.content));
}