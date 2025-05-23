import { createContext, useContext } from "react";

// Define types for our context
export interface JoinDialogContextType {
  openJoinDialog: (communityId: string) => void;
  isDialogOpen: boolean;
}

// Create the context with a default value
export const JoinDialogContext = createContext<JoinDialogContextType>({
  openJoinDialog: () => {},
  isDialogOpen: false,
});

// Custom hook to use the join dialog context
export function useJoinDialog() {
  return useContext(JoinDialogContext);
}