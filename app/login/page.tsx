// app/login/page.tsx
"use client";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next") || "/admin";
  const err  = params.get("error") || "";

  function loginWithGithub() {
    window.location.href = `/auth/signin?next=${encodeURIComponent(next)}`;
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16 text-center space-y-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {err ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{err}</div>
      ) : null}
      <button onClick={loginWithGithub} className="rounded-md bg-black text-white px-4 py-2">
        Continue with GitHub
      </button>
    </div>
  );
}
