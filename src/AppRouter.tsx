import { BrowserRouter, Route, Routes } from "react-router-dom";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import GroupSettings from "./pages/GroupSettings";
import CreateGroup from "./pages/CreateGroup";
import Profile from "./pages/Profile";
import ProfileSettings from "./pages/settings/ProfileSettings";
import Settings from "./pages/settings/Settings";
import CashuWallet from "./cashu/pages/CashuWallet";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/group/:groupId" element={<GroupDetail />} />
        <Route path="/group/:groupId/settings" element={<GroupSettings />} />
        <Route path="/create-group" element={<CreateGroup />} />
        <Route path="/profile/:pubkey" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/settings/profile" element={<ProfileSettings />} />
        <Route path="/wallet" element={<CashuWallet />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
