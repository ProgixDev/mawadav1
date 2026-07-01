"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { signIn, type LoginState } from "./actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Connexion…" : "Se connecter"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700">
          Adresse courriel
        </label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          Mot de passe
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}
      <SubmitButton />
    </form>
  );
}
