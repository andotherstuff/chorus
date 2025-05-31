import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Eagerly load the main pages
import Index from "./pages/Index";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Profile from "./pages/Profile";
import Hashtag from "./pages/Hashtag";
import Trending from "./pages/Trending";

// Lazy load less frequently used pages
const NotFound = lazy(() => import("./pages/NotFound"));
const GroupSettings = lazy(() => import("./pages/GroupSettings"));
const GroupGuidelines = lazy(() => import("./pages/GroupGuidelines"));
const CreateGroup = lazy(() => import("./pages/CreateGroup"));
const ProfileSettings = lazy(() => import("./pages/settings/ProfileSettings"));
const Settings = lazy(() => import("./pages/settings/Settings"));
const Notifications = lazy(() => import("./pages/settings/Notifications"));
const CashuWallet = lazy(() => import("./pages/CashuWallet"));
const LinkPreviewTest = lazy(() => import("./pages/LinkPreviewTest"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const FaqPage = lazy(() => import("@/pages/FaqPage"));
const Nip29Debug = lazy(() => import("@/components/debug/Nip29Debug").then(m => ({ default: m.Nip29Debug })));

// Legacy NIP-29 redirect component
function LegacyNip29Redirect() {
  const location = useLocation();
  
  // Extract the old format: /group/nip29:relay:groupId
  const path = location.pathname;
  const match = path.match(/^\/group\/nip29:(.+):([^:]+)$/);
  
  if (match) {
    const [, encodedRelay, groupId] = match;
    const relay = decodeURIComponent(encodedRelay);
    const newPath = `/group/nip29/${encodeURIComponent(relay)}/${encodeURIComponent(groupId)}${location.search}${location.hash}`;
    
    // Redirect to the new format
    window.location.replace(newPath);
    return <div>Redirecting...</div>;
  }
  
  // If we can't parse the old format, redirect to groups page
  window.location.replace('/groups');
  return <div>Redirecting...</div>;
}

// Loading component
function PageLoader() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-full max-w-2xl" />
        <Skeleton className="h-4 w-3/4 max-w-2xl" />
      </div>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/groups" element={<Groups />} />
        <Route path="/group/:groupId" element={<GroupDetail />} />
        {/* Backward compatibility route for old NIP-29 URL format */}
        <Route path="/group/nip29:*" element={<LegacyNip29Redirect />} />
        {/* NIP-29 specific routes */}
        <Route path="/group/nip29/:relay/:groupId" element={<GroupDetail />} />
        <Route path="/group/nip29/:relay/:groupId/settings" element={
          <Suspense fallback={<PageLoader />}>
            <GroupSettings />
          </Suspense>
        } />
        <Route path="/profile/:pubkey" element={<Profile />} />
        <Route path="/t/:hashtag" element={<Hashtag />} />
        <Route path="/trending" element={<Trending />} />
        
        {/* Lazy loaded routes */}
        <Route path="/group/:groupId/settings" element={
          <Suspense fallback={<PageLoader />}>
            <GroupSettings />
          </Suspense>
        } />
        <Route path="/group/:groupId/guidelines" element={
          <Suspense fallback={<PageLoader />}>
            <GroupGuidelines />
          </Suspense>
        } />
        <Route path="/create-group" element={
          <Suspense fallback={<PageLoader />}>
            <CreateGroup />
          </Suspense>
        } />
        <Route path="/settings" element={
          <Suspense fallback={<PageLoader />}>
            <Settings />
          </Suspense>
        } />
        <Route path="/settings/profile" element={
          <Suspense fallback={<PageLoader />}>
            <ProfileSettings />
          </Suspense>
        } />
        <Route path="/settings/notifications" element={
          <Suspense fallback={<PageLoader />}>
            <Notifications />
          </Suspense>
        } />
        <Route path="/wallet" element={
          <Suspense fallback={<PageLoader />}>
            <CashuWallet />
          </Suspense>
        } />
        <Route path="/link-preview-test" element={
          <Suspense fallback={<PageLoader />}>
            <LinkPreviewTest />
          </Suspense>
        } />
        <Route path="/about" element={
          <Suspense fallback={<PageLoader />}>
            <AboutPage />
          </Suspense>
        } />
        <Route path="/faq" element={
          <Suspense fallback={<PageLoader />}>
            <FaqPage />
          </Suspense>
        } />
        <Route path="/debug/nip29" element={
          <Suspense fallback={<PageLoader />}>
            <Nip29Debug />
          </Suspense>
        } />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={
          <Suspense fallback={<PageLoader />}>
            <NotFound />
          </Suspense>
        } />
      </Routes>
    </BrowserRouter>
  );
}
export default AppRouter;
