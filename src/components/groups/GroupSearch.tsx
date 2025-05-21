import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GroupSearchProps {
  onSearch: (query: string) => void;
  className?: string;
}

export function GroupSearch({ onSearch, className }: GroupSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearch(query);
  };

  const clearSearch = () => {
    setSearchQuery("");
    onSearch("");
  };

  return (
    <div
      className={cn(
        "relative flex items-center w-full",
        "mx-auto md:mx-0", // Center on mobile, left-aligned on desktop
        "transition-all duration-200 ease-in-out",
        "sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2",
        className
      )}
    >
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search groups..."
        value={searchQuery}
        onChange={handleSearch}
        className="pl-9 pr-10 h-10 md:h-9 w-full focus-visible:ring-0 rounded-full shadow-sm"
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoComplete="off"
        enterKeyHint="search"
      />
      {searchQuery && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 h-7 w-7 rounded-full hover:bg-muted"
          onClick={clearSearch}
          type="button"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear search</span>
        </Button>
      )}
    </div>
  );
}
