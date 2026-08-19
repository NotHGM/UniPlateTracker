"use client";

import { Rows2, Rows3, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { OPTIONAL_COLUMNS, type ColumnKey, type Density } from "./use-table-preferences";

/**
 * Density and column visibility, behind one control.
 *
 * Two separate toolbar buttons for these would spend scarce header width on
 * settings rather than on data, which is the wrong priority for a table that
 * is the whole product. They share a menu because they are the same kind of
 * decision: how much of this do I want to see at once.
 */
export function TableSettings({
    density,
    onDensityChange,
    hiddenColumns,
    onToggleColumn,
    availableColumns,
}: {
    density: Density;
    onDensityChange: (density: Density) => void;
    hiddenColumns: ColumnKey[];
    onToggleColumn: (column: ColumnKey) => void;
    /** Columns that exist for this configuration. In international mode without
     *  an API there are no vehicle details to show or hide, and offering
     *  toggles for columns that are not rendered would be nonsense. */
    availableColumns: ColumnKey[];
}) {
    const hiddenCount = hiddenColumns.filter((column) => availableColumns.includes(column)).length;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {/*
                  * The name has to contain the visible word "View" (WCAG 2.5.3
                  * Label in Name), or someone using voice control who says
                  * "click view" — reading the button in front of them — matches
                  * nothing. Same trap the filter dropdowns fell into.
                  */}
                <Button
                    variant="ghost"
                    size="sm"
                    aria-label={
                        hiddenCount > 0
                            ? `View options, ${hiddenCount} ${hiddenCount === 1 ? "column" : "columns"} hidden`
                            : "View options"
                    }
                >
                    <SlidersHorizontal className="h-4 w-4 mr-1.5" aria-hidden />
                    View
                    {hiddenCount > 0 && (
                        // Surfaced because a hidden column is invisible by
                        // definition: without this, someone who hid a column
                        // and forgot has no way to tell the data is missing
                        // rather than absent.
                        <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                            {hiddenCount} hidden
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Row height</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                    value={density}
                    onValueChange={(value) => onDensityChange(value as Density)}
                >
                    <DropdownMenuRadioItem value="comfortable">
                        <Rows2 className="h-4 w-4 mr-2" aria-hidden />
                        Comfortable
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="compact">
                        <Rows3 className="h-4 w-4 mr-2" aria-hidden />
                        Compact
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                <DropdownMenuSeparator />

                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                {availableColumns.map((column) => (
                    <DropdownMenuCheckboxItem
                        key={column}
                        checked={!hiddenColumns.includes(column)}
                        onCheckedChange={() => onToggleColumn(column)}
                        // Radix closes the menu on select by default, which
                        // makes toggling three columns a three-trip job.
                        onSelect={(event) => event.preventDefault()}
                    >
                        {OPTIONAL_COLUMNS[column]}
                    </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
