'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  placeholder?: string;
  enableSelectClearAll?: boolean;
}

export function MultiSelect({ 
  options, 
  selected, 
  onChange, 
  className, 
  placeholder = 'Select...',
  enableSelectClearAll = false
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value]
    );
  };

  const handleSelectAll = () => {
    onChange(options.map((option) => option.value));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const normalOptions = React.useMemo(() => {
    if (enableSelectClearAll) {
      return [...options].sort((a, b) => a.label.localeCompare(b.label));
    }
    return options;
  }, [options, enableSelectClearAll]);

  const showSelectAll = enableSelectClearAll && selected.length < options.length;
  const showClearAll = enableSelectClearAll && selected.length > 0;

  const displayValue = React.useMemo(() => {
    if (selected.length === 0) return placeholder;
    const selectedLabels = selected.map(val => options.find(opt => opt.value === val)?.label || val);
    if (selectedLabels.length <= 2) {
      return `${placeholder}: ${selectedLabels.join(', ')}`;
    }
    return `${placeholder}: ${selectedLabels.slice(0, 2).join(', ')}...`;
  }, [selected, options, placeholder]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <span className="truncate">{displayValue}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {showSelectAll && (
                <CommandItem
                  key="select-all"
                  value="Select All"
                  onSelect={handleSelectAll}
                  className="font-bold cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-slate-50 border-b border-slate-100"
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Select All
                </CommandItem>
              )}
              {showClearAll && (
                <CommandItem
                  key="clear-all"
                  value="Clear All"
                  onSelect={handleClearAll}
                  className="font-bold cursor-pointer text-red-650 hover:text-red-700 hover:bg-slate-50 border-b border-slate-100"
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Clear All
                </CommandItem>
              )}
              {normalOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => handleSelect(option.value)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
