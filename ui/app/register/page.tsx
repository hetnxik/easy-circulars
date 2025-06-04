"use client";

import { useState } from "react";
import CHAT_QNA_URL from "@/lib/constants";
import axios from "axios";
import { useRouter } from 'next/navigation';
import Link from "next/link";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [popup, setPopup] = useState<{ message: string; success: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async () => {
    setPopup(null);
    setLoading(true);

    try {
      await axios.post(`${CHAT_QNA_URL}/api/register`, {
        name,
        email,
        password,
      }, {
        headers: { "Content-Type": "application/json" }
      });

      setPopup({ message: "Registered successfully! You can now log in.", success: true });
      router.push("/login");
    } catch (err: any) {
      setPopup({ message: err.message || "Something went wrong", success: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start h-screen pt-16">
      <h1 className="text-3xl text-header font-bold mb-6">Register</h1>

      <input
        type="text"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-80 px-4 py-3 border rounded mb-4 text-lg"
      />
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
        {loading ? "Registering..." : "Register"}
      </button>

      <Link href="/login" className="mt-3 text-primary underline">
          Already have an account? Log in
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

export default RegisterPage;
