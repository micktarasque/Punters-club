"""
Typed Tool Registry and Strict Function Calling Schemas for Gemini 2.5 Flash
Built with Pydantic v2 and OpenAPI / JSON Schema validation.
"""

from typing import List, Optional, Dict, Any, Callable
from pydantic import BaseModel, Field
import subprocess
import time
from google.genai import types

class WriteFileInput(BaseModel):
    file_path: str = Field(
        ...,
        description="Target file path relative to project root. Must not traverse outside sandbox (no '../')."
    )
    content: str = Field(
        ...,
        description="The complete file content to write. Must be syntactically valid and non-empty."
    )
    rationale: str = Field(
        ...,
        description="Architectural rationale explaining why this file is being created or modified."
    )

class PatchFileChunkInput(BaseModel):
    file_path: str = Field(
        ...,
        description="Path of existing file to patch."
    )
    start_line: int = Field(
        ...,
        description="1-indexed starting line number of the block to replace."
    )
    end_line: int = Field(
        ...,
        description="1-indexed ending line number of the block to replace."
    )
    target_content: str = Field(
        ...,
        description="Exact character sequence to be replaced, including indentation."
    )
    replacement_content: str = Field(
        ...,
        description="New replacement code chunk."
    )

class RunCommandInput(BaseModel):
    command: str = Field(
        ...,
        description="Non-interactive shell command to execute for linting, compiling, or tests (e.g. 'tsc --noEmit', 'pytest')."
    )
    timeout_sec: int = Field(
        default=15,
        description="Maximum execution timeout in seconds. Defaults to 15s to prevent agent deadlocks."
    )

class ToolRegistry:
    """
    Central registry for Gemini Function Calling definitions and execution dispatch.
    """

    @staticmethod
    def get_gemini_function_declarations() -> List[types.FunctionDeclaration]:
        """Returns typed FunctionDeclarations compatible with Google GenAI SDK."""
        return [
            types.FunctionDeclaration(
                name="write_file",
                description="Creates a new file or completely overwrites an existing file in the project workspace.",
                parameters=WriteFileInput.model_json_schema()
            ),
            types.FunctionDeclaration(
                name="patch_file_chunk",
                description="Replaces a specific contiguous block of lines in an existing file.",
                parameters=PatchFileChunkInput.model_json_schema()
            ),
            types.FunctionDeclaration(
                name="run_command",
                description="Runs a sandboxed non-interactive build, lint, or test command.",
                parameters=RunCommandInput.model_json_schema()
            )
        ]

    @staticmethod
    def execute_tool(name: str, args: Dict[str, Any], workspace_root: str = ".") -> Dict[str, Any]:
        """
        Executes named tool with safety guardrails and returns structured dictionary for FunctionResponse.
        """
        try:
            if name == "write_file":
                validated = WriteFileInput(**args)
                clean_path = validated.file_path.lstrip("/").replace("..", "")
                full_path = f"{workspace_root}/{clean_path}"
                import os
                os.makedirs(os.path.dirname(full_path), exist_ok=True)
                with open(full_path, "w", encoding="utf-8") as f:
                    f.write(validated.content)
                return {
                    "success": True,
                    "file_path": clean_path,
                    "bytes_written": len(validated.content),
                    "message": f"Successfully wrote {clean_path} ({validated.rationale})"
                }

            elif name == "run_command":
                validated = RunCommandInput(**args)
                # Disallow interactive commands
                forbidden = ["nano", "vim", "top", "htop", "less", "more"]
                if any(cmd in validated.command for cmd in forbidden):
                    return {"success": False, "error": "Interactive commands are prohibited."}

                t0 = time.time()
                proc = subprocess.run(
                    validated.command,
                    shell=True,
                    cwd=workspace_root,
                    capture_output=True,
                    text=True,
                    timeout=validated.timeout_sec
                )
                duration = round(time.time() - t0, 3)
                return {
                    "success": proc.returncode == 0,
                    "returncode": proc.returncode,
                    "stdout": proc.stdout[:4000],
                    "stderr": proc.stderr[:4000],
                    "duration_sec": duration
                }

            return {"success": False, "error": f"Unknown tool name: {name}"}

        except subprocess.TimeoutExpired:
            return {"success": False, "error": f"Command timed out after {args.get('timeout_sec', 15)} seconds."}
        except Exception as e:
            return {"success": False, "error": f"Execution error: {str(e)}"}
