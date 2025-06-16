/**
 * ABOUTME: Data migration utility for transitioning existing group data to the new composite identity system
 * ABOUTME: Handles migration of legacy group-relay mappings to the new GroupInstance format
 */

import { normalizeRelayUrl } from './nip29Utils';

export interface LegacyGroupMapping {
  groupId: string;
  relayUrl: string;
}

export interface MigrationResult {
  migratedCount: number;
  skippedCount: number;
  errors: string[];
}

/**
 * Migrate legacy group-relay mappings stored in localStorage to new format
 */
export function migrateLegacyGroupData(): MigrationResult {
  const result: MigrationResult = {
    migratedCount: 0,
    skippedCount: 0,
    errors: []
  };

  try {
    // Check for legacy data in localStorage
    const legacyDataKey = 'nip29-group-relays';
    const legacyDataRaw = localStorage.getItem(legacyDataKey);
    
    if (!legacyDataRaw) {
      console.log('[Migration] No legacy group data found');
      return result;
    }

    let legacyData: Record<string, string>;
    try {
      legacyData = JSON.parse(legacyDataRaw);
    } catch (error) {
      result.errors.push(`Failed to parse legacy data: ${error}`);
      return result;
    }

    // Process each legacy mapping
    const newMappings: LegacyGroupMapping[] = [];
    
    for (const [groupId, relayUrl] of Object.entries(legacyData)) {
      try {
        const normalizedRelay = normalizeRelayUrl(relayUrl);
        if (!normalizedRelay) {
          result.errors.push(`Invalid relay URL for group ${groupId}: ${relayUrl}`);
          result.skippedCount++;
          continue;
        }

        newMappings.push({
          groupId,
          relayUrl: normalizedRelay
        });
        
        result.migratedCount++;
      } catch (error) {
        result.errors.push(`Error processing group ${groupId}: ${error}`);
        result.skippedCount++;
      }
    }

    // Store migrated data in new format (if needed)
    if (newMappings.length > 0) {
      const newDataKey = 'nip29-migrated-groups';
      localStorage.setItem(newDataKey, JSON.stringify(newMappings));
      console.log(`[Migration] Migrated ${result.migratedCount} group mappings`);
    }

    // Mark migration as complete
    localStorage.setItem('nip29-migration-completed', Date.now().toString());
    
    // Optionally remove legacy data (commented out for safety)
    // localStorage.removeItem(legacyDataKey);

  } catch (error) {
    result.errors.push(`Migration failed: ${error}`);
  }

  return result;
}

/**
 * Check if migration has been completed
 */
export function isMigrationCompleted(): boolean {
  return localStorage.getItem('nip29-migration-completed') !== null;
}

/**
 * Get migrated group mappings
 */
export function getMigratedGroupMappings(): LegacyGroupMapping[] {
  try {
    const dataRaw = localStorage.getItem('nip29-migrated-groups');
    if (!dataRaw) return [];
    
    return JSON.parse(dataRaw);
  } catch (error) {
    console.error('[Migration] Failed to get migrated data:', error);
    return [];
  }
}

/**
 * Clear all migration data (for testing)
 */
export function clearMigrationData(): void {
  localStorage.removeItem('nip29-migration-completed');
  localStorage.removeItem('nip29-migrated-groups');
  localStorage.removeItem('nip29-group-relays');
  console.log('[Migration] Cleared all migration data');
}