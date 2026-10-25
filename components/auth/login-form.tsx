"use client";

import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { signInAction, signUpAction, type AuthFormState } from "@/app/(auth)/login/actions";
import { FormError } from "@/components/ui/form-error";
import { cn } from "@/lib/utils";

function SubmitButton({ mode }: { mode: "sign-in" | "sign-up" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-strong px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <LockKeyhole aria-hidden="true" className="size-4" />}
      {pending ? "Please wait…" : mode === "sign-in" ? "Sign in securely" : "Create account"}
    </button>
  );
}

export function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    mode === "sign-in" ? signInAction : signUpAction,
    {},
  );

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-xl bg-surface-soft p-1" role="group" aria-label="Account action">
        {(["sign-in", "sign-up"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            aria-pressed={mode === value}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              mode === value ? "bg-surface text-ink shadow-sm" : "text-muted",
            )}
          >
            {value === "sign-in" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink">Email address</label>
          <div className="relative">
            <Mail aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-subtle" />
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-3 text-sm text-ink placeholder:text-subtle"
            />
          </div>
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
            minLength={8}
            maxLength={128}
            placeholder="At least 8 characters"
            className="w-full rounded-xl border border-line bg-surface px-3 py-3 text-sm text-ink placeholder:text-subtle"
          />
        </div>
        <FormError message={state.error ?? null} />
        {state.message ? <p role="status" className="rounded-xl bg-success-soft px-3 py-2.5 text-xs text-success">{state.message}</p> : null}
        <SubmitButton mode={mode} />
      </form>
      <p className="mt-5 text-center text-[11px] leading-5 text-subtle">
        Authentication is handled by Supabase. Auto never asks for provider website passwords or browser cookies.
      </p>
    </div>
  );
}
