"use client";

import { useRouter } from "next/router";

const ROLE_VALUES = ["VISITOR", "PREMIUM", "PRO"] as const;
export type RoleOverride = (typeof ROLE_VALUES)[number];

const ROLE_FLAG_MAP: Record<RoleOverride, { premium: boolean; analytics: boolean }> = {
  VISITOR: { premium: false, analytics: false },
  PREMIUM: { premium: true, analytics: false },
  PRO: { premium: true, analytics: true },
};

export function normalizeRoleParam(value: unknown): RoleOverride | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  return ROLE_VALUES.includes(upper as RoleOverride) ? (upper as RoleOverride) : null;
}

export function getRoleFlags(role: RoleOverride) {
  return ROLE_FLAG_MAP[role];
}

export function formatRoleLabel(role: RoleOverride): string {
  return role.replace("_", " ");
}

export function RoleOverrideToggle({ activeRole }: { activeRole: RoleOverride }) {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;

  const router = useRouter();

  const handleSelect = (role: RoleOverride) => {
    document.cookie = `ll_role=${role}; path=/; max-age=${60 * 60}; SameSite=Lax`;
    const url = new URL(window.location.href);
    url.searchParams.set("role", role);
    const nextPath = `${url.pathname}${url.searchParams.toString() ? `?${url.searchParams.toString()}` : ""}`;
    if (router?.replace) {
      void router.replace(nextPath, undefined, { shallow: true }).finally(() => window.location.reload());
    } else {
      window.location.href = nextPath;
    }
  };

  return (
    <div className="fixed right-4 top-4 z-50 hidden gap-1 rounded-full border border-white/10 bg-[#0B1530]/90 px-3 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur md:flex">
      {ROLE_VALUES.map((role) => (
        <button
          key={role}
          type="button"
          onClick={() => handleSelect(role)}
          className={role === activeRole ? "btn-primary px-3 py-1 text-xs" : "rounded-full px-3 py-1 text-white/70 transition hover:text-white"}
        >
          {formatRoleLabel(role)}
        </button>
      ))}
    </div>
  );
}
