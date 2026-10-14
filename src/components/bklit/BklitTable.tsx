import React, { useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";

export interface BklitColumn<T> {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  width?: string;
  sortable?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface BklitTableProps<T> {
  columns: BklitColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  emptyMessage?: string;
  className?: string;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
  onRowClick?: (row: T) => void;
}

export function BklitTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found",
  className = "",
  defaultSortKey,
  defaultSortDirection = "desc",
  onRowClick,
}: BklitTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(defaultSortKey || null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    defaultSortDirection
  );

  const handleSort = (columnKey: string) => {
    if (sortKey === columnKey) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(columnKey);
      setSortDirection("desc");
    }
  };

  const sortedData = React.useMemo(() => {
    if (!sortKey) return data;
    const sorted = [...data].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortDirection === "asc" ? valA - valB : valB - valA;
      }
      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();
      return sortDirection === "asc"
        ? strA.localeCompare(strB)
        : strB.localeCompare(strA);
    });
    return sorted;
  }, [data, sortKey, sortDirection]);

  return (
    <div
      className={`bklit-table-wrapper rounded-lg border border-[#1F2D26] bg-[#0B110E] overflow-hidden ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left font-mono text-xs tabular-nums">
          <thead>
            <tr className="border-b border-[#1F2D26] bg-[#0E1612] text-[11px] text-[#8A9990]">
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const alignClass =
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left";

                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`py-2.5 px-3 uppercase tracking-wider font-semibold select-none ${alignClass} ${
                      col.sortable ? "cursor-pointer hover:text-[#F3F4F0]" : ""
                    }`}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div
                      className={`inline-flex items-center gap-1 ${
                        col.align === "right" ? "justify-end" : ""
                      }`}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span className="shrink-0 text-[#8A9990]">
                          {isSorted ? (
                            sortDirection === "asc" ? (
                              <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5 text-[#D4AF37]" />
                            )
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F2D26]">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-8 px-4 text-center text-[#8A9990] font-sans"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              sortedData.map((row, index) => (
                <tr
                  key={keyExtractor(row, index)}
                  onClick={() => onRowClick?.(row)}
                  className={`hover:bg-[#141E19] transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {columns.map((col) => {
                    const alignClass =
                      col.align === "right"
                        ? "text-right"
                        : col.align === "center"
                        ? "text-center"
                        : "text-left";

                    return (
                      <td
                        key={col.key}
                        className={`py-2 px-3 text-[#D5DDD8] ${alignClass}`}
                      >
                        {col.render
                          ? col.render(row, index)
                          : row[col.key] ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
