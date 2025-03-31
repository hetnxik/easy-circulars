import uuid
from passlib.context import CryptContext
from comps.mongo_client import mongo_client

collection = mongo_client['easy-circulars']['authentication']
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
NAMESPACE_UUID = uuid.UUID("8d5decaf-e37c-4ecc-919e-09d2721b6ea0")

class User:
    def __init__(self, username, password):
        self.username = username
        self.password = pwd_context.hash(password)
        self._id = str(uuid.uuid5(namespace=NAMESPACE_UUID, name=self.username))

    def register(self):
        if collection.find_one({"username": self.username}) is None:
            collection.insert_one({"_id": self._id, "username": self.username, "password": self.password})
            return "Registered"

        return "Already registered"

def validate(username, password):
    user = collection.find_one({"username": username})
    if user is not None:
        return pwd_context.verify(password, user["password"])
    return False

if __name__ == "__main__":
    user = User("username", "password")
    print(user.register())
    print(validate("username", "password"))