"""Minimal FastAPI wrapper around the piper TTS binary."""
import subprocess
import tempfile
import os
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

app = FastAPI(title="Piper TTS", version="1.0.0")

PIPER_BIN = "/app/piper/piper"
VOICES_DIR = "/voices"


class SynthRequest(BaseModel):
    text: str
    voice: str = "pl_PL-darkman-medium"


@app.post("/synthesize")
async def synthesize(req: SynthRequest):
    model_path = os.path.join(VOICES_DIR, f"{req.voice}.onnx")
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail=f"Voice model not found: {req.voice}")

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        result = subprocess.run(
            [PIPER_BIN, "--model", model_path, "--output_file", tmp_path],
            input=req.text.encode("utf-8"),
            capture_output=True,
            timeout=30,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=result.stderr.decode())

        return FileResponse(tmp_path, media_type="audio/wav",
                            headers={"Content-Disposition": "attachment; filename=speech.wav"})
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="TTS timeout")


@app.get("/voices")
async def list_voices():
    voices = [f[:-5] for f in os.listdir(VOICES_DIR) if f.endswith(".onnx")]
    return {"voices": voices}


@app.get("/health")
async def health():
    return {"status": "ok", "binary": os.path.exists(PIPER_BIN)}
