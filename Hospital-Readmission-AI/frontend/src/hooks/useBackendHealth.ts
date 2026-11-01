import { useEffect, useState } from "react";
import { getBackendHealth } from "@/services/healthService";

type Status = "checking" | "online" | "offline";

/** Pings the backend health endpoint once on mount. */
export function useBackendHealth() {
  const [status, setStatus] = useState<Status>("checking");
  useEffect(() => {
    getBackendHealth()
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);
  return status;
}
