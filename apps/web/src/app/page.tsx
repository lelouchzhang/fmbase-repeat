"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [status, setStatus] = useState("checking...");
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`)
      .then((res) => res.json())
      .then((data) => setStatus(data.status))
      .catch(() => setStatus("Unreachable."));
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">fenmiaobase</h1>
      <p className="mt-4 text-gray-500">API Status: {status}</p>
    </main>
  );
}
