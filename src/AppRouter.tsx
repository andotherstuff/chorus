import { BrowserRouter, Route, Routes } from "react-router-dom";

import Settings from "@/pages/Settings";
import CreateGroup from "./pages/CreateGroup";
import GroupDetail from "./pages/GroupDetail";
import Groups from "./pages/Groups";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

export function AppRouter() {
	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Index />} />
				<Route path="/groups" element={<Groups />} />
				<Route path="/group/:groupId" element={<GroupDetail />} />
				<Route path="/create-group" element={<CreateGroup />} />
				<Route path="/settings" element={<Settings />} />
				{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
				<Route path="*" element={<NotFound />} />
			</Routes>
		</BrowserRouter>
	);
}
export default AppRouter;
