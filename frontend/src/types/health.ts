export type HealthResponse = {
  status: "ok" | "error";
  database: "connected" | "unreachable";
};
