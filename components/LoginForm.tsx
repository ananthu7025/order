"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Factory, Mail, Lock, Eye, EyeOff, ShieldCheck, Clock, TrendingUp, Headphones, Building2 } from "lucide-react";

const FEATURES = [
  { icon: ShieldCheck, color: "var(--blue)", bg: "var(--blue-light)", title: "Verified Buyers", desc: "Connect with serious buyers looking for bulk quantities." },
  { icon: Clock, color: "var(--green)", bg: "var(--green-light)", title: "Timely Payments", desc: "Secure payments and faster settlements." },
  { icon: TrendingUp, color: "var(--amber)", bg: "var(--amber-light)", title: "Grow Your Business", desc: "Increase capacity utilization and sales." },
  { icon: Headphones, color: "var(--purple, #7c3aed)", bg: "var(--purple-light, #f5f3ff)", title: "Dedicated Support", desc: "Our team is here to support you at every step." },
];

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to sign in");
      }

      const next = searchParams.get("next") || "/dashboard";
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="row g-0">
        <div className="col-lg-4 auth-side">
          <div className="auth-side-logo">
            <div className="mark">
              <Factory size={20} />
            </div>
            <div>
              <div className="brand-name">MOQ Pool</div>
              <div className="brand-tag">Smart Manufacturing. Stronger Together.</div>
            </div>
          </div>

          <div className="auth-side-heading">Welcome back to MOQ Pool</div>
          <p className="auth-side-copy">Sign in to manage your products, leads, and quotations.</p>

          <div className="auth-feature-list">
            {FEATURES.map((f) => (
              <div className="auth-feature" key={f.title}>
                <div className="auth-feature-icon" style={{ background: f.bg, color: f.color }}>
                  <f.icon />
                </div>
                <div>
                  <div className="auth-feature-title">{f.title}</div>
                  <div className="auth-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-side-illustration">
            <Building2 size={120} strokeWidth={1} color="var(--blue-border)" />
          </div>
        </div>

        <div className="col-lg-8 auth-form-side">
          <div className="auth-form-wrap" style={{ maxWidth: 440 }}>
            <div className="auth-form-header">
              <h1>Sign in to your account</h1>
              <p>Enter your email and password to continue</p>
            </div>

            <form className="card card-pad" onSubmit={handleSubmit}>
              {error && (
                <div className="banner banner-amber" style={{ marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <label className="field-label">Email Address</label>
              <div className="input-icon-wrap" style={{ marginBottom: 14 }}>
                <Mail className="field-icon" />
                <input
                  className="input"
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <label className="field-label">Password</label>
              <div className="input-icon-wrap">
                <Lock className="field-icon" />
                <input
                  className="input has-toggle"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button type="button" className="input-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: 22, width: "100%" }} disabled={submitting}>
                {submitting ? "Signing in…" : "Sign In →"}
              </button>
            </form>

            <p className="text-center text-sm text-muted" style={{ marginTop: 18 }}>
              Don&apos;t have an account?{" "}
              <a href="/register" style={{ color: "var(--blue)", fontWeight: 600 }}>
                Create one
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
