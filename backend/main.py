from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import requests
import os
import json
import time
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend/ directory regardless of where uvicorn is launched from
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env")

app = FastAPI(title="AlgoVisualizer AI Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
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


class ChatRequest(BaseModel):
    message: str
    # Optional visualizer context — sent silently by the frontend
    algorithm: str | None = None
    current_step: int | None = None
    step_count: int | None = None
    data_array: List[int] | None = None
    compare_indices: List[int] | None = None
    swap_indices: List[int] | None = None
    pivot_indices: List[int] | None = None
    current_narration: str | None = None


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
        "pivot_indices": normalize_step_value(step.get("pivot_indices") or []),
        "partition_tree": step.get("partition_tree"),
    }


def build_fallback_chat_reply(message: str) -> str:
    lowered = message.lower()
    if "merge" in lowered:
        return (
            f"Here is a clear explanation of your question about merge sort:\n\n"
            "1. Split the list into smaller parts until each part is one element.\n"
            "2. Merge the parts back together in sorted order.\n"
            "3. Repeat until the full list is sorted.\n\n"
            "Visual idea:\n"
            "[8, 3, 2, 1] -> [8, 3] [2, 1] -> [3, 8] [1, 2] -> [1, 2, 3, 8]"
        )
    if "heap" in lowered:
        return (
            "Heap sort works by building a heap structure and repeatedly removing the largest value.\n\n"
            "Visual idea:\n"
            "Max heap: [10, 7, 5, 3, 1] -> swap root with last -> [1, 7, 5, 3, 10]"
        )
    if "cycle" in lowered:
        return (
            "Cycle sort places each value into its correct position by forming cycles of values.\n\n"
            "Visual idea:\n"
            "[4, 3, 2, 1] -> place 1 -> [1, 3, 2, 4] -> place 2 -> [1, 2, 3, 4]"
        )
    return (
        f"Here is a concise explanation of '{message}':\n\n"
        "- Break the problem into smaller parts.\n"
        "- Study each part carefully.\n"
        "- Combine the parts into a complete solution.\n\n"
        "Visual idea:\n"
        "Input -> Analyze -> Solve -> Verify"
    )


def build_deterministic_plan(algorithm_name: str, data_structure: List[int]) -> Dict[str, Any]:
    def make_step(action: str, logic: str, arr: List[int], compare_indices=None, swap_indices=None, pivot_indices=None, partition_tree=None):
        return {
            "action": action,
            "logic": logic,
            "result": list(arr),
            "compare_indices": compare_indices or [],
            "swap_indices": swap_indices or [],
            "pivot_indices": pivot_indices or [],
            "partition_tree": partition_tree,
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

    elif name == "merge sort":
        arr = list(data_structure)

        def build_tree(low: int, high: int, operation: str = "Split", message: str | None = None):
            if low > high:
                return None
            if low == high:
                return {
                    "label": f"[{low},{high}]",
                    "values": [arr[low]],
                    "operation": operation,
                    "message": message or f"{operation} the single element at index {low}.",
                    "children": []
                }
            mid = (low + high) // 2
            return {
                "label": f"[{low},{high}]",
                "values": arr[low:high + 1],
                "operation": operation,
                "message": message or f"{operation} the range [{low},{high}] into left and right halves.",
                "children": [build_tree(low, mid, operation, None), build_tree(mid + 1, high, operation, None)]
            }

        def merge_sort(low: int, high: int):
            if low >= high:
                return

            mid = (low + high) // 2
            split_tree = build_tree(low, high, "Split", f"Split the range [{low},{high}] into left and right halves.")
            steps.append(make_step("SPLIT", f"Split the range [{low},{high}] into left and right halves.", arr, [], [], [], split_tree))
            merge_sort(low, mid)
            merge_sort(mid + 1, high)

            left = arr[low:mid + 1]
            right = arr[mid + 1:high + 1]
            merged = []
            i = j = 0
            compare_indices = []

            while i < len(left) and j < len(right):
                compare_indices = [low + i, mid + 1 + j]
                if left[i] <= right[j]:
                    merged.append(left[i])
                    i += 1
                else:
                    merged.append(right[j])
                    j += 1

            merged.extend(left[i:])
            merged.extend(right[j:])
            arr[low:high + 1] = merged

            compare_indices = [low, high]
            merge_tree = build_tree(low, high, "Merge", f"Merge the two sorted halves of [{low},{high}] by comparing them from left to right.")
            steps.append(make_step("MERGE", f"Merged the two halves for the range [{low},{high}].", arr, compare_indices, compare_indices, [], merge_tree))

        merge_sort(0, len(arr) - 1)
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], [], None))

    elif name == "heap sort":
        arr = list(data_structure)
        n = len(arr)

        def heapify(size: int, root: int):
            largest = root
            left = 2 * root + 1
            right = 2 * root + 2
            if left < size:
                steps.append(make_step("COMPARE", f"Compared index {root} with its left child at index {left}.", arr, [root, left], [], []))
                if arr[left] > arr[largest]:
                    largest = left
            if right < size:
                steps.append(make_step("COMPARE", f"Compared index {largest} with its right child at index {right}.", arr, [largest, right], [], []))
                if arr[right] > arr[largest]:
                    largest = right
            if largest != root:
                arr[root], arr[largest] = arr[largest], arr[root]
                steps.append(make_step("COMPARE_AND_SWAP", f"Swapped the largest value into position {root}.", arr, [root, largest], [root, largest], []))
                heapify(size, largest)

        for i in range(n // 2 - 1, -1, -1):
            heapify(n, i)

        for end in range(n - 1, 0, -1):
            arr[0], arr[end] = arr[end], arr[0]
            steps.append(make_step("COMPARE_AND_SWAP", f"Moved the current max into position {end}.", arr, [0, end], [0, end], []))
            heapify(end, 0)

        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], []))

    elif name == "cycle sort":
        arr = list(data_structure)
        n = len(arr)

        for cycle_start in range(0, n - 1):
            item = arr[cycle_start]
            pos = cycle_start
            for i in range(cycle_start + 1, n):
                if arr[i] < item:
                    pos += 1

            if pos == cycle_start:
                steps.append(make_step("COMPARE", f"The value at index {cycle_start} is already in the correct cycle position.", arr, [cycle_start], [], []))
                continue

            while item == arr[pos]:
                pos += 1

            if pos != cycle_start:
                arr[pos], item = item, arr[pos]
                steps.append(make_step("COMPARE_AND_SWAP", f"Moved the item into its cycle position at index {pos}.", arr, [cycle_start, pos], [cycle_start, pos], []))

            while pos != cycle_start:
                pos = cycle_start
                for i in range(cycle_start + 1, n):
                    if arr[i] < item:
                        pos += 1
                while item == arr[pos]:
                    pos += 1
                if pos != cycle_start:
                    arr[pos], item = item, arr[pos]
                    steps.append(make_step("COMPARE_AND_SWAP", f"Placed the next item into position {pos}.", arr, [cycle_start, pos], [cycle_start, pos], []))

            arr[cycle_start] = item
            steps.append(make_step("COMPARE", f"Placed the value for cycle {cycle_start} into its final position.", arr, [cycle_start], [], []))

        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], []))

    elif name == "3-way merge sort":
        arr = list(data_structure)

        def build_tree(low: int, high: int, operation: str = "Split", message: str | None = None):
            if low > high:
                return None
            if low == high:
                return {
                    "label": f"[{low},{high}]",
                    "values": [arr[low]],
                    "operation": operation,
                    "message": message or f"{operation} the single element at index {low}.",
                    "children": []
                }
            span = high - low + 1
            mid1 = low + span // 3
            mid2 = low + 2 * span // 3
            return {
                "label": f"[{low},{high}]",
                "values": arr[low:high + 1],
                "operation": operation,
                "message": message or f"{operation} the range [{low},{high}] into three parts.",
                "children": [
                    build_tree(low, mid1 - 1, operation, None),
                    build_tree(mid1, mid2 - 1, operation, None),
                    build_tree(mid2, high, operation, None),
                ],
            }

        def merge_three(low: int, high: int):
            if low >= high:
                return
            span = high - low + 1
            mid1 = low + span // 3
            mid2 = low + 2 * span // 3
            split_tree = build_tree(low, high, "Split", f"Split the range [{low},{high}] into three parts.")
            steps.append(make_step("SPLIT", f"Split the range [{low},{high}] into three parts.", arr, [], [], [], split_tree))
            merge_three(low, mid1 - 1)
            merge_three(mid1, mid2 - 1)
            merge_three(mid2, high)
            left = arr[low:mid1]
            middle = arr[mid1:mid2]
            right = arr[mid2:high + 1]
            merged = sorted(left + middle + right)
            arr[low:high + 1] = merged
            merge_tree = build_tree(low, high, "Merge", f"Merged the three sorted parts of [{low},{high}] into one sorted range.")
            steps.append(make_step("MERGE", f"Merged the three sorted parts for the range [{low},{high}].", arr, [low, high], [low, high], [], merge_tree))

        merge_three(0, len(arr) - 1)
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], [], None))

    elif name == "quick sort":
        arr = list(data_structure)

        def build_tree(low: int, high: int):
            if low > high:
                return None
            return {
                "label": f"[{low},{high}]",
                "values": arr[low:high + 1],
                "children": []
            }

        def partition(low: int, high: int, tree_node: Dict[str, Any]) -> int:
            pivot = arr[high]
            i = low - 1
            steps.append(make_step("PIVOT", f"Using index {high} as the pivot with value {pivot}.", arr, [high], [], [high], None))
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
                                {
                                    "label": "Current Partition",
                                    "values": arr[low:high + 1],
                                    "children": []
                                },
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
                                {
                                    "label": "Current Partition",
                                    "values": arr[low:high + 1],
                                    "children": []
                                },
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
                            None,
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
                    None,
                )
            )
            return i + 1

        def quicksort(low: int, high: int, tree_node: Dict[str, Any]):
            if low < high:
                pivot_index = partition(low, high, tree_node)
                left_child = build_tree(low, pivot_index - 1)
                right_child = build_tree(pivot_index + 1, high)
                tree_node["children"] = [left_child, right_child]
                quicksort(low, pivot_index - 1, left_child)
                quicksort(pivot_index + 1, high, right_child)

        root = build_tree(0, len(arr) - 1)
        quicksort(0, len(arr) - 1, root)
        steps.append(make_step("SORTED", "The array has been sorted.", arr, [], [], [], None))

    else:
        steps.append(make_step("STEP", f"{algorithm_name} is being shown step by step.", list(data_structure), [], [], []))

    return {"intro": intro, "steps": steps}


class BenchmarkRequest(BaseModel):
    algorithm_a: str
    algorithm_b: str
    data_structure: List[int]


def _count_steps(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Attach running comparison/swap counters to each step."""
    comparisons = 0
    swaps = 0
    enriched = []
    for step in steps:
        action = step.get("action", "")
        if action in ("COMPARE", "COMPARE_AND_SWAP", "PIVOT", "SPLIT", "MERGE"):
            comparisons += 1
        if action in ("COMPARE_AND_SWAP",):
            swaps += 1
        enriched.append({**step, "comparisons": comparisons, "swaps": swaps})
    return enriched


@app.post("/api/v1/benchmark")
async def benchmark(request: BenchmarkRequest):
    plan_a = build_deterministic_plan(request.algorithm_a, request.data_structure)
    plan_b = build_deterministic_plan(request.algorithm_b, request.data_structure)
    return {
        "a": {
            "algorithm": request.algorithm_a,
            "steps": _count_steps(plan_a["steps"]),
        },
        "b": {
            "algorithm": request.algorithm_b,
            "steps": _count_steps(plan_b["steps"]),
        },
    }


@app.post("/api/v1/narrate")
async def generate_narration(state: AlgorithmState):
    supported_algorithms = {"bubble sort", "selection sort", "insertion sort", "merge sort", "3-way merge sort", "heap sort", "cycle sort", "quick sort"}
    if state.algorithm_name.lower() in supported_algorithms:
        return build_deterministic_plan(state.algorithm_name, state.data_structure)

    api_key = os.getenv("WATSONX_APIKEY")
    if not api_key:
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


def build_context_prompt(request: ChatRequest) -> str:
    """Build a user-facing message that includes live visualizer context when available."""
    has_context = request.algorithm and request.current_step is not None

    if not has_context:
        return (
            f"You are Elix, an AI tutor for an algorithm learning platform. "
            f"Answer this question clearly and include a simple visual representation or example where helpful.\n\n"
            f"Student Question: {request.message}"
        )

    # Describe the highlighted indices in plain English
    highlights = []
    if request.compare_indices:
        highlights.append(f"comparing indices {request.compare_indices}")
    if request.swap_indices:
        highlights.append(f"swapping indices {request.swap_indices}")
    if request.pivot_indices:
        highlights.append(f"pivot at index {request.pivot_indices}")
    highlight_str = ("; ".join(highlights)) if highlights else "no highlighted elements"

    context_block = (
        f"[VISUALIZER CONTEXT]\n"
        f"Algorithm: {request.algorithm}\n"
        f"Step: {request.current_step + 1} of {request.step_count or '?'}\n"
        f"Current array state: {request.data_array}\n"
        f"Active highlights: {highlight_str}\n"
        f"Step narration: {request.current_narration or 'none'}\n"
        f"[END CONTEXT]\n\n"
    )

    return (
        f"You are Elix, an AI tutor helping a student learn data structures and algorithms.\n\n"
        f"{context_block}"
        f"INSTRUCTIONS:\n"
        f"1. Evaluate the Student Question below: '{request.message}'\n"
        f"2. IF the question is about the active visualizer ({request.algorithm}), use the [ACTIVE VISUALIZER CONTEXT] above to explain exactly what is happening on screen right now, referencing specific indices and numbers.\n"
        f"3. IF the question is a general CS/algorithm topic unrelated to {request.algorithm} (for example, asking about trees, graphs, or big-O notation while a sorting algorithm is open), IGNORE the active visualizer context and answer their conceptual question directly and thoroughly! Do NOT lecture them about switching visualizers.\n\n"
        f"Student Question: {request.message}"
    )


@app.post("/api/v1/chat")
async def chat_with_ai(request: ChatRequest):
    api_key = os.getenv("WATSONX_APIKEY")
    if not api_key:
        return {"reply": build_fallback_chat_reply(request.message)}

    try:
        access_token = get_iam_token(api_key)
        BASE_URL = "https://api.us-south.watson-orchestrate.cloud.ibm.com/instances/d781388e-1567-4604-b277-a72a9f74fc4e"
        AGENT_ID = "4defadc3-2aa7-4c81-ae06-eb8d799f3308"
        ENDPOINT = BASE_URL + "/v1/orchestrate/" + AGENT_ID + "/chat/completions"
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        payload = {
            "messages": [{"role": "user", "content": build_context_prompt(request)}],
            "stream": False,
        }
        response = REQUEST_SESSION.post(ENDPOINT, json=payload, headers=headers, timeout=(10, 30))
        if not response.ok:
            return {"reply": build_fallback_chat_reply(request.message)}
        data = response.json()
        reply = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return {"reply": reply}
    except Exception as e:
        print(f"DEBUG CHAT ERROR: {str(e)}")
        return {"reply": build_fallback_chat_reply(request.message)}