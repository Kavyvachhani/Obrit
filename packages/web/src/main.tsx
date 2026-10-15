import React from "react";
import ReactDOM from "react-dom/client";
import * as THREE from "three";
import App from "./App.js";
import "./index.css";

// Unify Three.js instance across three-forcegraph and application
(window as any).THREE = THREE;

const root = document.getElementById("root");
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
