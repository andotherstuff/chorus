import { useEffect, useRef, type FC } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Loader2, Upload } from "lucide-react";
import { NSchema as n, type NostrMetadata } from "@jsr/nostrify__nostrify";
import { useQueryClient } from "@tanstack/react-query";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useNavigate } from "react-router-dom";
import { KINDS } from "@/lib/nostr-kinds";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLoginActions } from "@/hooks/useLoginActions";

interface EditProfileFormProps {
  showSkipLink?: boolean;
  initialName?: string | null;
}

/**
 * EditProfileForm provides a minimal interface for editing profile name and picture.
 *
 * IMPORTANT: This form preserves ALL existing metadata fields from the user's kind 0 event
 * when publishing updates. Only the fields shown in the UI (name, picture) can be modified,
 * but all other fields (about, banner, nip05, lud16, website, etc.) are preserved.
 *
 * This ensures that using this minimal edit interface doesn't accidentally delete
 * other profile information that may have been set elsewhere.
 */
export const EditProfileForm: FC<EditProfileFormProps> = ({
  showSkipLink = false,
  initialName = null,
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Get current user and their complete metadata from relays
  // This ensures we have all existing profile fields to preserve
  const { user, metadata } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { toast } = useToast();
  const { logout } = useLoginActions();

  // Initialize the form with default values
  const form = useForm<NostrMetadata>({
    resolver: zodResolver(n.metadata()),
    defaultValues: {
      name: initialName || "",
      picture: "",
    },
  });

  // Handle going back to login
  const handleBackToLogin = async () => {
    try {
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Failed to logout:", error);
      // Navigate anyway even if logout fails
      navigate("/", { replace: true });
    }
  };

  // Update form values when user data is loaded
  useEffect(() => {
    // If initialName is provided, use it (for onboarding flow)
    if (initialName) {
      form.setValue("name", initialName);
    } else if (metadata) {
      // Otherwise, use metadata from relays (for existing users)
      form.reset({
        name: metadata.name || "",
        picture: metadata.picture || "",
      });
    }
  }, [metadata, form, initialName]);

  // Handle file uploads for profile picture and banner
  const uploadPicture = async (file: File, field: "picture" | "banner") => {
    try {
      // The first tuple in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      form.setValue(field, url);
      toast({
        title: "Success",
        description: `${
          field === "picture" ? "Profile picture" : "Banner"
        } uploaded successfully`,
      });
    } catch (error) {
      console.error(`Failed to upload ${field}:`, error);
      toast({
        title: "Error",
        description: `Failed to upload ${
          field === "picture" ? "profile picture" : "banner"
        }. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const onSubmit = async (values: NostrMetadata) => {
    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in to update your profile",
        variant: "destructive",
      });
      return;
    }

    // Check if the name field is filled out or if any field has been updated
    const hasName = values.name && values.name.trim() !== "";
    const hasUpdatedField = Object.entries(values).some(([key, value]) => {
      // Check if the value is not empty and is different from the original metadata
      return (
        value &&
        value !== "" &&
        value !== metadata?.[key as keyof NostrMetadata]
      );
    });

    if (!hasName && !hasUpdatedField) {
      toast({
        title: "Error",
        description: "Please provide a name or update at least one field",
        variant: "destructive",
      });
      return;
    }

    try {
      // Start with existing metadata to preserve all fields
      const existingMetadata = metadata || {};

      // Combine existing metadata with new values, ensuring we preserve all existing fields
      const data = {
        ...existingMetadata,
        ...values,
      };

      // Only remove empty values that were explicitly set to empty (not originally empty)
      for (const key in values) {
        if (values[key as keyof NostrMetadata] === "") {
          delete data[key];
        }
      }

      console.log("Publishing profile update:", {
        original: existingMetadata,
        updates: values,
        final: data,
      });

      // Prepare the kind 0 event
      const eventToPublish = {
        kind: KINDS.METADATA,
        content: JSON.stringify(data),
      };

      console.log("Complete kind 0 event being published:", {
        event: eventToPublish,
        parsedContent: data,
        contentString: JSON.stringify(data),
        preservedFields: Object.keys(data),
      });

      // Publish the metadata event (kind 0) with all preserved fields
      await publishEvent(eventToPublish);

      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ["logins"] });
      queryClient.invalidateQueries({ queryKey: ["author", user.pubkey] });

      console.log(
        "Profile updated successfully. Preserved fields:",
        Object.keys(data)
      );

      // If this was part of onboarding, navigate to groups page
      if (showSkipLink) {
        navigate("/groups");
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast({
        title: "Error",
        description: "Failed to update your profile. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="flex flex-col items-center mb-6">
            <FormField
              control={form.control}
              name="picture"
              render={({ field }) => (
                <div className="text-center">
                  <div className="mb-4 relative mx-auto">
                    <Avatar className="h-24 w-24 rounded-full mx-auto">
                      <AvatarImage src={field.value} />
                      <AvatarFallback className="text-xl">
                        {form.getValues().name?.slice(0, 2).toUpperCase() ||
                          "UP"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-full shadow"
                        onClick={() =>
                          document.getElementById("picture-upload")?.click()
                        }
                      >
                        <Upload className="h-4 w-4" />
                      </Button>
                      <input
                        id="picture-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            uploadPicture(file, "picture");
                          }
                        }}
                      />
                    </div>
                  </div>
                  <FormDescription className="text-center text-sm">
                    Upload a profile picture
                  </FormDescription>
                  <FormMessage />
                </div>
              )}
            />
          </div>

          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Your name"
                      {...field}
                      className="bg-background"
                    />
                  </FormControl>
                  <FormDescription>
                    This is the name that will be displayed to others.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button
              type="submit"
              className="w-full max-w-[200px] flex items-center justify-center gap-2 mx-auto"
              disabled={isPending || isUploading || !form.watch("name")?.trim()}
            >
              {(isPending || isUploading) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>

            {showSkipLink && (
              <div className="flex flex-col items-center gap-3 mt-4">
                <Button
                  type="button"
                  variant="link"
                  className="text-muted-foreground"
                  onClick={() => navigate("/groups")}
                >
                  Skip for now
                </Button>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-muted" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      or
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={handleBackToLogin}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </Button>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};
