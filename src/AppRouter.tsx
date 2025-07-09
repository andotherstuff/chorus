import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { WelcomeRedirect } from "@/components/auth/WelcomeRedirect";
import { GlobalLayout } from "@/components/GlobalLayout";
import { Skeleton } from "@/components/ui/skeleton";

// Eagerly load the main pages
import Index from "./pages/Index";
import CreateAccount from "./pages/CreateAccount";

import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Profile from "./pages/Profile";
import Hashtag from "./pages/Hashtag";
import Trending from "./pages/Trending";
import GroupPostsFeed from "./pages/GroupPostsFeed";
import Dashboard from "./pages/Dashboard";
import DashboardDetail from "./pages/DashboardDetail";
import WelcomePage from "./pages/WelcomePage";
import CreateArtist from "./pages/CreateArtist";

// Lazy load less frequently used pages
const NotFound = lazy(() => import("./pages/NotFound"));
const GroupGuidelines = lazy(() => import("./pages/GroupGuidelines"));
const CreateGroup = lazy(() => import("./pages/CreateGroup"));
const ProfileSettings = lazy(() => import("./pages/settings/ProfileSettings"));
const Settings = lazy(() => import("./pages/settings/Settings"));
const Notifications = lazy(() => import("./pages/settings/Notifications"));
const CashuWallet = lazy(() => import("./pages/CashuWallet"));
const LinkPreviewTest = lazy(() => import("./pages/LinkPreviewTest"));
const AboutPage = lazy(() => import("@/pages/AboutPage"));
const FaqPage = lazy(() => import("@/pages/FaqPage"));
const LegacyApiTestPage = lazy(() => import("./pages/LegacyApiTestPage"));
const AccountLinking = lazy(() => import("./pages/AccountLinking"));

// Loading component
function PageLoader() {
  return (
    <div className="my-6 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-4 w-full max-w-2xl" />
      <Skeleton className="h-4 w-3/4 max-w-2xl" />
    </div>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <WelcomeRedirect>
        <GlobalLayout>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/create-account" element={<CreateAccount />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              path="/dashboard/:communityId"
              element={<DashboardDetail />}
            />
            <Route path="/create-artist" element={<CreateArtist />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/group/:groupId" element={<GroupDetail />} />
            <Route path="/profile/:pubkey" element={<Profile />} />
            <Route path="/t/:hashtag" element={<Hashtag />} />
            <Route path="/trending" element={<Trending />} />
            <Route path="/feed" element={<GroupPostsFeed />} />

            {/* Lazy loaded routes */}
            <Route
              path="/group/:groupId/guidelines"
              element={
                <Suspense fallback={<PageLoader />}>
                  <GroupGuidelines />
                </Suspense>
              }
            />
            <Route
              path="/create-group"
              element={
                <Suspense fallback={<PageLoader />}>
                  <CreateGroup />
                </Suspense>
              }
            />
            <Route
              path="/settings"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Settings />
                </Suspense>
              }
            />
            <Route
              path="/settings/profile"
              element={
                <Suspense fallback={<PageLoader />}>
                  <ProfileSettings />
                </Suspense>
              }
            />
            <Route
              path="/settings/notifications"
              element={
                <Suspense fallback={<PageLoader />}>
                  <Notifications />
                </Suspense>
              }
            />
            <Route
              path="/wallet"
              element={
                <Suspense fallback={<PageLoader />}>
                  <CashuWallet />
                </Suspense>
              }
            />
            <Route
              path="/link-preview-test"
              element={
                <Suspense fallback={<PageLoader />}>
                  <LinkPreviewTest />
                </Suspense>
              }
            />
            <Route
              path="/about"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AboutPage />
                </Suspense>
              }
            />
            <Route
              path="/faq"
              element={
                <Suspense fallback={<PageLoader />}>
                  <FaqPage />
                </Suspense>
              }
            />
            <Route
              path="/legacy-api-test"
              element={
                <Suspense fallback={<PageLoader />}>
                  <LegacyApiTestPage />
                </Suspense>
              }
            />
            <Route
              path="/account-linking"
              element={
                <Suspense fallback={<PageLoader />}>
                  <AccountLinking />
                </Suspense>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route
              path="*"
              element={
                <Suspense fallback={<PageLoader />}>
                  <NotFound />
                </Suspense>
              }
            />
          </Routes>
        </GlobalLayout>
      </WelcomeRedirect>
    </BrowserRouter>
  );
}
export default AppRouter;
