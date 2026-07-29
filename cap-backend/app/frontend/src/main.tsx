
  import { createRoot } from "react-dom/client";
  import "./i18n.ts";
  import "@ui5/webcomponents-react/dist/Assets.js";
  import App from "./app/App.tsx";
  import "./styles/index.css";
  import "./styles/animations.css";

  createRoot(document.getElementById("root")!).render(<App />);
  
