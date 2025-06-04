"use client";

import { useState } from "react";
import CHAT_QNA_URL from "@/lib/constants";
import axios from "axios";
import { useRouter } from 'next/navigation';
import Link from "next/link";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [popup, setPopup] = useState<{ message: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    setPopup(null);
    setLoading(true);

    try {
      const response = await axios.post(`${CHAT_QNA_URL}/api/login`, {
        email,
        password,
      }, {
        headers: { "Content-Type": "application/json" }
      });

      const data = response.data;
      localStorage.setItem("token", data.user_id);
      localStorage.setItem("name", data.name);
      window.dispatchEvent(new Event("authChange"));
      setPopup({ message: "Login successful!", success: true });
      router.push("/");
    } catch (err: any) {
      setPopup({ message: err.message || "Something went wrong", success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start h-screen pt-16">
      <h1 className="text-3xl text-header font-bold mb-6">Login</h1>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
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
        className="w-80 px-4 py-3 bg-primary text-white rounded text-lg bg-primary/90 disabled:opacity-50"
      >
        {loading ? "Logging in..." : "Login"}
      </button>

      <Link href="/register" className="mt-3 text-primary underline">
          Don't have an account? Register
      </Link>

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

export default LoginPage;
