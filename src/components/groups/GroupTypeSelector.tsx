import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Globe, Lock, Users, Shield } from "lucide-react";
import type { GroupType } from "@/types/groups";

interface GroupTypeSelectorProps {
  value: GroupType;
  onChange: (type: GroupType) => void;
}

export function GroupTypeSelector({ value, onChange }: GroupTypeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Choose Group Type</h3>
      <RadioGroup
        value={value}
        onValueChange={(value) => onChange(value as GroupType)}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* NIP-72 Public Communities */}
        <Card className={`cursor-pointer transition-colors ${value === "nip72" ? "ring-2 ring-primary" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="nip72" className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="nip72" id="nip72" />
                <Globe className="h-4 w-4" />
                <span className="font-medium">Public Community</span>
              </Label>
              <Badge variant="secondary">NIP-72</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Create a public community that anyone can discover and request to join.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>Public discovery</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                <span>Moderated membership</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-3 w-3" />
                <span>Works with any relay</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* NIP-29 Private Groups */}
        <Card className={`cursor-pointer transition-colors ${value === "nip29" ? "ring-2 ring-primary" : ""}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="nip29" className="flex items-center gap-2 cursor-pointer">
                <RadioGroupItem value="nip29" id="nip29" />
                <Lock className="h-4 w-4" />
                <span className="font-medium">Private Group</span>
              </Label>
              <Badge variant="outline">NIP-29</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground mb-3">
              Create a private group with relay-level access control and enhanced privacy.
            </p>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="h-3 w-3" />
                <span>Private & invite-only</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3" />
                <span>Relay-level access control</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3" />
                <span>Enhanced member management</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </RadioGroup>
    </div>
  );
}
