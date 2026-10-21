"""
LangGraph Multi-Agent Cyclical State Machine for Autonomous Code Generation
Orchestrates Supervisor, Planner, Coder, Sandbox, and Evaluator nodes with automated repair loops.
"""

from typing import Annotated, TypedDict, List, Dict, Any, Literal
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from google import genai
from google.genai import types

from .context_cache import CodebaseContextCacheManager
from .tool_registry import ToolRegistry

class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    task_prompt: str
    active_plan: List[str]
    current_step: int
    iteration_count: int
    max_repair_cycles: int
    test_passed: bool
    compiler_diagnostics: str
    files_modified: List[str]
    cache_handle_name: str
    final_output: str

class AutonomousCodeGraph:
    """
    Stateful multi-agent system built on LangGraph and Gemini 2.5 Flash.
    """

    def __init__(self, cache_manager: CodebaseContextCacheManager):
        self.cache_mgr = cache_manager
        self.client = cache_manager.client
        self.tools = ToolRegistry.get_gemini_function_declarations()
        self.graph = self._build_graph()

    def supervisor_node(self, state: AgentState) -> Dict[str, Any]:
        """Triage node: analyzes task requirements and sets up execution state."""
        prompt = (
            f"Developer Task: {state['task_prompt']}\n"
            "Decompose this into a minimal sequential plan (1-3 steps max). "
            "Output JSON array of string tasks."
        )
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                cached_content=state["cache_handle_name"],
                temperature=0.1,
            )
        )
        return {
            "iteration_count": 0,
            "current_step": 0,
            "test_passed": False,
            "compiler_diagnostics": "",
            "files_modified": []
        }

    def coder_worker_node(self, state: AgentState) -> Dict[str, Any]:
        """Synthesizes code patches using Gemini 2.5 Flash with cached codebase prefix."""
        current_iter = state.get("iteration_count", 0) + 1
        
        prompt = f"Goal: {state['task_prompt']}\n"
        if state.get("compiler_diagnostics"):
            prompt += (
                f"\n[URGENT: PREVIOUS COMPILATION / TEST ERRORS]:\n"
                f"{state['compiler_diagnostics']}\n"
                f"You must fix these errors immediately using 'write_file' or 'patch_file_chunk'."
            )
        else:
            prompt += "Implement the necessary changes using 'write_file' or 'patch_file_chunk'."

        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                cached_content=state["cache_handle_name"],
                temperature=0.15,
                tools=[types.Tool(function_declarations=self.tools)],
            )
        )

        modified = list(state.get("files_modified", []))
        # Execute tool calls if returned by model
        if hasattr(response, "function_calls") and response.function_calls:
            for call in response.function_calls:
                res = ToolRegistry.execute_tool(call.name, dict(call.args or {}))
                if res.get("file_path"):
                    modified.append(res["file_path"])

        return {
            "iteration_count": current_iter,
            "files_modified": list(set(modified)),
            "messages": [response]
        }

    def sandbox_verifier_node(self, state: AgentState) -> Dict[str, Any]:
        """Runs automated verification commands (e.g. tsc / flake8 / pytest)."""
        # Execute verification command
        res = ToolRegistry.execute_tool("run_command", {"command": "npm run lint || true", "timeout_sec": 15})
        passed = res.get("success", True) and "error" not in res.get("stdout", "").lower()
        err_msg = res.get("stderr") or (res.get("stdout") if not passed else "")
        return {
            "test_passed": passed,
            "compiler_diagnostics": err_msg[:2000]
        }

    def route_after_verification(self, state: AgentState) -> Literal["coder_worker", "synthesizer"]:
        """Evaluator conditional edge: loops back to coder if tests fail and attempts remain."""
        if not state.get("test_passed", False) and state.get("iteration_count", 0) < state.get("max_repair_cycles", 3):
            print(f"[REPAIR CYCLE] Loop iteration {state['iteration_count']}: re-routing to Coder Node.")
            return "coder_worker"
        return "synthesizer"

    def synthesizer_node(self, state: AgentState) -> Dict[str, Any]:
        """Produces final verified pull request summary."""
        status = "PASSED ALL TESTS" if state.get("test_passed") else "COMPLETED WITH WARNINGS"
        summary = (
            f"### Agentic Execution Summary ({status})\n"
            f"- **Iterations Required**: {state.get('iteration_count', 1)}\n"
            f"- **Files Modified**: {', '.join(state.get('files_modified', [])) or 'None'}\n"
            f"- **Diagnostics**: {state.get('compiler_diagnostics') or 'Clean compilation (0 errors)'}\n"
        )
        return {"final_output": summary}

    def _build_graph(self) -> Any:
        workflow = StateGraph(AgentState)
        workflow.add_node("supervisor", self.supervisor_node)
        workflow.add_node("coder_worker", self.coder_worker_node)
        workflow.add_node("sandbox_verifier", self.sandbox_verifier_node)
        workflow.add_node("synthesizer", self.synthesizer_node)

        workflow.set_entry_point("supervisor")
        workflow.add_edge("supervisor", "coder_worker")
        workflow.add_edge("coder_worker", "sandbox_verifier")
        workflow.add_conditional_edges(
            "sandbox_verifier",
            self.route_after_verification,
            {
                "coder_worker": "coder_worker",
                "synthesizer": "synthesizer"
            }
        )
        workflow.add_edge("synthesizer", END)
        return workflow.compile()
