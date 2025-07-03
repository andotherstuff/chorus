import { Check, ChevronsUpDown, Wifi, Plus, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { useAppContext } from "@/hooks/useAppContext";

interface RelaySelectorProps {
  className?: string;
}

export function RelaySelector(props: RelaySelectorProps) {
  const { className } = props;
  const { config, updateConfig, presetRelays = [] } = useAppContext();
  
  const selectedRelay = config.relayUrl;
  const setSelectedRelay = (relay: string) => {
    updateConfig((current) => ({ ...current, relayUrl: relay }));
  };

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const selectedOption = presetRelays.find((option) => option.url === selectedRelay);

  // Function to normalize relay URL by adding wss:// if no protocol is present
  const normalizeRelayUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return trimmed;
    
    // Check if it already has a protocol
    if (trimmed.includes('://')) {
      return trimmed;
    }
    
    // Add wss:// prefix
    return `wss://${trimmed}`;
  };

  // Handle adding a custom relay
  const handleAddCustomRelay = (url: string) => {
    setSelectedRelay?.(normalizeRelayUrl(url));
    setOpen(false);
    setInputValue("");
  };

  // Check if input value looks like a valid relay URL
  const isValidRelayInput = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    
    // Basic validation - should contain at least a domain-like structure
    const normalized = normalizeRelayUrl(trimmed);
    try {
      new URL(normalized);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between h-10", className)}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Wifi className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">
              {selectedOption 
                ? selectedOption.name 
                : selectedRelay 
                  ? selectedRelay.replace(/^wss?:\/\//, '')
                  : "Select relay..."
              }
            </span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search relays or enter custom URL..." 
            value={inputValue}
            onValueChange={setInputValue}
            className="h-9"
          />
          <CommandList>
            <CommandEmpty>
              {inputValue && isValidRelayInput(inputValue) ? (
                <CommandItem
                  onSelect={() => handleAddCustomRelay(inputValue)}
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4 text-green-600" />
                  <div className="flex flex-col">
                    <span className="font-medium">Add custom relay</span>
                    <span className="text-xs text-muted-foreground">
                      {normalizeRelayUrl(inputValue)}
                    </span>
                  </div>
                </CommandItem>
              ) : (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {inputValue ? "Invalid relay URL format" : "No relays found. Try typing a custom URL."}
                </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {presetRelays
                .filter((option) => 
                  !inputValue || 
                  option.name.toLowerCase().includes(inputValue.toLowerCase()) ||
                  option.url.toLowerCase().includes(inputValue.toLowerCase())
                )
                .map((option) => (
                  <CommandItem
                    key={option.url}
                    value={option.url}
                    onSelect={(currentValue) => {
                      setSelectedRelay(normalizeRelayUrl(currentValue));
                      setOpen(false);
                      setInputValue("");
                    }}
                    className="py-3"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <Check
                        className={cn(
                          "h-4 w-4 text-green-600",
                          selectedRelay === option.url ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-medium truncate">{option.name}</span>
                        <span className="text-xs text-muted-foreground truncate">{option.url}</span>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              {inputValue && isValidRelayInput(inputValue) && (
                <CommandItem
                  onSelect={() => handleAddCustomRelay(inputValue)}
                  className="cursor-pointer border-t py-3"
                >
                  <div className="flex items-center gap-3 w-full">
                    <Plus className="h-4 w-4 text-green-600" />
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-medium">Add custom relay</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {normalizeRelayUrl(inputValue)}
                      </span>
                    </div>
                  </div>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}