from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import requests
import os
import json
import time
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AlgoVisualizer AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

TOKEN_CACHE = {"token": None, "expires_at": 0}
REQUEST_SESSION = requests.Session()


class AlgorithmState(BaseModel):
    algorithm_name: str
    current_step: int
    phase: str
    data_structure: List[int]
    highlighted_indices: List[int]


def get_iam_token(api_key: str) -> str:
    now = time.time()
    if TOKEN_CACHE["token"] and now < TOKEN_CACHE["expires_at"] - 60:
        return TOKEN_CACHE["token"]

    url = "https://iam.cloud.ibm.com/identity/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": api_key,
    }

    response = REQUEST_SESSION.post(url, headers=headers, data=data, timeout=(5, 20))
    if not response.ok:
        raise Exception(f"Failed to generate IAM token. Status: {response.status_code}, Response: {response.text}")

    token = response.json()["access_token"]
    TOKEN_CACHE["token"] = token
    TOKEN_CACHE["expires_at"] = now + 3600
    return token


def parse_json_block(text: str) -> Dict[str, Any]:
    if "```json" in text:
        text = text.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in text:
        text = text.split("```", 1)[1].split("```", 1)[0].strip()
    return json.loads(text)


def normalize_step_value(value: Any) -> Any:
    if isinstance(value, list):
        result = []
        for item in value:
            if isinstance(item, (int, float)) and not isinstance(item, bool):
                result.append(int(item))
            elif isinstance(item, str):
                cleaned = item.strip()
                if cleaned.lstrip("-").isdigit():
                    result.append(int(cleaned))
                else:
                    try:
                        result.append(int(float(cleaned)))
                    except ValueError:
                        result.append(cleaned)
            else:
                result.append(item)
        return result
    if isinstance(value, str):
        cleaned = value.strip()
        if cleaned.lstrip("-").isdigit():
            return int(cleaned)
        try:
            return int(float(cleaned))
        except ValueError:
            return value
    return value


def normalize_step(step: Dict[str, Any], fallback: List[int]) -> Dict[str, Any]:
    return {
        "action": step.get("action", "STEP"),
        "logic": step.get("logic", "Next step."),
        "result": normalize_step_value(step.get("result") or step.get("current_state") or fallback),
        "compare_indices": normalize_step_value(step.get("compare_indices") or []),
        "swap_indices": normalize_step_value(step.get("swap_indices") or []),
    }


def build_fallback_plan(algorithm_name: str, data_structure: List[int]) -> Dict[str, Any]:
    intro = {
        "action": "INTRODUCTION",
        "logic": f"{algorithm_name} repeatedly compares values and swaps them when needed.",
        "result": list(data_structure),
        "compare_indices": [],
        "swap_indices": [],
    }

    steps = [intro]
    if algorithm_name.lower() == "bubble sort":
        arr = list(data_structure)
        n = len(arr)
        for i in range(n):
            swapped = False
            for j in range(0, n - i - 1):
                compare_indices = [j, j + 1]
                if arr[j] > arr[j + 1]:
                    arr[j], arr[j + 1] = arr[j + 1], arr[j]
                    swapped = True
                    steps.append(
                        {
                            "action": "COMPARE_AND_SWAP",
                            "logic": f"Compared {arr[j + 1]} and {arr[j]} and swapped them.",
                            "result": list(arr),
                            "compare_indices": compare_indices,
                            "swap_indices": compare_indices,
                        }
                    )
                else:
                    steps.append(
                        {
                            "action": "COMPARE",
                            "logic": f"Compared {arr[j]} and {arr[j + 1]} and kept their order.",
                            "result": list(arr),
                            "compare_indices": compare_indices,
                            "swap_indices": [],
                        }
                    )
            if not swapped:
                steps.append(
                    {
                        "action": "DONE",
                        "logic": "The array is already sorted.",
                        "result": list(arr),
                        "compare_indices": [],
                        "swap_indices": [],
                    }
                )
                break
        steps.append(
            {
                "action": "SORTED",
                "logic": "The array has been sorted.",
                "result": list(arr),
                "compare_indices": [],
                "swap_indices": [],
            }
        )
    else:
        steps.append(
            {
                "action": "STEP",
                "logic": f"{algorithm_name} is being shown step by step.",
                "result": list(data_structure),
                "compare_indices": [],
                "swap_indices": [],
            }
        )

    return {"intro": intro, "steps": steps}


@app.post("/api/v1/narrate")
async def generate_narration(state: AlgorithmState):
    api_key = os.getenv("WATSONX_APIKEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key missing!")

    try:
        access_token = get_iam_token(api_key)

        BASE_URL = "https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/d781388e-1567-4604-b277-a72a9f74fc4e"
        AGENT_ID = "4defadc3-2aa7-4c81-ae06-eb8d799f3308"

        ENDPOINT = BASE_URL + "/v1/orchestrate/" + AGENT_ID + "/chat/completions"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        user_prompt = (
            f"Create a complete walkthrough for {state.algorithm_name} using this starting array {state.data_structure}. "
            "Return ONLY JSON with keys 'intro' and 'steps'. "
            "The 'intro' object should have action, logic, result, compare_indices, and swap_indices. "
            "The 'steps' array should contain several step objects, each with action, logic, result, compare_indices, and swap_indices. "
            "Make sure the walkthrough includes both comparison and swap moments so the UI can highlight them. "
            "Do not include markdown."
        )

        payload = {"messages": [{"role": "user", "content": user_prompt}], "stream": False}
        agent_response = REQUEST_SESSION.post(ENDPOINT, json=payload, headers=headers, timeout=(10, 30))

        if not agent_response.ok:
            raise HTTPException(status_code=500, detail=agent_response.text)

        agent_data = agent_response.json()
        agent_reply = agent_data.get("choices", [{}])[0].get("message", {}).get("content", "")

        step_data = parse_json_block(agent_reply)
        intro = normalize_step(
            step_data.get("intro") or {
                "action": "INTRODUCTION",
                "logic": f"{state.algorithm_name} is about to be visualized.",
                "result": list(state.data_structure),
                "compare_indices": [],
                "swap_indices": [],
            },
            list(state.data_structure),
        )
        steps = step_data.get("steps") or []
        if not steps:
            steps = [intro]

        normalized_steps = [intro]
        for step in steps:
            normalized_steps.append(normalize_step(step, list(state.data_structure)))

        return {
            "intro": intro,
            "steps": normalized_steps,
        }

    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        return build_fallback_plan(state.algorithm_name, state.data_structure)