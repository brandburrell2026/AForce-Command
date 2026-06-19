import { useReducedMotion as useSystemReducedMotion } from "framer-motion";

export function useReducedMotion(): boolean {
  const systemReduce = useSystemReducedMotion();
  if (systemReduce) return true;
  if (typeof window !== "undefined") {
    const path = window.location.pathname.replace(/\/+$/, "");
    if (path.endsWith("/allslides")) return true;
  }
  return false;
}
