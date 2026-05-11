"use client"

import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker, useDayPicker, useNavigation } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select"
import { format } from "date-fns"

export type CalendarProps = React.ComponentProps<typeof DayPicker>

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {

  const CustomCaption = (props: { displayMonth: Date }) => {
    const { goToMonth, nextMonth, previousMonth } = useNavigation();
    const { fromYear, toYear } = useDayPicker();

    const handleYearChange = (value: string) => {
      const newDate = new Date(props.displayMonth);
      newDate.setFullYear(parseInt(value, 10));
      goToMonth(newDate);
    }

    const handleMonthChange = (value: string) => {
      const newDate = new Date(props.displayMonth);
      newDate.setMonth(parseInt(value, 10));
      goToMonth(newDate);
    }
    
    let fromYearValue = fromYear || (toYear ? toYear-100 : new Date().getFullYear()-100)
    let toYearValue = toYear || (fromYear ? fromYear+100 : new Date().getFullYear()+100)

    const yearOptions = [];
    for(let i=fromYearValue; i<=toYearValue; i++){
      yearOptions.push(i)
    }

    const monthOptions = Array.from({length: 12}, (_, i) => ({ value: i, label: format(new Date(2000, i), "MMMM")}));

    return (
      <div className="flex justify-between items-center px-2">
        <Button
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={() => previousMonth && goToMonth(previousMonth)}
          disabled={!previousMonth}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-2">
          <Select value={String(props.displayMonth.getMonth())} onValueChange={handleMonthChange}>
            <SelectTrigger className="w-[120px] h-8 text-sm focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(month => (
                <SelectItem key={month.value} value={String(month.value)}>{month.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(props.displayMonth.getFullYear())} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[90px] h-8 text-sm focus:ring-0 focus:ring-offset-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map(year => (
                <SelectItem key={year} value={String(year)}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          className="h-7 w-7 p-0"
          onClick={() => nextMonth && goToMonth(nextMonth)}
          disabled={!nextMonth}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
        day_today: "bg-sky-200 text-accent-foreground dark:bg-sky-800",
        day_outside:
          "day-outside text-muted-foreground opacity-90 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: props.captionLayout === 'dropdown-buttons' ? CustomCaption : undefined,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
