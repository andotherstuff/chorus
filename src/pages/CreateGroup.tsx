import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import Header from "@/components/ui/Header";

export default function CreateGroup() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    guidelines: "",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Generate a unique identifier based on the group name and timestamp
  const generateUniqueIdentifier = (name: string): string => {
    const baseId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const timestamp = Date.now().toString(36);
    return `${baseId}-${timestamp}`;
  };

  if (!user) {
    return (
      <div className="container mx-auto py-1 px-3 sm:px-4">
        <h1 className="text-2xl font-bold mb-4">You must be logged in to create a group</h1>
        <Button asChild>
          <Link to="/groups">Back to Groups</Link>
        </Button>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setIsSubmitting(true);

      // Generate unique identifier
      const identifier = generateUniqueIdentifier(formData.name);

      // Upload image if selected
      let imageUrl = "";
      if (imageFile) {
        const [[_, uploadedUrl]] = await uploadFile(imageFile);
        imageUrl = uploadedUrl;
      }

      // Create community event (kind 34550)
      const tags = [
        ["d", identifier],
        ["name", formData.name],
        ["description", formData.description],
      ];

      // Add guidelines tag if provided
      if (formData.guidelines) {
        tags.push(["guidelines", formData.guidelines]);
      }

      // Add image tag if available
      if (imageUrl) {
        tags.push(["image", imageUrl]);
      }

      // Add current user as moderator
      tags.push(["p", user.pubkey, "", "moderator"]);

      // Publish the community event
      await publishEvent({
        kind: 34550,
        tags,
        content: "",
      });

      toast.success("Group created successfully!");
      navigate("/groups");
    } catch (error) {
      console.error("Error creating community:", error);
      toast.error("Failed to create group. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />

      <Card>
        <CardHeader>
          <CardTitle>Create a Group</CardTitle>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Group Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="My Awesome Group"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Tell people what your group is about..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="guidelines">Group Guidelines</Label>
              <Textarea
                id="guidelines"
                name="guidelines"
                value={formData.guidelines}
                onChange={handleInputChange}
                placeholder="Set community rules and guidelines for members to follow..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Optional: Define rules and expectations for group members
              </p>
            </div>

            <div className="space-y-2">
              <Label>Group Image</Label>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload an image for your group banner
                  </p>
                </div>

                {previewUrl && (
                  <div className="w-24 h-24 rounded overflow-hidden flex-shrink-0">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/groups")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading || !formData.name || !formData.description}
            >
              {isSubmitting || isUploading ? "Creating..." : "Create Group"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
