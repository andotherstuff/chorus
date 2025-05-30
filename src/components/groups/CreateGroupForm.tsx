import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { GroupTypeSelector } from "./GroupTypeSelector";
import type { GroupType, CreateGroupData } from "@/types/groups";
import { createGroupRouteId } from "@/lib/group-utils";

interface CreateGroupFormProps {
  onCancel: () => void;
}

export function CreateGroupForm({ onCancel }: CreateGroupFormProps) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

  const [formData, setFormData] = useState<CreateGroupData>({
    name: "",
    identifier: "",
    description: "",
    image: "",
    type: "nip72", // Default to NIP-72 for backward compatibility
    relay: "",
    isPrivate: true,
    isOpen: false, // Whether anyone can join without approval
    isPublic: true, // Whether the group is publicly discoverable
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { nostr: enhancedNostr } = useEnhancedNostr();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!user) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p>You must be logged in to create a group.</p>
        </CardContent>
      </Card>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeChange = (type: GroupType) => {
    setFormData(prev => ({ 
      ...prev, 
      type,
      // Set default relay for NIP-29 if not set
      relay: type === "nip29" && !prev.relay ? enhancedNostr?.getNip29DefaultRelay() || "wss://communities.nos.social/" : prev.relay
    }));
  };

  const handleCheckboxChange = (name: string) => (checked: boolean) => {
    setFormData(prev => ({ ...prev, [name]: checked }));
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

  const createNip29Group = async (groupData: CreateGroupData, imageUrl?: string): Promise<string> => {
    if (!enhancedNostr) {
      throw new Error("Enhanced Nostr not available");
    }

    // Generate a unique group ID
    const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[NIP-29] Creating group ${groupId} on relay ${groupData.relay}`);

    try {
      // Create NIP-29 group creation event (kind 9007)
      const createTags = [
        ["name", groupData.name],
      ];
      
      // Add group metadata
      if (groupData.description) createTags.push(["about", groupData.description]);
      if (imageUrl) createTags.push(["picture", imageUrl]);
      
      // Add privacy settings
      if (!groupData.isPublic) createTags.push(["private"]);
      if (!groupData.isOpen) createTags.push(["closed"]);

      await publishEvent({
        kind: 9007, // GROUP_CREATE
        tags: createTags,
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      console.log(`[NIP-29] Group creation event published for ${groupId}`);

      // Register the group-relay mapping for future use
      enhancedNostr.addGroupRelay(groupId, groupData.relay!);

      return groupId;
    } catch (error) {
      console.error(`[NIP-29] Failed to create group:`, error);
      throw new Error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.description) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (formData.type === "nip72" && !formData.identifier) {
      toast.error("Please provide a group identifier for public communities");
      return;
    }

    if (formData.type === "nip29" && !formData.relay) {
      toast.error("Please provide a relay URL for private groups");
      return;
    }

    try {
      setIsSubmitting(true);

      // Upload image if selected
      let imageUrl = formData.image;
      if (imageFile) {
        const [[_, uploadedUrl]] = await uploadFile(imageFile);
        imageUrl = uploadedUrl;
      }

      if (formData.type === "nip72") {
        // Create NIP-72 community event (kind 34550)
        const tags = [
          ["d", formData.identifier!],
          ["name", formData.name],
          ["description", formData.description],
        ];

        if (imageUrl) {
          tags.push(["image", imageUrl]);
        }

        // Add current user as moderator
        tags.push(["p", user.pubkey, "", "moderator"]);

        await publishEvent({
          kind: 34550,
          tags,
          content: "",
        });

        // Navigate to the new group
        const groupId = `nip72:${user.pubkey}:${formData.identifier!}`;
        navigate(`/group/${encodeURIComponent(groupId)}`);
      } else {
        // Create NIP-29 group
        const groupId = await createNip29Group(formData, imageUrl);
        
        // Navigate to the new group using proper NIP-29 route
        navigate(`/group/nip29/${encodeURIComponent(formData.relay!)}/${encodeURIComponent(groupId)}`);
      }

      toast.success("Group created successfully!");
    } catch (error) {
      console.error("Error creating group:", error);
      toast.error(`Failed to create group: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a Group</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <GroupTypeSelector value={formData.type} onChange={handleTypeChange} />

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

          {formData.type === "nip72" && (
            <div className="space-y-2">
              <Label htmlFor="identifier">
                Group Identifier *
                <span className="text-xs text-muted-foreground ml-2">
                  (unique identifier for your community)
                </span>
              </Label>
              <Input
                id="identifier"
                name="identifier"
                value={formData.identifier || ""}
                onChange={handleInputChange}
                placeholder="my-awesome-group"
                required
              />
            </div>
          )}

          {formData.type === "nip29" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="relay">
                  Group Relay *
                  <span className="text-xs text-muted-foreground ml-2">
                    (relay that will host your private group)
                  </span>
                </Label>
                <Input
                  id="relay"
                  name="relay"
                  value={formData.relay || ""}
                  onChange={handleInputChange}
                  placeholder="wss://communities.nos.social/"
                  required
                />
              </div>

              <div className="space-y-4">
                <Label>Group Settings</Label>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isOpen"
                      checked={formData.isOpen}
                      onCheckedChange={handleCheckboxChange("isOpen")}
                    />
                    <Label htmlFor="isOpen" className="text-sm font-normal">
                      Open group (anyone can join without approval)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="isPublic"
                      checked={formData.isPublic}
                      onCheckedChange={handleCheckboxChange("isPublic")}
                    />
                    <Label htmlFor="isPublic" className="text-sm font-normal">
                      Public group (discoverable in group lists)
                    </Label>
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              name="description"
              value={formData.description || ""}
              onChange={handleInputChange}
              placeholder="Tell people what your group is about..."
              rows={4}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Group Image</Label>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Input
                    id="image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground">or</span>
                  <Input
                    id="image"
                    name="image"
                    value={formData.image || ""}
                    onChange={handleInputChange}
                    placeholder="Image URL"
                    className="flex-1"
                    disabled={!!imageFile}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Upload an image or provide a URL for your group banner
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
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting || 
              isUploading || 
              !formData.name || 
              !formData.description ||
              (formData.type === "nip72" && !formData.identifier) ||
              (formData.type === "nip29" && !formData.relay)
            }
          >
            {isSubmitting || isUploading ? "Creating..." : "Create Group"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
