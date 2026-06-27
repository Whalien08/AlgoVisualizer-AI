from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
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

class AlgorithmState(BaseModel):
    algorithm_name: str
    current_step: int
    phase: str
    data_structure: List[int]
    highlighted_indices: List[int]

_cached_iam_token: str | None = None
_cached_token_expiry: float = 0.0

def get_iam_token(api_key: str) -> str:
    global _cached_iam_token, _cached_token_expiry

    if _cached_iam_token and _cached_token_expiry > time.time() + 30:
        return _cached_iam_token

    url = "https://iam.cloud.ibm.com/identity/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
        "apikey": api_key
    }

    response = requests.post(url, headers=headers, data=data)
    if not response.ok:
        raise Exception(f"Failed to generate IAM token. Status: {response.status_code}, Response: {response.text}")

    token_data = response.json()
    _cached_iam_token = token_data["access_token"]
    expires_in = token_data.get("expires_in", 3600)
    _cached_token_expiry = time.time() + int(expires_in)
    return _cached_iam_token

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
        
        print(f"DEBUG: Connecting to: {ENDPOINT}") # Let's verify it again
        headers = {"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}
        
        user_prompt = (
            f"You are visualizing {state.algorithm_name}. "
            f"Currently, we are at STEP {state.current_step}. "
            f"The current array is {state.data_structure}. "
            "Return ONLY a JSON object for this step: "
            '{"action": "string", "explanation": "string", "current_state": [int, ...]}'
            "the action should be in all caps and should ends with colon and go to new line"
            "when the number are sorted inform that it has been sorted after that don't need to accept user prompt till the input has changed"
        )

        payload = {"messages": [{"role": "user", "content": user_prompt}], "stream": False}
        agent_response = requests.post(ENDPOINT, json=payload, headers=headers)
        
        if not agent_response.ok:
            raise HTTPException(status_code=500, detail=agent_response.text)
        
        agent_data = agent_response.json()
        agent_reply = agent_data.get("choices", [{}])[0].get("message", {}).get("content", "")
        
        if "```json" in agent_reply:
            agent_reply = agent_reply.split("```json")[1].split("```")[0].strip()
        elif "```" in agent_reply:
            agent_reply = agent_reply.split("```")[1].split("```")[0].strip()

        step_data = json.loads(agent_reply)
        
        return {
            "action": step_data.get("action", "Processing"),
            "logic": step_data.get("explanation", "Next step."),
            "result": step_data.get("current_state", state.data_structure)
        }

    except Exception as e:
        print(f"DEBUG ERROR: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))