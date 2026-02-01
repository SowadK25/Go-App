import os
from dotenv import load_dotenv

load_dotenv()

METROLINX_API_KEY = os.getenv("METROLINX_API_KEY")

if not METROLINX_API_KEY:
    raise RuntimeError("METROLINX_API_KEY not set")