import "@testing-library/jest-dom";
import { server } from "./mswServer";

// Recharts uses ResizeObserver which jsdom doesn't implement
(globalThis as Record<string, unknown>).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
