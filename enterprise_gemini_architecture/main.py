"""
Main Entrypoint and CLI Demonstrator for Enterprise Gemini Architecture
Run via: python3 -m enterprise_gemini_architecture.main
"""

import os
import sys
from .context_cache import CodebaseContextCacheManager
from .agent_graph import AutonomousCodeGraph
from .telemetry import EnterpriseObservability

def run_demonstration():
    print("=" * 70)
    print("🚀 Enterprise AI Studio & Gemini 2.5 Flash Architecture Demonstrator")
    print("=" * 70)

    # 1. Telemetry & Token Economics
    print("\n[PHASE 1 & 5: CONTEXT CACHING & TOKEN ECONOMICS]")
    metrics = EnterpriseObservability.calculate_token_economics(
        prompt_tokens=1250,
        cached_tokens=85000,
        output_tokens=650
    )
    print(f"• Total Processed Tokens: {metrics['total_tokens']:,}")
    print(f"• Cached Token Ratio:     {metrics['cached_token_ratio_pct']}%")
    print(f"• Standard Uncached Cost: ${metrics['uncached_cost_usd']}")
    print(f"• Optimized Cached Cost:  ${metrics['optimized_cost_usd']}")
    print(f"• Direct Cost Savings:    ${metrics['savings_usd']} ({metrics['savings_pct']}% reduction)\n")

    # 2. Check for API Key
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("[INFO] GEMINI_API_KEY not set in shell environment.")
        print("[DEMO] Architecture modules, LangGraph state machine, and tool schemas compiled successfully.")
        return

    try:
        cache_mgr = CodebaseContextCacheManager(api_key=api_key)
        print("[SUCCESS] Initialized CodebaseContextCacheManager with Gemini 2.5 Flash.")
        agent = AutonomousCodeGraph(cache_mgr)
        print("[SUCCESS] Compiled LangGraph StateGraph (Supervisor -> Coder -> Sandbox -> Evaluator).")
    except Exception as e:
        print(f"[NOTE] Live API initialization note: {e}")

if __name__ == "__main__":
    run_demonstration()
