import os
from dotenv import load_dotenv

load_dotenv()
key = os.getenv("WATSONX_APIKEY")

if not key:
    print("ERROR: No API Key found in .env!")
else:
    print(f"Key loaded! Length: {len(key)}")
    print(f"First 5 chars: {key[:5]}")
    # If this prints 'PASTE', 'API', or 'MyPer', you are using the wrong string!