import { useCallback, useEffect, useRef, useState } from "react";

import type { ToastMessage } from "../components/AppOverlays";

export function useAppToast(): {
  closeToast: () => void;
  isToastClosing: boolean;
  setWorkspaceError: (message: string | null) => void;
  showToast: (text: string, type?: "error" | "info") => void;
  toastMessage: ToastMessage | null;
} {
  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);
  const [isToastClosing, setIsToastClosing] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeToast = useCallback(() => {
    if (!toastMessage || isToastClosing) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastCloseTimerRef.current) clearTimeout(toastCloseTimerRef.current);
    setIsToastClosing(true);
    toastCloseTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      setIsToastClosing(false);
      toastCloseTimerRef.current = null;
    }, 170);
  }, [isToastClosing, toastMessage]);

  const showToast = useCallback((text: string, type: "error" | "info" = "error") => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (toastCloseTimerRef.current) clearTimeout(toastCloseTimerRef.current);
    setIsToastClosing(false);
    setToastMessage({ text, type });
    toastTimerRef.current = setTimeout(() => {
      setIsToastClosing(true);
      toastCloseTimerRef.current = setTimeout(() => {
        setToastMessage(null);
        setIsToastClosing(false);
        toastCloseTimerRef.current = null;
      }, 170);
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (toastCloseTimerRef.current) clearTimeout(toastCloseTimerRef.current);
    };
  }, []);

  const setWorkspaceError = useCallback((message: string | null) => {
    if (message) showToast(message, "error");
  }, [showToast]);

  return {
    closeToast,
    isToastClosing,
    setWorkspaceError,
    showToast,
    toastMessage
  };
}
