"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut } from "lucide-react";

export function UserMenu({ companyName: companyNameProp }: { companyName?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fetchedCompanyName, setFetchedCompanyName] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const companyName = companyNameProp ?? fetchedCompanyName ?? "";

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Only pages that didn't already load the manufacturer pass no
  // companyName — fetch it here so the topbar shows the logged-in
  // manufacturer's real name instead of staying blank.
  useEffect(() => {
    if (companyNameProp) return;
    fetch("/api/manufacturer")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.manufacturer?.companyName) setFetchedCompanyName(data.manufacturer.companyName);
      })
      .catch(() => {});
  }, [companyNameProp]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="user-chip" style={{ position: "relative", cursor: "pointer" }} ref={ref} onClick={() => setOpen((v) => !v)}>
      <div className="avatar-wrap">
        <img className="avatar" src="https://i.pravatar.cc/80?img=33" alt="" />
        <span className="dot"></span>
      </div>
      <div>
        <div className="name">{companyName}</div>
        <div className="role">Manufacturer</div>
      </div>
      <ChevronDown size={16} />

      {open && (
        <div className="ui-dropdown" style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100, minWidth: 160 }}>
          <div className="ui-dropdown-item" onClick={handleLogout}>
            <LogOut size={15} />
            Sign out
          </div>
        </div>
      )}
    </div>
  );
}
