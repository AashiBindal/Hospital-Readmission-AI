import { useBackendHealth } from "@/hooks/useBackendHealth";

export default function Header() {
  const status = useBackendHealth();
  const color =
    status === "online" ? "bg-green-500" : status === "offline" ? "bg-red-500" : "bg-amber-400";
  return (
    <header className="flex h-14 items-center justify-end border-b border-slate-200 bg-white px-6">
      <span className="flex items-center gap-2 text-xs text-slate-500">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        Backend: {status}
      </span>
    </header>
  );
}
