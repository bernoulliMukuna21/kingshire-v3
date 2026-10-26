"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { LoaderCircle, MessageSquare, X } from "lucide-react";
import { FEEDBACK_URL } from "@/lib/contact";

const FeedbackContext = createContext<(() => void) | null>(null);
const DISMISS_KEY = "kingshire-feedback-dismissed";
function subscribe(callback: () => void) {
  window.addEventListener("feedback-visibility", callback);
  return () => window.removeEventListener("feedback-visibility", callback);
}
function dismissedSnapshot() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
const serverSnapshot = () => true;
export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hiddenWithoutStorage, setHiddenWithoutStorage] = useState(false);
  const dismissed = useSyncExternalStore(
    subscribe,
    dismissedSnapshot,
    serverSnapshot,
  );
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const openFeedback = useCallback(() => {
    setLoaded(false);
    setOpen(true);
  }, []);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const previous = document.activeElement;
    const fallbackFocus = launcher.current;
    const { scrollX, scrollY } = window;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus({ preventScroll: true });
      else if (fallbackFocus?.isConnected)
        fallbackFocus.focus({ preventScroll: true });
      window.scrollTo({ top: scrollY, left: scrollX, behavior: "instant" });
    };
  }, [open]);
  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
      window.dispatchEvent(new Event("feedback-visibility"));
    } catch {
      setHiddenWithoutStorage(true);
    }
  }
  return (
    <FeedbackContext.Provider value={openFeedback}>
      {children}
      {!pathname.startsWith("/admin") &&
        !dismissed &&
        !hiddenWithoutStorage && (
          <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-4 z-30 flex overflow-hidden rounded-full border border-slate-200 bg-white shadow-lg shadow-slate-950/15">
            <button
              ref={launcher}
              type="button"
              onClick={openFeedback}
              aria-haspopup="dialog"
              className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm font-bold text-[#10234b] hover:bg-blue-50"
            >
              <MessageSquare size={17} />
              Feedback
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Hide feedback button"
              className="min-w-11 border-l border-slate-100 px-3 text-slate-500 hover:bg-slate-100"
            >
              <X size={15} />
            </button>
          </div>
        )}
      {open && (
        <dialog
          ref={dialog}
          aria-labelledby="feedback-title"
          aria-describedby="feedback-description"
          onCancel={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
          className="fixed inset-auto bottom-4 left-4 m-0 h-[min(650px,85dvh)] max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-950/25 open:flex sm:left-auto sm:right-4 sm:w-[420px]"
        >
          <div className="flex shrink-0 items-start gap-4 border-b border-slate-100 px-5 py-4">
            <div className="flex-1">
              <h2 id="feedback-title" className="font-bold text-slate-950">
                Share your experience
              </h2>
              <p
                id="feedback-description"
                className="mt-1 text-xs leading-5 text-slate-500"
              >
                We’d love to hear how KingsHire has been for you.
              </p>
            </div>
            <button
              ref={closeButton}
              type="button"
              aria-label="Close feedback"
              onClick={() => setOpen(false)}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            >
              <X size={19} />
            </button>
          </div>
          <div className="relative min-h-0 flex-1">
            <iframe
              title="KingsHire feedback form"
              src={`${FEEDBACK_URL.replace("/r/", "/embed/")}?alignLeft=1&hideTitle=1`}
              referrerPolicy="no-referrer"
              onLoad={() => setLoaded(true)}
              className="h-full w-full border-0 bg-white"
            />
            {!loaded && (
              <div
                role="status"
                className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-sm text-slate-500"
              >
                <LoaderCircle size={18} className="animate-spin" />
                Loading feedback…
              </div>
            )}
          </div>
        </dialog>
      )}
    </FeedbackContext.Provider>
  );
}
export function FeedbackButton({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const open = useContext(FeedbackContext);
  if (!open) throw new Error("FeedbackButton requires FeedbackProvider");
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={className}
      onClick={() => {
        onClick?.();
        open();
      }}
    >
      {children}
    </button>
  );
}
export function FeedbackEntry() {
  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-8 shadow-sm">
      <h2 className="text-2xl font-bold">
        How has your experience with KingsHire been?
      </h2>
      <p className="mt-4 leading-7 text-slate-500">
        Tell us what you liked, what was difficult, or anything else you’d like
        to share.
      </p>
      <FeedbackButton className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white hover:bg-blue-700">
        Give feedback
      </FeedbackButton>
    </section>
  );
}
