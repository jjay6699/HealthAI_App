import { persistentStorage } from "./persistentStorage";

const USAGE_KEY = "appUsageStats";

export interface UsageStats {
  chatInteractions: number;
  analysesRun: number;
}

const defaultStats: UsageStats = {
  chatInteractions: 0,
  analysesRun: 0,
};

// Function to get current usage stats from localStorage
export const getUsageStats = (): UsageStats => {
  try {
    const savedStats = persistentStorage.getItem(USAGE_KEY);
    if (savedStats) {
      return JSON.parse(savedStats);
    }
  } catch (error) {
    console.error('Failed to parse usage stats:', error);
  }
  return defaultStats;
};

// Function to save usage stats to localStorage
const saveUsageStats = (stats: UsageStats) => {
  persistentStorage.setItem(USAGE_KEY, JSON.stringify(stats));
};

// Function to increment chat interactions
export const incrementChatInteractions = () => {
  const stats = getUsageStats();
  stats.chatInteractions += 1;
  saveUsageStats(stats);
};

// Function to increment analyses run
export const incrementAnalysesRun = () => {
  const stats = getUsageStats();
  stats.analysesRun += 1;
  saveUsageStats(stats);
};

// Function to check if the paywall should be displayed
export const shouldShowPaywall = (): boolean => {
  const stats = getUsageStats();
  // Show paywall after 1 chat interaction and 2 analyses
  return stats.chatInteractions >= 1 && stats.analysesRun >= 2;
};
