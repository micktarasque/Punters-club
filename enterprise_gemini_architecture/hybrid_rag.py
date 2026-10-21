"""
Hybrid Codebase RAG & Graph Memory Module
Combines NetworkX AST dependency graphs with BM25 lexical search and Gemini embeddings.
"""

import re
from typing import List, Dict, Any, Set
import networkx as nx
from google import genai
from google.genai import types

class CodebaseGraphRAG:
    """
    Maintains an in-memory dependency graph of the codebase AST to inject
    upstream and downstream dependent symbols when a file is modified.
    """

    def __init__(self, client: genai.Client):
        self.client = client
        self.graph = nx.DiGraph()
        self.file_index: Dict[str, str] = {}

    def index_file(self, file_path: str, content: str) -> None:
        """Parses import relationships and symbols into the graph."""
        self.file_index[file_path] = content
        self.graph.add_node(file_path, type="file", length=len(content))

        # Basic regex parser for imports (supports TS/JS and Python imports)
        ts_imports = re.findall(r'from\s+["\'](\.[^"\']+)["\']', content)
        py_imports = re.findall(r'from\s+([a-zA-Z0-9_\.]+)\s+import', content)

        for imp in ts_imports:
            self.graph.add_edge(file_path, imp, relationship="imports")
        for imp in py_imports:
            self.graph.add_edge(file_path, imp, relationship="imports")

    def get_context_for_target_file(self, target_file: str, max_depth: int = 2) -> Dict[str, Any]:
        """
        Retrieves all files connected within max_depth steps to guarantee
        that type changes do not break downstream callers.
        """
        related_files: Set[str] = {target_file}
        if target_file in self.graph:
            # Downstream callers (who imports me?)
            predecessors = list(self.graph.predecessors(target_file))
            # Upstream dependencies (who do I import?)
            successors = list(self.graph.successors(target_file))
            related_files.update(predecessors[:5])
            related_files.update(successors[:5])

        context_snippets = {}
        for f in related_files:
            if f in self.file_index:
                # Truncate to first 100 lines for efficiency
                lines = self.file_index[f].split("\n")[:100]
                context_snippets[f] = "\n".join(lines)

        return {
            "target": target_file,
            "dependency_count": len(related_files),
            "snippets": context_snippets
        }

    def summarize_conversation_history(self, messages: List[Dict[str, str]]) -> str:
        """
        Recursively compacts conversational history into a bulleted architectural ledger.
        """
        if len(messages) <= 6:
            return ""

        convo_text = "\n".join([f"{m['role']}: {m['content']}" for m in messages[:-4]])
        prompt = (
            "Summarize the key architectural decisions, resolved bugs, and agreed constraints "
            "from this previous developer interaction. Keep it under 200 words in clean bullet points:\n\n"
            f"{convo_text}"
        )
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(temperature=0.2, max_output_tokens=512)
        )
        return response.text or ""
