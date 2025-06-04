from comps.auth.mongo import User, validate, get_user_id_and_name
from fastapi import HTTPException
from pydantic import BaseModel

class UserRegisterInput(BaseModel):
    name: str
    email: str
    password: str
    
class UserLoginInput(BaseModel):
    email: str
    password: str

def handle_user_register(user: UserRegisterInput):
    new_user = User(user.name, user.email, user.password)
    result = new_user.register()
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["msg"])
    return {"message": "Registered successfully", "user_id": result["user_id"]}

def handle_user_login(user: UserLoginInput):
    if validate(user.email, user.password):
        user_id, name = get_user_id_and_name(user.email)
        return {"user_id": user_id, "name": name}
    raise HTTPException(status_code=400, detail="Invalid username or password")
