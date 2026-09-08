import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

export default api;

export function assetUrl(path) {
  if (!path) return null;
  return path;
}

export function money(value) {
  const n = Number(value) || 0;
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function errorMessage(err, fallback = "Something went wrong") {
  return err?.response?.data?.message || err?.message || fallback;
}
