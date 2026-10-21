import React, { useState, useEffect } from "react";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  DollarSign,
  ExternalLink,
  Flame,
  GitBranch,
  Layers,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
  Zap,
} from "lucide-react";

interface EnterpriseAiStudioArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  isApple?: boolean;
}

type StudioTab = "graph_simulator" | "caching_calculator" | "code_boilerplate" | "github_repos";

export const EnterpriseAiStudioArchitectureModal: React.FC<EnterpriseAiStudioArchitectureModalProps> = ({
  isOpen,
  onClose,
  isApple = false,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTab>("graph_simulator");
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  // Agent Simulator State
  const [taskPrompt, setTaskPrompt] = useState<string>(
    "Implement an OAuth2 PKCE login route and verify with strict TypeScript types."
  );
  const [codebaseTokens, setCodebaseTokens] = useState<number>(85_000);
  const [simulateErrorRepair, setSimulateErrorRepair] = useState<boolean>(true);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  // Economics Calculator State
  const [calcCodebaseTokens, setCalcCodebaseTokens] = useState<number>(95_000);
  const [calcSessionsPerDay, setCalcSessionsPerDay] = useState<number>(20);
  const [calcTurnsPerSession, setCalcTurnsPerSession] = useState<number>(8);
  const [economicsData, setEconomicsData] = useState<any>(null);

  // Selected Code File
  const [selectedCodeFile, setSelectedCodeFile] = useState<
    "context_cache" | "agent_graph" | "tool_registry" | "hybrid_rag" | "telemetry"
  >("context_cache");

  // Fetch initial economics
  useEffect(() => {
    if (isOpen) {
      handleCalculateEconomics();
    }
  }, [isOpen, calcCodebaseTokens, calcSessionsPerDay, calcTurnsPerSession]);

  if (!isOpen) return null;

  const handleCalculateEconomics = async () => {
    try {
      const res = await fetch("/api/ai/calculate-economics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codebaseTokens: calcCodebaseTokens,
          sessionsPerDay: calcSessionsPerDay,
          turnsPerSession: calcTurnsPerSession,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setEconomicsData(data);
      }
    } catch (e) {
      console.warn("Economics calculation fallback:", e);
    }
  };

  const handleRunAgentSimulation = async () => {
    setIsSimulating(true);
    setSimulationResult(null);
    try {
      const res = await fetch("/api/ai/simulate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskPrompt,
          codebaseTokens,
          simulateErrorRepair,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSimulationResult(data);
      }
    } catch (e) {
      console.error("Simulation error:", e);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCopyCode = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeKey(key);
    setTimeout(() => setCopiedCodeKey(null), 2000);
  };

  const codeSnippets: Record<string, string> = {
    context_cache: `# enterprise_gemini_architecture/context_cache.py
import os
import time
from google import genai
from google.genai import types

client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

def get_or_create_cache(project_name: str, codebase_text: str, ttl_seconds: int = 3600):
    """Provisions AI Studio Context Cache for codebase prefix (>=32,768 tokens)."""
    display_tag = f"codebase-cache-{project_name}"
    for c in client.cached_contents.list():
        if c.display_name == display_tag:
            return client.cached_contents.update(
                name=c.name,
                config=types.UpdateCachedContentConfig(
                    cached_content=types.CachedContent(ttl=f"{ttl_seconds}s")
                )
            )
    return client.cached_contents.create(
        model="gemini-2.5-flash",
        config=types.CreateCachedContentConfig(
            display_name=display_tag,
            contents=[types.Content(role="user", parts=[types.Part.from_text(codebase_text)])],
            ttl=f"{ttl_seconds}s",
        )
    )`,
    agent_graph: `# enterprise_gemini_architecture/agent_graph.py
from langgraph.graph import StateGraph, END
from typing import TypedDict, Annotated, List, Literal
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    task_prompt: str
    iteration_count: int
    test_passed: bool
    compiler_diagnostics: str
    cache_handle_name: str

def route_after_verification(state: AgentState) -> Literal["coder_worker", "synthesizer"]:
    """Self-healing loop: retries up to 3 times on compiler / syntax errors."""
    if not state.get("test_passed", False) and state.get("iteration_count", 0) < 3:
        return "coder_worker"
    return "synthesizer"

workflow = StateGraph(AgentState)
workflow.add_node("supervisor", supervisor_node)
workflow.add_node("coder_worker", coder_worker_node)
workflow.add_node("verifier", sandbox_verifier_node)
workflow.add_node("synthesizer", synthesizer_node)

workflow.set_entry_point("supervisor")
workflow.add_edge("supervisor", "coder_worker")
workflow.add_edge("coder_worker", "verifier")
workflow.add_conditional_edges("verifier", route_after_verification, {
    "coder_worker": "coder_worker",
    "synthesizer": "synthesizer"
})
workflow.add_edge("synthesizer", END)
app = workflow.compile()`,
    tool_registry: `# enterprise_gemini_architecture/tool_registry.py
from pydantic import BaseModel, Field
from google.genai import types

class WriteFileInput(BaseModel):
    file_path: str = Field(description="Normalized relative path to target file")
    content: str = Field(description="Complete pristine file contents")
    rationale: str = Field(description="Architectural reason for modification")

tools = [
    types.FunctionDeclaration(
        name="write_file",
        description="Creates or overwrites a file in the workspace",
        parameters=WriteFileInput.model_json_schema()
    )
]`,
    hybrid_rag: `# enterprise_gemini_architecture/hybrid_rag.py
import networkx as nx
import re

class CodebaseGraphRAG:
    """AST Dependency Graph linking imports, classes, and function callers."""
    def __init__(self):
        self.graph = nx.DiGraph()

    def index_file(self, file_path: str, content: str):
        self.graph.add_node(file_path)
        imports = re.findall(r'from\\s+["\\']([^"\\']+)["\\']', content)
        for imp in imports:
            self.graph.add_edge(file_path, imp, relationship="imports")`,
    telemetry: `# enterprise_gemini_architecture/telemetry.py
def calculate_token_economics(prompt_tokens: int, cached_tokens: int, output_tokens: int):
    """Gemini 2.5 Flash Pricing: $0.075/1M prompt, $0.01875/1M cached (75% off)."""
    uncached = (prompt_tokens + cached_tokens) * (0.075 / 1e6) + (output_tokens * 0.30 / 1e6)
    optimized = (prompt_tokens * 0.075 / 1e6) + (cached_tokens * 0.01875 / 1e6) + (output_tokens * 0.30 / 1e6)
    return {
        "uncached_cost": round(uncached, 6),
        "optimized_cost": round(optimized, 6),
        "savings_usd": round(uncached - optimized, 6),
        "savings_pct": round((uncached - optimized) / uncached * 100, 1)
    }`,
  };

  const githubRepos = [
    {
      name: "langchain-ai/langgraph",
      url: "https://github.com/langchain-ai/langgraph",
      badge: "Stateful Agent Engine",
      description:
        "Cyclic multi-agent graph with durable state checkpoints, conditional branching, and self-healing compiler loops.",
    },
    {
      name: "google-gemini/cookbook",
      url: "https://github.com/google-gemini/cookbook",
      badge: "Google GenAI SDK",
      description:
        "Official Google recipes for AI Studio Context Caching (32k+ token thresholds), structured outputs, and streaming.",
    },
    {
      name: "Arize-ai/phoenix",
      url: "https://github.com/Arize-ai/phoenix",
      badge: "Observability & Tracing",
      description:
        "OpenTelemetry-native tracing for LLMs, tracking Time-To-First-Token (TTFT), token caching hit ratios, and tool latencies.",
    },
    {
      name: "Aider-AI/aider",
      url: "https://github.com/Aider-AI/aider",
      badge: "Autonomous Coding",
      description:
        "Industry-standard git-aware repository mapping using Tree-Sitter ASTs, minimal diff edits, and test-in-the-loop repair.",
    },
    {
      name: "explodinggradients/ragas",
      url: "https://github.com/explodinggradients/ragas",
      badge: "CI/CD Evaluation",
      description:
        "Automated evaluation metrics measuring code generation faithfulness, semantic adherence, and zero-regression verification.",
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className={`w-full max-w-5xl max-h-[92vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden transition-colors ${
          isApple
            ? "bg-white border-[#E5E5EA] text-[#1D1D1F]"
            : "bg-[#090E0B] border-[#22352B] text-[#F3F4F0]"
        }`}
      >
        {/* Top Header */}
        <div
          className={`px-6 py-4 border-b flex items-center justify-between gap-4 ${
            isApple ? "bg-[#F5F5F7] border-[#E5E5EA]" : "bg-[#0E1512] border-[#1F2D26]"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-lg shadow-sm ${
                isApple ? "bg-[#0071E3] text-white" : "bg-[#10B981] text-[#070B09]"
              }`}
            >
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  Enterprise AI Studio Architecture &amp; Developer Console
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-[#0071E3]/15 text-[#0071E3] border border-[#0071E3]/30">
                  Gemini 2.5 Flash · LangGraph
                </span>
              </div>
              <p
                className={`text-xs ${
                  isApple ? "text-[#86868B]" : "text-[#8A9990]"
                }`}
              >
                Production multi-agent execution graphs, native context caching (75% savings), and strict tool use.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isApple
                ? "hover:bg-[#E5E5EA] text-[#86868B]"
                : "hover:bg-[#192620] text-[#8A9990] hover:text-[#F3F4F0]"
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div
          className={`flex items-center px-6 border-b gap-2 overflow-x-auto scrollbar-none text-xs font-medium ${
            isApple ? "border-[#E5E5EA] bg-white" : "border-[#1F2D26] bg-[#090E0B]"
          }`}
        >
          <button
            type="button"
            onClick={() => setActiveTab("graph_simulator")}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "graph_simulator"
                ? isApple
                  ? "border-[#0071E3] text-[#0071E3] font-bold"
                  : "border-[#10B981] text-[#10B981] font-bold"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>Multi-Agent Simulator</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("caching_calculator")}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "caching_calculator"
                ? isApple
                  ? "border-[#0071E3] text-[#0071E3] font-bold"
                  : "border-[#10B981] text-[#10B981] font-bold"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            <DollarSign className="w-4 h-4" />
            <span>Context Caching Economics</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("code_boilerplate")}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "code_boilerplate"
                ? isApple
                  ? "border-[#0071E3] text-[#0071E3] font-bold"
                  : "border-[#10B981] text-[#10B981] font-bold"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>Production Code Boilerplate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("github_repos")}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === "github_repos"
                ? isApple
                  ? "border-[#0071E3] text-[#0071E3] font-bold"
                  : "border-[#10B981] text-[#10B981] font-bold"
                : "border-transparent opacity-60 hover:opacity-100"
            }`}
          >
            <ExternalLink className="w-4 h-4" />
            <span>Curated GitHub Repositories</span>
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: MULTI-AGENT STATE GRAPH SIMULATOR */}
          {activeTab === "graph_simulator" && (
            <div className="space-y-6">
              {/* Agent Node Architecture Flowchart */}
              <div
                className={`p-4 rounded-2xl border ${
                  isApple
                    ? "bg-[#F9F9FB] border-[#E5E5EA]"
                    : "bg-[#0C1410] border-[#1E2E25]"
                }`}
              >
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#10B981] font-bold mb-3 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  <span>Stateful Cyclic Topology (LangGraph + Gemini 2.5 Flash)</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
                  {[
                    { id: "supervisor", title: "1. Supervisor", desc: "Triage & Plan" },
                    { id: "planner", title: "2. Planner", desc: "AST Mutation DAG" },
                    { id: "coder_worker", title: "3. Coder Worker", desc: "Cached GenAI Synthesis" },
                    { id: "sandbox_verifier", title: "4. Sandbox", desc: "Compiler & Lint Test" },
                    { id: "critic", title: "5. Critic / Evaluator", desc: "Self-Healing Loop (3x)" },
                    { id: "synthesizer", title: "6. Synthesizer", desc: "Verified PR Diff" },
                  ].map((node) => (
                    <div
                      key={node.id}
                      className={`p-2.5 rounded-xl border flex flex-col justify-between ${
                        isApple
                          ? "bg-white border-[#E5E5EA]"
                          : "bg-[#111B16] border-[#1F2D26]"
                      }`}
                    >
                      <div className="font-bold text-[11px]">{node.title}</div>
                      <div
                        className={`text-[10px] mt-1 ${
                          isApple ? "text-[#86868B]" : "text-[#8A9990]"
                        }`}
                      >
                        {node.desc}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Simulation Controls */}
              <div
                className={`p-5 rounded-2xl border space-y-4 ${
                  isApple
                    ? "bg-white border-[#E5E5EA]"
                    : "bg-[#0E1512] border-[#1F2D26]"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm">Interactive Agent Run Simulation</h3>
                    <p
                      className={`text-xs ${
                        isApple ? "text-[#86868B]" : "text-[#8A9990]"
                      }`}
                    >
                      Test the self-healing cycle, tool execution, and token caching metrics.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isSimulating}
                    onClick={handleRunAgentSimulation}
                    className="apple-btn-primary !px-4 !py-2 flex items-center gap-2 cursor-pointer"
                  >
                    {isSimulating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                    <span>{isSimulating ? "Running Agent Graph..." : "Execute Agent Graph"}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold block">Developer Instruction / Task Prompt</label>
                  <input
                    type="text"
                    value={taskPrompt}
                    onChange={(e) => setTaskPrompt(e.target.value)}
                    className={`w-full px-3.5 py-2 text-xs rounded-xl border focus:outline-none ${
                      isApple
                        ? "bg-[#F5F5F7] border-[#D2D2D7] text-[#1D1D1F] focus:border-[#0071E3]"
                        : "bg-[#141E19] border-[#22352B] text-[#F3F4F0] focus:border-[#10B981]"
                    }`}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-semibold">Codebase Context Size</span>
                      <span className="font-mono text-[#10B981] font-bold">
                        {codebaseTokens.toLocaleString()} Tokens
                      </span>
                    </div>
                    <input
                      type="range"
                      min={35000}
                      max={250000}
                      step={5000}
                      value={codebaseTokens}
                      onChange={(e) => setCodebaseTokens(Number(e.target.value))}
                      className="w-full accent-[#10B981]"
                    />
                    <span className="text-[10px] opacity-60 block mt-0.5">
                      Meets Context Caching threshold (min 32,768 tokens)
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-4 sm:pt-0">
                    <input
                      type="checkbox"
                      id="sim-error-repair"
                      checked={simulateErrorRepair}
                      onChange={(e) => setSimulateErrorRepair(e.target.checked)}
                      className="w-4 h-4 accent-[#10B981] rounded"
                    />
                    <label htmlFor="sim-error-repair" className="text-xs font-medium cursor-pointer">
                      <span className="block font-semibold">Simulate Compiler Error &amp; Self-Repair Loop</span>
                      <span className="text-[10px] opacity-60">
                        Agent catches TS2304 error and repairs code before PR creation
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Simulation Result Output */}
              {simulationResult && (
                <div
                  className={`p-5 rounded-2xl border space-y-4 animate-in fade-in duration-300 ${
                    isApple
                      ? "bg-white border-[#E5E5EA]"
                      : "bg-[#0E1512] border-[#1F2D26]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-ping" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#10B981]">
                        Execution Status: {simulationResult.status} ({simulationResult.executionTimeMs}ms)
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-[#0071E3] font-bold">
                        {simulationResult.tokenEconomics.cachedTokens.toLocaleString()} Cached Tokens
                      </span>
                      <span>•</span>
                      <span className="text-[#34C759] font-bold">
                        75% Cost Saved (${simulationResult.tokenEconomics.costSavingsUsd})
                      </span>
                    </div>
                  </div>

                  {/* Step Execution Trace */}
                  <div className="space-y-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider opacity-60">
                      Multi-Agent Trace Spans ({simulationResult.steps.length} Steps)
                    </div>
                    <div className="space-y-1.5 font-mono text-xs">
                      {simulationResult.steps.map((st: any, idx: number) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                            st.status === "failed"
                              ? "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
                              : st.status === "rerouted"
                              ? "bg-[#FF9500]/10 border-[#FF9500]/30 text-[#FF9500]"
                              : isApple
                              ? "bg-[#F9F9FB] border-[#E5E5EA] text-[#1D1D1F]"
                              : "bg-[#121B17] border-[#1E2E25] text-[#D5DDD8]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            <span className="font-bold">{st.name}:</span>
                            <span className="text-[11px] opacity-90">{st.action}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] opacity-80 pl-7 sm:pl-0">
                            <span>{st.details}</span>
                            <span className="font-bold underline">({st.durationMs}ms)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: CONTEXT CACHING ECONOMICS CALCULATOR */}
          {activeTab === "caching_calculator" && (
            <div className="space-y-6">
              <div
                className={`p-5 rounded-2xl border ${
                  isApple
                    ? "bg-white border-[#E5E5EA]"
                    : "bg-[#0E1512] border-[#1F2D26]"
                }`}
              >
                <h3 className="font-bold text-sm mb-1">
                  AI Studio Native Context Caching Calculator (Gemini 2.5 Flash)
                </h3>
                <p
                  className={`text-xs mb-5 ${
                    isApple ? "text-[#86868B]" : "text-[#8A9990]"
                  }`}
                >
                  Calculates real dollar savings and Time-To-First-Token (TTFT) acceleration based on official Gemini API pricing.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold">Codebase Prefix Size</span>
                      <span className="font-mono text-[#10B981] font-bold">
                        {calcCodebaseTokens.toLocaleString()} Tokens
                      </span>
                    </div>
                    <input
                      type="range"
                      min={35000}
                      max={400000}
                      step={5000}
                      value={calcCodebaseTokens}
                      onChange={(e) => setCalcCodebaseTokens(Number(e.target.value))}
                      className="w-full accent-[#10B981]"
                    />
                    <span className="text-[10px] opacity-60 block mt-1">
                      Min threshold: 32,768 tokens
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold">Developer Sessions / Day</span>
                      <span className="font-mono text-[#10B981] font-bold">
                        {calcSessionsPerDay} Sessions
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={calcSessionsPerDay}
                      onChange={(e) => setCalcSessionsPerDay(Number(e.target.value))}
                      className="w-full accent-[#10B981]"
                    />
                    <span className="text-[10px] opacity-60 block mt-1">
                      Across engineering team
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-semibold">Turns per Session</span>
                      <span className="font-mono text-[#10B981] font-bold">
                        {calcTurnsPerSession} Turns
                      </span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={25}
                      step={1}
                      value={calcTurnsPerSession}
                      onChange={(e) => setCalcTurnsPerSession(Number(e.target.value))}
                      className="w-full accent-[#10B981]"
                    />
                    <span className="text-[10px] opacity-60 block mt-1">
                      Average multi-step task loops
                    </span>
                  </div>
                </div>

                {/* Economics Metric Cards */}
                {economicsData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-dashed">
                    <div
                      className={`p-4 rounded-xl border ${
                        isApple
                          ? "bg-[#F9F9FB] border-[#E5E5EA]"
                          : "bg-[#111A15] border-[#1F2D26]"
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase opacity-60">Standard Uncached Cost</div>
                      <div className="text-xl font-bold font-mono text-[#EF4444] mt-1">
                        ${economicsData.uncachedMonthlyCostUsd} / mo
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">Re-sending full repo context</div>
                    </div>

                    <div
                      className={`p-4 rounded-xl border ${
                        isApple
                          ? "bg-[#F9F9FB] border-[#E5E5EA]"
                          : "bg-[#111A15] border-[#1F2D26]"
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase opacity-60">Optimized Cached Cost</div>
                      <div className="text-xl font-bold font-mono text-[#34C759] mt-1">
                        ${economicsData.cachedMonthlyCostUsd} / mo
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">75% discount on cached prefix</div>
                    </div>

                    <div
                      className={`p-4 rounded-xl border ${
                        isApple
                          ? "bg-[#EBF5FF] border-[#0071E3]/30"
                          : "bg-[#10B981]/15 border-[#10B981]/40"
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase font-bold text-[#10B981]">
                        Net Monthly Savings
                      </div>
                      <div className="text-xl font-extrabold font-mono text-[#10B981] mt-1">
                        ${economicsData.monthlySavingsUsd} ({economicsData.savingsPct}%)
                      </div>
                      <div className="text-[10px] opacity-80 mt-0.5">Direct API bill reduction</div>
                    </div>

                    <div
                      className={`p-4 rounded-xl border ${
                        isApple
                          ? "bg-[#F9F9FB] border-[#E5E5EA]"
                          : "bg-[#111A15] border-[#1F2D26]"
                      }`}
                    >
                      <div className="text-[10px] font-mono uppercase opacity-60">TTFT Acceleration</div>
                      <div className="text-xl font-bold font-mono text-[#0071E3] mt-1">
                        {economicsData.ttftImprovementMs.cachedAverageMs}ms ({economicsData.ttftImprovementMs.speedupFactor})
                      </div>
                      <div className="text-[10px] opacity-60 mt-0.5">Down from 3,850ms uncached</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCTION CODE BOILERPLATE */}
          {activeTab === "code_boilerplate" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {(
                    [
                      { key: "context_cache", label: "context_cache.py" },
                      { key: "agent_graph", label: "agent_graph.py" },
                      { key: "tool_registry", label: "tool_registry.py" },
                      { key: "hybrid_rag", label: "hybrid_rag.py" },
                      { key: "telemetry", label: "telemetry.py" },
                    ] as const
                  ).map((file) => (
                    <button
                      key={file.key}
                      type="button"
                      onClick={() => setSelectedCodeFile(file.key)}
                      className={`px-3 py-1.5 rounded-xl font-mono text-xs transition-colors cursor-pointer border ${
                        selectedCodeFile === file.key
                          ? isApple
                            ? "bg-[#0071E3] text-white border-[#0071E3]"
                            : "bg-[#10B981] text-[#070B09] font-bold border-[#10B981]"
                          : isApple
                          ? "bg-[#F5F5F7] border-[#E5E5EA] text-[#1D1D1F]"
                          : "bg-[#121A16] border-[#1F2D26] text-[#8A9990]"
                      }`}
                    >
                      {file.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleCopyCode(
                      codeSnippets[selectedCodeFile],
                      selectedCodeFile
                    )
                  }
                  className="apple-btn-secondary !py-1 !px-3 text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCodeKey === selectedCodeFile ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#34C759]" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedCodeKey === selectedCodeFile ? "Copied!" : "Copy Code"}</span>
                </button>
              </div>

              <div className="rounded-2xl border overflow-hidden bg-[#0A0F0D] border-[#1E2E25]">
                <pre className="p-4 text-xs font-mono text-[#D5DDD8] overflow-x-auto leading-relaxed">
                  <code>{codeSnippets[selectedCodeFile]}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: CURATED GITHUB REPOSITORIES */}
          {activeTab === "github_repos" && (
            <div className="space-y-4">
              <div className="text-xs opacity-75">
                Clonable boilerplate and reference architectures matching this exact Gemini 2.5 Flash + LangGraph blueprint:
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {githubRepos.map((repo) => (
                  <a
                    key={repo.name}
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] block ${
                      isApple
                        ? "bg-white border-[#E5E5EA] hover:border-[#0071E3]"
                        : "bg-[#0E1512] border-[#1F2D26] hover:border-[#10B981]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono font-bold text-sm text-[#0071E3] flex items-center gap-1.5">
                        <Code2 className="w-4 h-4" />
                        <span>{repo.name}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                        {repo.badge}
                      </span>
                    </div>
                    <p
                      className={`text-xs mt-2 leading-relaxed ${
                        isApple ? "text-[#86868B]" : "text-[#8A9990]"
                      }`}
                    >
                      {repo.description}
                    </p>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
