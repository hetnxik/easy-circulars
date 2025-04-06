"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [popup, setPopup] = useState(null);

  const handleLogin = async () => {
    setError("");
    setPopup(null);
    try {
      // Simulated API response
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulating network delay
      const response = { ok: true, json: async () => ({ message: "Login successful" }) };

      // Uncomment to make an actual API request
      // const response = await fetch("/api/login", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ username, password }),
      // });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      const data = await response.json();
      setPopup({ message: data.message, success: true });
    } catch (err) {
      setPopup({ message: "Invalid credentials", success: false });
    }
  };

  return (
    <div className="flex flex-col items-center justify-start h-screen pt-16">
      <h1 className="text-3xl font-bold mb-6">Login</h1>
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
        onClick={handleLogin}
        className="w-80 px-4 py-3 bg-blue-500 text-white rounded text-lg"
      >
        Login
      </button>
      {popup && (
        <div
          className={`mt-4 p-4 rounded text-white text-lg ${popup.success ? "bg-green-500" : "bg-red-500"}`}
        >
          {popup.message}
        </div>
      )}
    </div>
  );
}
