import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initPersistentStorage } from "./services/persistentStorage";
import "./styles/global.css";

const queryClient = new QueryClient();

const mount = () => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>
  );
};

(async () => {
  try {
    // Hydrate localStorage from the Railway-backed SQLite store (if present).
    await initPersistentStorage({ timeoutMs: 1200 });
  } finally {
    mount();
  }
})();
