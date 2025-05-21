import { EditProfileForm } from "@/components/EditProfileForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Header from "@/components/ui/Header";
import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function ProfileSettings() {
  const { user } = useCurrentUser();

  // Redirect to home if user is not logged in
  if (!user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="container mx-auto py-4 px-6"> {/* Changed padding */}
      <Header />
      <div className="space-y-6 my-6">
        <Card>
          <CardHeader>
            <CardTitle>Edit Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <EditProfileForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
