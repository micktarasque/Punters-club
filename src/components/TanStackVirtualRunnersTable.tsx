import React, { useMemo, useRef, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  Zap,
} from "lucide-react";
import { RaceEvent, RaceRunner, RaceSelectionTrio } from "../types/racing";
import { JockeySilkSvg } from "./JockeySilkSvg";
import { TactileOddsFlucBadge } from "./TactileOddsFlucBadge";
import { RunnerAiAnalysisButton } from "./RunnerAiAnalysisButton";

export interface TanStackVirtualRunnersTableProps {
  race: RaceEvent;
  meetingId: string;
  activeRaceTrio: RaceSelectionTrio;
  onAssignPreference: (
    meetingId: string,
    raceNumber: number,
    preferenceRank: 1 | 2 | 3,
    tabNumber: number
  ) => void;
  expandedRunners: Record<number, boolean>;
  onToggleRunnerForm: (tabNo: number) => void;
  isApple?: boolean;
}

export const TanStackVirtualRunnersTable: React.FC<
  TanStackVirtualRunnersTableProps
> = ({
  race,
  meetingId,
  activeRaceTrio,
  onAssignPreference,
  expandedRunners,
  onToggleRunnerForm,
  isApple = false,
}) => {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "tabNumber", desc: false },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const tableContainerRef = useRef<HTMLDivElement | null>(null);

  const data = useMemo(() => race.runners, [race.runners]);

  const columns = useMemo<ColumnDef<RaceRunner>[]>(
    () => [
      {
        id: "finishPosition",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
          >
            <span>Pos</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        accessorFn: (row) =>
          row.finishPosition > 0 ? row.finishPosition : 999 + row.tabNumber,
        cell: (info) => {
          const runner = info.row.original;
          if (runner.finishPosition === 1) {
            return (
              <span className="font-mono font-bold text-[#D4AF37] px-1.5 py-0.5 rounded bg-[#D4AF37]/15">
                1st
              </span>
            );
          }
          if (runner.finishPosition === 2) {
            return (
              <span className="font-mono font-bold text-[#F3F4F0] px-1.5 py-0.5 rounded bg-white/10">
                2nd
              </span>
            );
          }
          if (runner.finishPosition === 3) {
            return (
              <span className="font-mono font-bold text-[#10B981] px-1.5 py-0.5 rounded bg-[#10B981]/15">
                3rd
              </span>
            );
          }
          return (
            <span className="font-mono text-xs text-[#8A9990]">
              {runner.finishPosition > 0 ? `${runner.finishPosition}th` : "-"}
            </span>
          );
        },
        size: 55,
      },
      {
        id: "tabNumber",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
          >
            <span># (Bar)</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        accessorFn: (row) => row.tabNumber,
        cell: (info) => {
          const runner = info.row.original;
          return (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#F3F4F0]">
                #{runner.tabNumber}
              </span>
              <span className="text-[11px] font-mono text-[#8A9990]">
                ({runner.barrier})
              </span>
              <div className="w-4 h-4 shrink-0">
                <JockeySilkSvg
                  primary={runner.silkPrimary || "#D4AF37"}
                  secondary={runner.silkSecondary}
                />
              </div>
            </div>
          );
        },
        size: 110,
      },
      {
        id: "runnerInfo",
        header: () => <span>Runner · Pedigree · Form</span>,
        accessorFn: (row) =>
          `${row.horseName} ${row.jockey} ${row.trainer} ${row.sireDam || ""}`,
        cell: (info) => {
          const runner = info.row.original;
          const isExpanded = !!expandedRunners[runner.tabNumber];
          return (
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onToggleRunnerForm(runner.tabNumber)}
                  className="font-semibold text-xs text-[#F3F4F0] hover:text-[#D4AF37] transition text-left cursor-pointer"
                >
                  {runner.horseName}
                </button>
                {runner.isScratched && (
                  <span className="px-1 py-0.2 rounded bg-[#EF4444]/20 border border-[#EF4444]/50 text-[#EF4444] text-[9px] font-mono font-bold uppercase">
                    SCRATCHED
                  </span>
                )}
                {runner.speedMapPosition && (
                  <span className="px-1.5 py-0.2 rounded bg-[#0B110E] border border-[#1F2D26] text-[10px] font-mono text-[#8A9990]">
                    {runner.speedMapPosition}
                  </span>
                )}
                <RunnerAiAnalysisButton
                  runner={runner}
                  race={race}
                  size="xs"
                />
              </div>
              <div className="text-[11px] text-[#8A9990] flex items-center gap-2">
                <span>{runner.jockey}</span>
                <span>·</span>
                <span>{runner.trainer}</span>
                {runner.form && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-[#10B981] font-semibold">
                      {runner.form}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        },
        size: 260,
      },
      {
        id: "weight",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
          >
            <span>Wgt</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        accessorFn: (row) => row.weight,
        cell: (info) => (
          <span className="font-mono text-xs text-[#8A9990] tabular-nums">
            {info.getValue<number>()}kg
          </span>
        ),
        size: 70,
      },
      {
        id: "speedRating",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
          >
            <span>Rtg</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        accessorFn: (row) => row.speedRating || 0,
        cell: (info) => (
          <span className="font-mono text-xs text-[#D4AF37] tabular-nums font-semibold">
            {info.getValue<number>() || "-"}
          </span>
        ),
        size: 65,
      },
      {
        id: "oddsFlucs",
        header: () => <span>Live Odds Flucs</span>,
        accessorFn: (row) => row.nswTabWin,
        cell: (info) => {
          const runner = info.row.original;
          return (
            <TactileOddsFlucBadge
              openingOdds={runner.openingOdds || runner.nswTabWin}
              currentOdds={runner.nswTabWin}
              marketSupport={runner.marketSupport}
            />
          );
        },
        size: 140,
      },
      {
        id: "nswTabWin",
        header: ({ column }) => (
          <button
            type="button"
            onClick={column.getToggleSortingHandler()}
            className="inline-flex items-center gap-1 hover:text-[#F3F4F0] cursor-pointer"
          >
            <span>Win / Plc</span>
            <ArrowUpDown className="w-3 h-3" />
          </button>
        ),
        accessorFn: (row) => row.nswTabWin,
        cell: (info) => {
          const runner = info.row.original;
          return (
            <div className="font-mono text-xs tabular-nums text-right">
              <div className="font-bold text-[#F3F4F0]">
                ${(runner.nswTabWin || 0).toFixed(2)}
              </div>
              <div className="text-[10px] text-[#8A9990]">
                ${(runner.nswTabPlace || 0).toFixed(2)}
              </div>
            </div>
          );
        },
        size: 100,
      },
      {
        id: "preferences",
        header: () => (
          <span className="text-right block">Set Preference (1st · 2nd · 3rd)</span>
        ),
        cell: (info) => {
          const runner = info.row.original;
          const is1st = activeRaceTrio.firstPref === runner.tabNumber;
          const is2nd = activeRaceTrio.secondPref === runner.tabNumber;
          const is3rd = activeRaceTrio.thirdPref === runner.tabNumber;

          if (runner.isScratched) {
            return (
              <span className="text-right block text-[11px] font-mono text-[#8A9990] italic">
                Scratched
              </span>
            );
          }

          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onAssignPreference(
                    meetingId,
                    race.raceNumber,
                    1,
                    runner.tabNumber
                  )
                }
                className={`min-h-[28px] px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                  is1st
                    ? "bg-[#D4AF37] text-[#0B110E] shadow-sm font-black"
                    : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:border-[#D4AF37] hover:text-[#D4AF37]"
                }`}
                title="Nominate as 1st Preference (3 pts)"
              >
                1st
              </button>

              <button
                type="button"
                onClick={() =>
                  onAssignPreference(
                    meetingId,
                    race.raceNumber,
                    2,
                    runner.tabNumber
                  )
                }
                className={`min-h-[28px] px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                  is2nd
                    ? "bg-white text-[#0B110E] shadow-sm font-black"
                    : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:border-white hover:text-[#F3F4F0]"
                }`}
                title="Nominate as 2nd Preference (2 pts)"
              >
                2nd
              </button>

              <button
                type="button"
                onClick={() =>
                  onAssignPreference(
                    meetingId,
                    race.raceNumber,
                    3,
                    runner.tabNumber
                  )
                }
                className={`min-h-[28px] px-2 py-0.5 rounded text-[11px] font-mono font-bold transition cursor-pointer ${
                  is3rd
                    ? "bg-[#10B981] text-[#0B110E] shadow-sm font-black"
                    : "bg-[#0B110E] border border-[#1F2D26] text-[#8A9990] hover:border-[#10B981] hover:text-[#10B981]"
                }`}
                title="Nominate as 3rd Preference (1 pt)"
              >
                3rd
              </button>
            </div>
          );
        },
        size: 190,
      },
      {
        id: "formToggle",
        header: () => <span className="text-right block">Form</span>,
        cell: (info) => {
          const runner = info.row.original;
          const isExpanded = !!expandedRunners[runner.tabNumber];
          return (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onToggleRunnerForm(runner.tabNumber)}
                className="p-1 rounded bg-[#0B110E] border border-[#1F2D26] hover:border-[#D4AF37] text-xs text-[#8A9990] hover:text-[#D4AF37] transition cursor-pointer"
                title="Toggle Form Guide"
              >
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-[#D4AF37]" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        },
        size: 55,
      },
    ],
    [
      meetingId,
      race.raceNumber,
      activeRaceTrio,
      onAssignPreference,
      expandedRunners,
      onToggleRunnerForm,
    ]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 56,
    overscan: 4,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start ?? 0 : 0;
  const paddingBottom =
    virtualRows.length > 0
      ? totalSize - (virtualRows[virtualRows.length - 1]?.end ?? 0)
      : 0;

  return (
    <div
      className={`space-y-3 relative isolate rounded-xl overflow-hidden border ${
        isApple
          ? "bg-white border-[#E5E5EA]"
          : "bg-[#0B110E] border-[#1F2D26]"
      }`}
    >
      {/* TanStack Table Toolbar */}
      <div
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-b ${
          isApple
            ? "bg-[#FAF9FA] border-[#E5E5EA]"
            : "bg-[#0E1512] border-[#1F2D26]"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search
              className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                isApple ? "text-[#86868B]" : "text-[#8A9990]"
              }`}
            />
            <input
              type="text"
              value={globalFilter ?? ""}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search runners, jockeys, trainers..."
              className={`rounded-full pl-8 pr-3 py-1.5 text-xs focus:outline-none w-64 ${
                isApple
                  ? "bg-white border border-[#D2D2D7] text-[#1D1D1F] placeholder-[#86868B] focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                  : "bg-[#121A16] border border-[#1F2D26] text-[#F3F4F0] placeholder-[#8A9990] focus:border-[#10B981] focus:ring-2 focus:ring-[#10B981]/20"
              }`}
            />
          </div>
          <span
            className={`text-xs font-mono tabular-nums ${
              isApple ? "text-[#86868B]" : "text-[#8A9990]"
            }`}
          >
            {rows.length} of {data.length} Runners
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium flex items-center gap-1.5 ${
              isApple
                ? "bg-[#EBF5FF] text-[#0071E3]"
                : "bg-[#10B981]/15 text-[#10B981]"
            }`}
          >
            <Zap className="w-3 h-3" />
            <span>Virtual Table Active</span>
          </span>
        </div>
      </div>

      {/* TanStack Virtual Scroll Container */}
      <div
        ref={tableContainerRef}
        className={`relative overflow-x-auto overflow-y-auto max-h-[640px] border-b isolate ${
          isApple ? "border-[#E5E5EA]" : "border-[#1F2D26]"
        }`}
      >
        <table className="w-full text-left border-collapse min-w-[880px]">
          <thead
            className={`sticky top-0 z-10 border-b text-[12px] font-medium shadow-xs ${
              isApple
                ? "bg-[#FAF9FA] border-[#E5E5EA] text-[#86868B]"
                : "bg-[#0E1512] border-[#1F2D26] text-[#8A9990]"
            }`}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`py-2.5 px-3 whitespace-nowrap ${
                      isApple
                        ? "bg-[#FAF9FA] text-[#86868B]"
                        : "bg-[#0E1512] text-[#8A9990]"
                    }`}
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          <tbody
            className={`text-xs divide-y ${
              isApple ? "divide-[#E5E5EA]" : "divide-[#1F2D26]"
            }`}
          >
            {paddingTop > 0 && (
              <tr>
                <td
                  style={{ height: `${paddingTop}px` }}
                  colSpan={columns.length}
                />
              </tr>
            )}
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              const runner = row.original;
              const is1st = activeRaceTrio.firstPref === runner.tabNumber;
              const is2nd = activeRaceTrio.secondPref === runner.tabNumber;
              const is3rd = activeRaceTrio.thirdPref === runner.tabNumber;
              const isPicked = is1st || is2nd || is3rd;

              return (
                <tr
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className={`transition-colors ${
                    isPicked
                      ? isApple
                        ? "bg-[#F2F7FF] hover:bg-[#E8F2FF]"
                        : "bg-[#10B981]/15 hover:bg-[#10B981]/25"
                      : isApple
                      ? "hover:bg-[#FAF9FA]"
                      : "hover:bg-[#14201A]"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`py-2.5 px-3 align-middle ${
                        isApple ? "text-[#1D1D1F]" : "text-[#F3F4F0]"
                      }`}
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td
                  style={{ height: `${paddingBottom}px` }}
                  colSpan={columns.length}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
