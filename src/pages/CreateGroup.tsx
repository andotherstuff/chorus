import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUploadFile } from "@/hooks/useUploadFile";
import { useEnhancedNostr } from "@/components/EnhancedNostrProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/useToast";
import Header from "@/components/ui/Header";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Upload, Info, Globe, Lock, Users, Shield } from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { KINDS } from "@/lib/nostr-kinds";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GroupTypeSelector } from "@/components/groups/GroupTypeSelector";
import type { GroupType } from "@/types/groups";

// Create a schema for form validation
const formSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
  guidelines: z.string().optional(),
  imageUrl: z.string().optional(),
  groupType: z.enum(["nip72", "nip29"] as const),
  relay: z.string().url("Must be a valid relay URL").optional(),
  isPrivate: z.boolean().default(false),
  isClosed: z.boolean().default(false),
}).refine((data) => {
  // If NIP-29 is selected, relay is required
  if (data.groupType === "nip29" && !data.relay) {
    return false;
  }
  return true;
}, {
  message: "Relay URL is required for NIP-29 groups",
  path: ["relay"],
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateGroup() {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const { mutateAsync: publishEvent, isPending: isSubmitting } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const { nostr: enhancedNostr } = useEnhancedNostr();
  const { toast } = useToast();
  const [isCreatingNip29, setIsCreatingNip29] = useState(false);

  // Initialize the form with react-hook-form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      guidelines: "",
      imageUrl: "",
      groupType: "nip72",
      relay: "wss://communities.nos.social",
      isPrivate: false,
      isClosed: false,
    },
  });

  const selectedGroupType = form.watch("groupType");
  const selectedRelay = form.watch("relay");

  // We'll create a manual NIP-29 group creation function since we can't use hooks conditionally

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

  // Handle file uploads for group image
  const uploadGroupImage = async (file: File) => {
    try {
      // The first tuple in the array contains the URL
      const [[_, url]] = await uploadFile(file);
      form.setValue('imageUrl', url);
      toast({
        title: 'Success',
        description: 'Group image uploaded successfully',
      });
    } catch (error) {
      console.error('Failed to upload group image:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload group image. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (values: FormValues) => {
    try {
      if (values.groupType === "nip72") {
        // Create NIP-72 community
        await createNip72Group(values);
      } else {
        // Create NIP-29 group
        await createNip29GroupHandler(values);
      }

      toast({
        title: 'Success',
        description: `${values.groupType.toUpperCase()} group created successfully!`,
      });
      navigate("/groups");
    } catch (error) {
      console.error("Error creating group:", error);
      toast({
        title: 'Error',
        description: 'Failed to create group. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const createNip72Group = async (values: FormValues) => {
    // Generate unique identifier
    const identifier = generateUniqueIdentifier(values.name);

    // Create community event (kind 34550)
    const tags = [
      ["d", identifier],
      ["name", values.name],
    ];

    // Add description tag if provided
    if (values.description) {
      tags.push(["description", values.description]);
    }

    // Add guidelines tag if provided
    if (values.guidelines) {
      tags.push(["guidelines", values.guidelines]);
    }

    // Add image tag if available
    if (values.imageUrl) {
      tags.push(["image", values.imageUrl]);
    }

    // Add current user as moderator
    tags.push(["p", user!.pubkey, "", "moderator"]);

    // Publish the community event
    await publishEvent({
      kind: KINDS.GROUP,
      tags,
      content: "",
    });
  };

  const createNip29GroupHandler = async (values: FormValues) => {
    if (!values.relay) {
      throw new Error("Relay URL is required for NIP-29 groups");
    }

    if (!user) {
      throw new Error("Must be logged in to create a group");
    }

    setIsCreatingNip29(true);
    try {
      // Create NIP-29 group creation event (kind 9007)
      const tags: string[][] = [
        ["name", values.name],
      ];

      if (values.description) {
        tags.push(["about", values.description]);
      }

      if (values.imageUrl) {
        tags.push(["picture", values.imageUrl]);
      }

      if (values.isPrivate) {
        tags.push(["private"]);
      }

      if (values.isClosed) {
        tags.push(["closed"]);
      }

      // Create and sign the event manually since we need to send to specific relay
      const event = await user.signer.signEvent({
        kind: 9007, // GROUP_CREATE
        tags,
        content: "",
        created_at: Math.floor(Date.now() / 1000),
      });

      // Send to the specific relay using enhanced nostr provider
      if (!enhancedNostr) {
        throw new Error("Enhanced Nostr provider not available");
      }

      await enhancedNostr.event(event, { relays: [values.relay] });
      // Note: Debug logging removed
    } finally {
      setIsCreatingNip29(false);
    }
  };

  return (
    <div className="container mx-auto py-1 px-3 sm:px-4">
      <Header />
      <div className="my-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create a Group</h1>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Group Type Selection */}
            <FormField
              control={form.control}
              name="groupType"
              render={({ field }) => (
                <FormItem>
                  <GroupTypeSelector
                    value={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Info Alert about the selected type */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {selectedGroupType === "nip72" ? (
                  <>
                    <strong>Public Communities (NIP-72)</strong> are discoverable by anyone and hosted on regular Nostr relays. 
                    Anyone can request to join, but moderators approve new members. Perfect for open communities.
                  </>
                ) : (
                  <>
                    <strong>Private Groups (NIP-29)</strong> require a dedicated relay and offer enhanced privacy with 
                    relay-level access control. You control who can join and all group data stays private.
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="flex flex-col items-center mb-6">
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <div className="text-center">
                    <div className="mb-4 relative mx-auto">
                      <Avatar className="h-24 w-24 rounded-full mx-auto">
                        <AvatarImage src={field.value} />
                        <AvatarFallback className="text-xl">
                          {form.getValues().name?.slice(0, 2).toUpperCase() || 'GP'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-0 right-0">
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="h-8 w-8 rounded-full shadow"
                          onClick={() => document.getElementById('image-upload')?.click()}
                        >
                          <Upload className="h-4 w-4" />
                        </Button>
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              uploadGroupImage(file);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <FormDescription className="text-center text-sm">
                      Upload a group image
                    </FormDescription>
                    <FormMessage />
                  </div>
                )}
              />
            </div>

            <div className="space-y-4">
              {/* NIP-29 Relay Selection */}
              {selectedGroupType === "nip29" && (
                <FormField
                  control={form.control}
                  name="relay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Group Relay URL *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="wss://communities.nos.social" 
                          {...field} 
                          className="bg-background" 
                        />
                      </FormControl>
                      <FormDescription>
                        The relay where your private group will be hosted. Must support NIP-29.
                        <br />
                        <strong>Popular NIP-29 relays:</strong> wss://communities.nos.social, wss://groups.fiatjaf.com, wss://groups.nostr.band
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="My Awesome Group" {...field} className="bg-background" />
                    </FormControl>
                    <FormDescription>
                      This is the name that will be displayed to others.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Tell people what your group is about..." 
                        {...field}
                        rows={4}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a brief description of what your group is about.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="guidelines"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group Guidelines</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Set community rules and guidelines for members to follow..." 
                        {...field}
                        rows={4}
                        className="resize-none"
                      />
                    </FormControl>
                    <FormDescription>
                      Define rules and expectations for group members. This is optional.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* NIP-29 Privacy Settings */}
              {selectedGroupType === "nip29" && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Privacy & Access Settings
                  </h4>
                  
                  <FormField
                    control={form.control}
                    name="isPrivate"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Private Group</FormLabel>
                          <FormDescription>
                            Group metadata and member list will be hidden from non-members
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isClosed"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">Closed Group</FormLabel>
                          <FormDescription>
                            Only admins can add new members (no join requests allowed)
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button
                type="submit"
                className="w-full max-w-[200px] flex items-center justify-center gap-2 mx-auto"
                disabled={isSubmitting || isUploading || isCreatingNip29 || !form.watch('name')?.trim()}
              >
                {(isSubmitting || isUploading || isCreatingNip29) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create {selectedGroupType === "nip29" ? "Private Group" : "Public Community"}
              </Button>
              
              <div className="text-center mt-2">
                <Button
                  type="button"
                  variant="link"
                  className="text-muted-foreground"
                  onClick={() => navigate("/groups")}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
