import React from "react";

// Create context for storing generated name during onboarding
export const OnboardingContext = React.createContext<{
  generatedName: string | null;
}>({
  generatedName: null,
});