"use client";

import { useState } from "react";
import pageAuth from "@/components/hoc/pageAuth";

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [popup, setPopup] = useState<{ message: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = async () => {
    setPopup(null);
    setLoading(true);

    try {
      const endpoint = isRegistering ? "register" : "login";
      const response = await fetch(`http://localhost:8000/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || `${isRegistering ? "Registration" : "Login"} failed`);
      }

      if (isRegistering) {
        setPopup({ message: "Registered successfully! You can now log in.", success: true });
        setIsRegistering(false);
      } else {
          localStorage.setItem("token", data.user_id);
          setPopup({message: "Login successful!", success: true});
          // Optionally redirect
          // router.push("/dashboard");
      }
    } catch (err: any) {
      setPopup({ message: err.message || "Something went wrong", success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start h-screen pt-16">
      <h1 className="text-3xl font-bold mb-6">{isRegistering ? "Register" : "Login"}</h1>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="w-80 px-4 py-3 border rounded mb-4 text-lg"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-80 px-4 py-3 border rounded mb-4 text-lg"
      />
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-80 px-4 py-3 bg-blue-500 text-white rounded text-lg hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? (isRegistering ? "Registering..." : "Logging in...") : isRegistering ? "Register" : "Login"}
      </button>

      <button
        onClick={() => setIsRegistering(!isRegistering)}
        className="mt-3 text-blue-500 underline"
      >
        {isRegistering ? "Already have an account? Log in" : "Don't have an account? Register"}
      </button>

      {popup && (
        <div
          className={`mt-4 p-4 rounded text-white text-lg ${
            popup.success ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {popup.message}
        </div>
      )}
    </div>
  );
}

export default pageAuth(LoginPage);