import uvicorn
from app.core.config import Config

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=Config.PORT, reload=True)
