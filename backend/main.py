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


def build_deterministic_plan(algorithm_name: str, data_structure: List[int]) -> Dict[str, Any]:
    def make_step(action: str, logic: str, arr: List[int], compare_indices=None, swap_indices=None, pivot_indices=None):
        return {
            "action": action,
            "logic": logic,
            "result": list(arr),
            "compare_indices": compare_indices or [],
            "swap_indices": swap_indices or [],
            "pivot_indices": pivot_indices or [],
        }

    intro = make_step(
        "INTRODUCTION",
        f"{algorithm_name} compares values and moves them according to its rule set so the array becomes sorted.",
        list(data_structure),
        [],
        [],
        [],
    )

    steps: List[Dict[str, Any]] = []
    name = algorithm_name.lower()

    if name == "bubble sort":
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
                        make_step(
                            "COMPARE_AND_SWAP",
                            f"Compared indices {j} and {j + 1} and swapped them.",
                            arr,
                            compare_indices,
                            compare_indices,
                            [],
                        )
                    )
                else:
                    steps.append(
                        make_step(
                            "COMPARE",
                            f"Compared indices {j} and {j + 1} and kept their order.",
                            arr,
                            compare_indices,
                            [],
                            [],
                        )
                    )
            if not swapped:
                steps.append(make_step("DONE", "The array is already sorted.", arr, [], [], []))
                break
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], []))

    elif name == "selection sort":
        arr = list(data_structure)
        n = len(arr)
        for i in range(n):
            min_idx = i
            for j in range(i + 1, n):
                compare_indices = [i, j]
                steps.append(
                    make_step(
                        "COMPARE",
                        f"Compared the current minimum at index {i} with index {j}.",
                        arr,
                        compare_indices,
                        [],
                        [],
                    )
                )
                if arr[j] < arr[min_idx]:
                    min_idx = j
            if min_idx != i:
                arr[i], arr[min_idx] = arr[min_idx], arr[i]
                steps.append(
                    make_step(
                        "COMPARE_AND_SWAP",
                        f"Swapped the minimum value into position {i}.",
                        arr,
                        [i, min_idx],
                        [i, min_idx],
                        [],
                    )
                )
            else:
                steps.append(make_step("COMPARE", f"No swap was needed for position {i}.", arr, [i, min_idx], [], []))
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], []))

    elif name == "insertion sort":
        arr = list(data_structure)
        n = len(arr)
        for i in range(1, n):
            j = i
            while j > 0 and arr[j - 1] > arr[j]:
                compare_indices = [j - 1, j]
                arr[j - 1], arr[j] = arr[j], arr[j - 1]
                steps.append(
                    make_step(
                        "COMPARE_AND_SWAP",
                        f"Moved the value at index {j} left into position {j - 1}.",
                        arr,
                        compare_indices,
                        compare_indices,
                        [],
                    )
                )
                j -= 1
            if j == i:
                steps.append(make_step("COMPARE", f"No swap was needed for index {i}.", arr, [i - 1, i], [], []))
            else:
                steps.append(make_step("COMPARE", f"Inserted the value into the correct position.", arr, [j, j + 1], [], []))
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], []))

    elif name == "quick sort":
        arr = list(data_structure)

        def partition(low: int, high: int) -> int:
            pivot = arr[high]
            i = low - 1
            steps.append(make_step("PIVOT", f"Using index {high} as the pivot with value {pivot}.", arr, [high], [], [high]))
            for j in range(low, high):
                compare_indices = [j, high]
                if arr[j] <= pivot:
                    i += 1
                    if i != j:
                        arr[i], arr[j] = arr[j], arr[i]
                        steps.append(
                            make_step(
                                "COMPARE_AND_SWAP",
                                f"Swapped indices {i} and {j} around the pivot.",
                                arr,
                                compare_indices,
                                [i, j],
                                [high],
                            )
                        )
                    else:
                        steps.append(
                            make_step(
                                "COMPARE",
                                f"Kept index {j} in place while partitioning.",
                                arr,
                                compare_indices,
                                [],
                                [high],
                            )
                        )
                else:
                    steps.append(
                        make_step(
                            "COMPARE",
                            f"The value at index {j} stayed on the right side of the pivot.",
                            arr,
                            compare_indices,
                            [],
                            [high],
                        )
                    )
            arr[i + 1], arr[high] = arr[high], arr[i + 1]
            steps.append(
                make_step(
                    "COMPARE_AND_SWAP",
                    f"Placed the pivot value into its final position.",
                    arr,
                    [i + 1, high],
                    [i + 1, high],
                    [high],
                )
            )
            return i + 1

        def quicksort(low: int, high: int):
            if low < high:
                pivot_index = partition(low, high)
                quicksort(low, pivot_index - 1)
                quicksort(pivot_index + 1, high)

        quicksort(0, len(arr) - 1)
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], []))

    else:
        steps.append(make_step("STEP", f"{algorithm_name} is being shown step by step.", list(data_structure), [], [], []))

    return {"intro": intro, "steps": steps}


@app.post("/api/v1/narrate")
async def generate_narration(state: AlgorithmState):
    api_key = os.getenv("WATSONX_APIKEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="API Key missing!")

    supported_algorithms = {"bubble sort", "selection sort", "insertion sort", "quick sort"}
    if state.algorithm_name.lower() in supported_algorithms:
        return build_deterministic_plan(state.algorithm_name, state.data_structure)

    try:
        access_token = get_iam_token(api_key)

        BASE_URL = "https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/d781388e-1567-4604-b277-a72a9f74fc4e"
        AGENT_ID = "4defadc3-2aa7-4c81-ae06-eb8d799f3308"

        ENDPOINT = BASE_URL + "/v1/orchestrate/" + AGENT_ID + "/chat/completions"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}

        user_prompt = (
            f"Create a complete walkthrough for {state.algorithm_name} using this starting array {state.data_structure}. "
            "Return ONLY JSON with keys 'intro' and 'steps'. "
            "The 'intro' object should have action, logic, result, compare_indices, swap_indices, and pivot_indices. "
            "The 'steps' array should contain several step objects, each with action, logic, result, compare_indices, swap_indices, and pivot_indices. "
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
                "pivot_indices": [],
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
        return build_deterministic_plan(state.algorithm_name, state.data_structure)