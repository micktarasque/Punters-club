import React, { useEffect, useState } from "react";
import { Check, Copy, Download, Play, Terminal } from "lucide-react";
import { safeFetchJson } from "../utils/safeFetchJson";

interface PythonScraperPanelProps {
  selectedDate: string;
  endDate: string;
  dateMode: "single" | "range";
  trackFilter: string;
  onRunScrape: () => void;
  isScraping: boolean;
}

const FALLBACK_SCRIPT_PREVIEW = `#!/usr/bin/env python3
"""
NSW TAB Racing Results, Live Odds & Form Guide Scraper
Fetches official NSW TAB (tab.com.au) thoroughbred meetings, runner form guides,
fixed/tote betting odds, finishing results, and exotic dividends.
"""
# See scripts/nsw_tab_scraper.py in project workspace
`;

export const PythonScraperPanel: React.FC<PythonScraperPanelProps> = ({
  selectedDate,
  endDate,
  dateMode,
  trackFilter,
  onRunScrape,
  isScraping,
}) => {
  const [scriptCode, setScriptCode] = useState<string>("");
  const [copiedCli, setCopiedCli] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    safeFetchJson<{ code?: string }>("/api/nsw-tab/python-script")
      .then(({ ok, data }) => {
        if (ok && data?.code) {
          setScriptCode(data.code);
        } else {
          setScriptCode(FALLBACK_SCRIPT_PREVIEW);
        }
      })
      .catch(() => {
        setScriptCode(FALLBACK_SCRIPT_PREVIEW);
      });
  }, []);

  const cliCommand = `python3 scripts/nsw_tab_scraper.py --date ${selectedDate}${
    dateMode === "range" && endDate !== selectedDate
      ? ` --end-date ${endDate}`
      : ""
  } --jurisdiction NSW${
    trackFilter ? ` --venue "${trackFilter}"` : ""
  } --output nsw_tab_${selectedDate}.json`;

  const handleCopy = async (text: string, type: "cli" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "cli") {
        setCopiedCli(true);
        setTimeout(() => setCopiedCli(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      // Fallback ignored in sandbox
    }
  };

  const handleDownloadPy = () => {
    const blob = new Blob([scriptCode || FALLBACK_SCRIPT_PREVIEW], {
      type: "text/x-python;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nsw_tab_scraper.py";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#121A16] border border-[#1F2D26] rounded-lg p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#F3F4F0]">
              Python NSW TAB Scraper (`scripts/nsw_tab_scraper.py`)
            </h2>
            <p className="text-xs text-[#8A9990] mt-0.5">
              Standalone Python 3 CLI script that queries official NSW TAB (`api.tab.com.au`) endpoints by date or date range to populate meetings, live betting odds, form guides, and exotic dividends.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRunScrape}
              disabled={isScraping}
              className="min-h-[44px] sm:min-h-[36px] flex items-center gap-2 px-4 py-2 rounded-md bg-[#D4AF37] text-[#0B110E] text-xs font-semibold hover:bg-[#E2C152] disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {isScraping
                  ? "Running NSW TAB Scrape..."
                  : "Execute Scraper & Populate Sheet"}
              </span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPy}
              className="min-h-[44px] sm:min-h-[36px] flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#0B110E] border border-[#1F2D26] text-xs font-medium text-[#F3F4F0] hover:border-[#D4AF37] transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Download .py</span>
            </button>
          </div>
        </div>

        {/* Dynamic CLI Command Box */}
        <div className="bg-[#0B110E] border border-[#1F2D26] rounded-md p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 overflow-x-auto">
            <Terminal className="w-4 h-4 text-[#10B981] shrink-0" />
            <code className="font-mono text-xs text-[#10B981] whitespace-nowrap">
              {cliCommand}
            </code>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(cliCommand, "cli")}
            className="min-h-[40px] sm:min-h-[32px] flex items-center justify-center gap-1.5 px-3 py-1 rounded bg-[#16201B] hover:bg-[#1F2D26] text-xs text-[#F3F4F0] shrink-0 cursor-pointer"
          >
            {copiedCli ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Copied CLI</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#8A9990]" />
                <span>Copy Command</span>
              </>
            )}
          </button>
        </div>

        {/* Full Source Code Viewer */}
        <div className="border border-[#1F2D26] rounded-md overflow-hidden bg-[#0B110E]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#1F2D26] bg-[#121A16]">
            <span className="font-mono text-xs text-[#8A9990]">
              scripts/nsw_tab_scraper.py · Python 3 Standard Library (`urllib.request`, `argparse`, `json`)
            </span>
            <button
              type="button"
              onClick={() => handleCopy(scriptCode, "code")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0B110E] border border-[#1F2D26] text-xs text-[#F3F4F0] hover:border-[#D4AF37] cursor-pointer"
            >
              {copiedCode ? (
                <>
                  <Check className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Copied Code</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-[#8A9990]" />
                  <span>Copy Python Script</span>
                </>
              )}
            </button>
          </div>
          <pre className="p-4 text-xs font-mono text-[#F3F4F0] overflow-x-auto max-h-[520px] leading-relaxed">
            <code>{scriptCode || "Loading scripts/nsw_tab_scraper.py..."}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
