from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from mongo import User, validate, get_user_id

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or "*" for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class UserInput(BaseModel):
    username: str
    password: str


@app.post("/register")
def register(user: UserInput):
    new_user = User(user.username, user.password)
    result = new_user.register()
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["msg"])
    return {"message": "Registered successfully", "user_id": result["user_id"]}

@app.post("/login")
def login(user: UserInput):
    if validate(user.username, user.password):
        user_id = get_user_id(user.username)
        return {"user_id": user_id}
    raise HTTPException(status_code=400, detail="Invalid username or password")

@app.get("/me")
def get_current_user(user_id: str = Header(...)):
    return {"user_id": user_id, "message": "This is your profile"}
