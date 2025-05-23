import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Palette } from "lucide-react";
import { Link } from "react-router-dom";

interface CustomizationPreviewProps {
  groupId: string;
  hasCustomization: boolean;
  isOwner: boolean;
}

export function CustomizationPreview({ groupId, hasCustomization, isOwner }: CustomizationPreviewProps) {
  if (!isOwner) return null;

  return (
    <Card className="mb-4 border-dashed border-2 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Palette className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-medium text-blue-900 dark:text-blue-100">
                {hasCustomization ? "Group Customization Active" : "Customize Your Group"}
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {hasCustomization 
                  ? "Your group has custom styling applied. Edit to make changes."
                  : "Make your group unique with custom colors, layouts, and branding."
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasCustomization && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                Customized
              </Badge>
            )}
            <Button asChild variant="outline" size="sm" className="border-blue-300 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900">
              <Link to={`/group/${encodeURIComponent(groupId)}/settings?tab=customization`}>
                {hasCustomization ? "Edit Style" : "Customize"}
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}