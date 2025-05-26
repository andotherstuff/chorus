import { useUserRole } from "./useUserRole";

// The specific Site Admin group ID
const SITE_ADMIN_GROUP_ID = "34550:932614571afcbad4d17a191ee281e39eebbb41b93fac8fd87829622aeb112f4d:and-other-stuff-mb3c9stb";

/**
 * Hook to check if the current user is a Site Admin
 * Site Admins are owners or moderators of the specific Site Admin group
 */
export function useSiteAdmin() {
  const { data: userRole, isLoading } = useUserRole(SITE_ADMIN_GROUP_ID);
  
  const isSiteAdmin = userRole === "owner" || userRole === "moderator";
  
  return {
    isSiteAdmin,
    isLoading,
    userRole
  };
}