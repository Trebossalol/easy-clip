import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MainAppWindow } from "@/window/main/MainAppWindow";
import { CutterWindow, isCutterRoute } from "@/window/cutter/CutterWindow";
import { QuickActionWindow, isQuickActionRoute } from "@/window/quick-menu/QuickActionWindow";
import { ConfirmWindow, isConfirmRoute } from "@/window/confirm/ConfirmWindow";
import { TopLoadingBar } from "@/components/TopLoadingBar";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

const isQuickAction = isQuickActionRoute();
const isConfirm = isConfirmRoute();
const isCutter = isCutterRoute();

createRoot(root).render(
  <StrictMode>
    {isQuickAction ? (
      <QuickActionWindow />
    ) : isConfirm ? (
      <ConfirmWindow />
    ) : (
      <TopLoadingBar>
        {isCutter ? <CutterWindow /> : <MainAppWindow />}
      </TopLoadingBar>
    )}
  </StrictMode>,
);
