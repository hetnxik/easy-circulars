import uuid
from passlib.context import CryptContext
from comps.mongo_client import mongo_client

collection = mongo_client['easy_circulars']['users']
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
NAMESPACE_UUID = uuid.UUID("8d5decaf-e37c-4ecc-919e-09d2721b6ea0")

class User:
    def __init__(self, name, email, password):
        self.name = name
        self.email = email
        self.password = pwd_context.hash(password)
        self._id = str(uuid.uuid5(namespace=NAMESPACE_UUID, name=self.name))

    def register(self):
        if collection.find_one({"email": self.email}) is None:
            collection.insert_one({
                "_id": self._id,
                "name": self.name,
                "email": self.email,
                "password": self.password
            })
            return {"status": "success", "user_id": self._id}
        return {"status": "error", "msg": "Username already exists"}

    def to_dict(self):
        return {"_id": self._id, "username": self.username, "password": self.password}


def get_user_id_and_name(email):
    u = collection.find_one({"email": email})
    if u:
        return u["_id"], u.get("name")
    return None, None

def validate(email, password):
    user = collection.find_one({"email": email})
    if user is not None:
        return pwd_context.verify(password, user["password"])
    return False