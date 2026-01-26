"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { getApps, initializeApp } from "firebase/app";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  set,
  update,
} from "firebase/database";

type ListItem = {
  id: string;
  text: string;
  completed: boolean;
  quantity: number;
  createdAt: number;
};

type StoredItem = {
  text?: string;
  completed?: boolean;
  quantity?: number;
  createdAt?: number;
};

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

const hasFirebaseConfig =
  firebaseConfig.apiKey.length > 0 &&
  firebaseConfig.authDomain.length > 0 &&
  firebaseConfig.databaseURL.length > 0 &&
  firebaseConfig.projectId.length > 0 &&
  firebaseConfig.appId.length > 0;
const DELETE_ANIMATION_MS = 220;
const ROOM_ID = "global";

const getDatabaseInstance = () => {
  if (!hasFirebaseConfig) {
    return null;
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getDatabase(app);
};

const SkullIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 64 64"
    className={className}
    aria-hidden="true"
    focusable="false"
  >
    <path
      d="M32 6c-13.3 0-24 9.9-24 22.1 0 8.8 5.6 16.5 13.8 20v6.7c0 1.8 1.5 3.2 3.2 3.2h14c1.8 0 3.2-1.4 3.2-3.2V48c8.2-3.5 13.8-11.2 13.8-20C56 15.9 45.3 6 32 6z"
      fill="currentColor"
    />
    <circle cx="22" cy="28" r="6" fill="#0b0614" />
    <circle cx="42" cy="28" r="6" fill="#0b0614" />
    <path
      d="M24 44h16M24 50h16"
      stroke="#0b0614"
      strokeWidth="4"
      strokeLinecap="round"
    />
  </svg>
);

export default function HomeClient() {
  const roomId = ROOM_ID;
  const [items, setItems] = useState<ListItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [inputQuantity, setInputQuantity] = useState("1");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Record<string, boolean>>({});
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>(
    {},
  );
  const [origin, setOrigin] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [pendingDelete, setPendingDelete] = useState<ListItem | null>(null);

  const normalizeQuantity = (value: string | number) => {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }
    return parsed;
  };

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig) {
      setIsLoading(false);
      return;
    }

    const database = getDatabaseInstance();
    if (!database) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const itemsRef = ref(database, `rooms/${roomId}/items`);
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const value = (snapshot.val() ?? {}) as Record<string, StoredItem>;
      const nextItems = Object.entries(value).map(([id, item]) => ({
        id,
        text: item.text ?? "",
        completed: Boolean(item.completed),
        quantity: normalizeQuantity(item.quantity ?? 1),
        createdAt: Number(item.createdAt ?? 0),
      }));

      nextItems.sort((a, b) => a.createdAt - b.createdAt);
      setItems(nextItems);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    setQuantityDrafts((prev) => {
      const next: Record<string, string> = {};
      items.forEach((item) => {
        next[item.id] = prev[item.id] ?? String(item.quantity);
      });
      return next;
    });
  }, [items]);

  const shareLink = useMemo(() => {
    if (!origin) {
      return "";
    }

    return origin;
  }, [origin]);

  const remainingCount = items.filter((item) => !item.completed).length;

  const handleAdd = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!roomId) {
      return;
    }

    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const database = getDatabaseInstance();
    if (!database) {
      return;
    }

    const normalizedText = trimmed.toLowerCase();
    const existing = items.find(
      (item) => item.text.trim().toLowerCase() === normalizedText,
    );
    const quantityToAdd = normalizeQuantity(inputQuantity);

    if (existing) {
      const nextQuantity = existing.quantity + quantityToAdd;
      const itemRef = ref(database, `rooms/${roomId}/items/${existing.id}`);
      await update(itemRef, { quantity: nextQuantity });
      setQuantityDrafts((prev) => ({
        ...prev,
        [existing.id]: String(nextQuantity),
      }));
      setInputValue("");
      setInputQuantity("1");
      return;
    }

    const itemsRef = ref(database, `rooms/${roomId}/items`);
    const newRef = push(itemsRef);
    await set(newRef, {
      text: trimmed,
      completed: false,
      quantity: quantityToAdd,
      createdAt: Date.now(),
    });
    setInputValue("");
    setInputQuantity("1");
  };

  const handleToggle = async (item: ListItem) => {
    if (!roomId) {
      return;
    }

    const database = getDatabaseInstance();
    if (!database) {
      return;
    }

    const itemRef = ref(database, `rooms/${roomId}/items/${item.id}`);
    await update(itemRef, { completed: !item.completed });
  };

  const updateQuantity = async (item: ListItem, nextQuantity: number) => {
    if (!roomId) {
      return;
    }

    const database = getDatabaseInstance();
    if (!database) {
      return;
    }

    if (nextQuantity === item.quantity) {
      setQuantityDrafts((prev) => ({
        ...prev,
        [item.id]: String(nextQuantity),
      }));
      return;
    }

    const itemRef = ref(database, `rooms/${roomId}/items/${item.id}`);
    await update(itemRef, { quantity: nextQuantity });
    setQuantityDrafts((prev) => ({
      ...prev,
      [item.id]: String(nextQuantity),
    }));
  };

  const handleQuantityCommit = async (item: ListItem) => {
    const draftValue = quantityDrafts[item.id] ?? String(item.quantity);
    const nextQuantity = normalizeQuantity(draftValue);
    await updateQuantity(item, nextQuantity);
  };

  const handleDelete = async (itemId: string) => {
    if (!roomId) {
      return;
    }

    const database = getDatabaseInstance();
    if (!database) {
      return;
    }

    setDeletingIds((prev) => ({ ...prev, [itemId]: true }));

    window.setTimeout(async () => {
      try {
        const itemRef = ref(database, `rooms/${roomId}/items/${itemId}`);
        await remove(itemRef);
      } finally {
        setDeletingIds((prev) => {
          const next = { ...prev };
          delete next[itemId];
          return next;
        });
      }
    }, DELETE_ANIMATION_MS);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) {
      return;
    }

    const itemId = pendingDelete.id;
    setPendingDelete(null);
    await handleDelete(itemId);
  };

  const handleClearAll = async () => {
    if (!roomId) {
      return;
    }

    const confirmed = window.confirm(
      "Clear the entire list for everyone in this room?",
    );
    if (!confirmed) {
      return;
    }

    const database = getDatabaseInstance();
    if (!database) {
      return;
    }

    await remove(ref(database, `rooms/${roomId}/items`));
  };

  const handleCopy = async () => {
    if (!shareLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(shareLink);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      window.prompt("Copy this link:", shareLink);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden kuromi-candy-bg">
      <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[380px] w-[150%] -translate-x-1/2 -translate-y-[55%] rounded-[100%] bg-[#f7f1ff] sm:h-[460px] md:h-[520px]" />
      <div className="pointer-events-none absolute inset-0 z-0 kuromi-candy-pattern opacity-50" />
      <div className="pointer-events-none absolute left-2 top-2 z-0 w-[96px] sm:bottom-0 sm:left-1/2 sm:top-auto sm:w-[280px] sm:-translate-x-1/2 sm:translate-y-6 md:w-[360px] lg:w-[420px]">
        <img
          src="/kuromi-bg/3-clean.png"
          alt=""
          aria-hidden="true"
          className="h-auto w-full"
          style={{
            filter:
              "drop-shadow(0 10px 30px rgba(91, 42, 170, 0.2)) drop-shadow(0 0 30px rgba(200, 160, 255, 0.4))",
          }}
        />
      </div>
      <div className="relative z-10 min-h-screen w-full px-6 py-8 sm:px-10 sm:py-12">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <header className="flex flex-col gap-4 pt-4 sm:pt-8">
            <div className="ml-auto flex w-full max-w-[26ch] items-center justify-end text-xs uppercase tracking-[0.3em] text-[#5b2aaa] sm:ml-0 sm:max-w-none sm:justify-start sm:text-sm">
              <span className="rounded-full border border-[#bfa7ff] bg-white/70 px-3 py-1 text-[10px] text-[#5b2aaa] sm:px-4 sm:text-sm">
                Kuromi List
              </span>
            </div>
            <div className="flex w-full flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="w-full">
                <h1 className="ml-auto max-w-[26ch] text-right text-[20px] leading-snug text-[#2a1248] sm:ml-0 sm:max-w-none sm:text-left sm:text-5xl">
                  Shareable shopping magic with a Kuromi edge.
                </h1>
                <p className="mt-3 ml-auto max-w-[26ch] text-right text-[12px] text-[#5b2aaa] sm:ml-0 sm:max-w-2xl sm:text-left sm:text-base">
                  One shared list for everyone. Add, check, and delete items
                  together in real time.
                </p>
              </div>
            </div>
          </header>

          <section className="-mt-6 relative overflow-hidden rounded-[32px] border border-[#6b2cff]/40 bg-black/60 shadow-[0_35px_80px_rgba(11,6,20,0.65)] sm:mt-0">
            <div className="absolute inset-0 kuromi-pattern opacity-60" />
            <div className="absolute inset-0 border border-[#8c4bff]/45 glow-pulse" />
            <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <form
                  onSubmit={handleAdd}
                  className="flex w-full flex-col gap-3 md:flex-row md:items-center"
                >
                  <div className="flex w-full flex-row gap-3 md:flex-1">
                    <input
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      placeholder="What should we take home?"
                      className="h-14 min-w-0 flex-1 rounded-2xl border border-[#6b2cff]/60 bg-black/60 px-5 text-lg text-[#f8f4ff] placeholder:text-[#c6a6ff]/70 focus:border-[#f5b0de] focus:outline-none focus:ring-2 focus:ring-[#f5b0de]/40"
                      disabled={!hasFirebaseConfig}
                    />
                    <div className="flex h-14 w-[120px] items-center gap-3 rounded-2xl border border-[#6b2cff]/60 bg-black/60 px-4 text-[#f8f4ff] sm:w-[140px]">
                      <span className="text-sm uppercase tracking-[0.2em] text-[#c6a6ff]">
                        Qty
                      </span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={inputQuantity}
                        onChange={(event) =>
                          setInputQuantity(event.target.value)
                        }
                        className="h-10 w-12 bg-transparent text-lg text-[#f8f4ff] focus:outline-none"
                        disabled={!hasFirebaseConfig}
                      />
                    </div>
                  </div>
                  <div className="flex w-full max-w-[360px] items-center gap-3 self-center md:w-auto md:max-w-none md:self-auto">
                    <button
                      type="submit"
                      className="flex h-12 flex-1 items-center justify-center gap-3 rounded-2xl bg-[#6b2cff] px-4 text-sm font-semibold text-white shadow-[0_0_18px_rgba(140,75,255,0.6)] transition hover:bg-[#8c4bff] sm:h-14 sm:px-6 sm:text-base"
                      disabled={!hasFirebaseConfig}
                    >
                      <SkullIcon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="h-12 w-[120px] rounded-2xl border border-[#f5b0de]/50 px-4 text-xs font-semibold text-[#f5b0de] transition hover:border-[#f5b0de] hover:text-white sm:h-14 sm:w-[140px] sm:px-5 sm:text-sm"
                      disabled={!hasFirebaseConfig || items.length === 0}
                    >
                      Clear
                    </button>
                  </div>
                </form>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex w-full items-center gap-2">
                  <input
                    readOnly
                    value={shareLink || "Preparing link..."}
                    className="h-9 min-w-0 flex-1 rounded-xl border border-[#6b2cff]/40 bg-black/70 px-3 text-xs text-[#f8f4ff]/80 sm:h-11 sm:px-4 sm:text-sm md:w-[320px]"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="h-9 rounded-xl bg-[#f5b0de] px-3 text-xs font-semibold text-[#1a0f2e] transition hover:bg-[#f8c8ee] sm:h-11 sm:px-4 sm:text-sm"
                    disabled={!shareLink}
                  >
                    {copyState === "copied" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#c6a6ff]">
                  <span>{items.length} items</span>
                  <span>{remainingCount} remaining</span>
                  <span>Shared list</span>
                  {isLoading && <span>Syncing...</span>}
                </div>
              </div>

              {!hasFirebaseConfig && (
                <div className="rounded-2xl border border-[#f5b0de]/50 bg-[#1a0f2e]/70 px-4 py-3 text-sm text-[#f8f4ff]">
                  Firebase config is missing. Add NEXT_PUBLIC_FIREBASE_* values
                  to enable realtime sync.
                </div>
              )}

              <ul className="flex flex-col gap-3">
                {items.length === 0 && !isLoading ? (
                  <li className="rounded-2xl border border-dashed border-[#6b2cff]/40 px-6 py-8 text-center text-[#c6a6ff]">
                    No items yet. Start the chaos with your first Kuromi pick.
                  </li>
                ) : (
                  items.map((item, index) => {
                    const isRemoving = Boolean(deletingIds[item.id]);
                    return (
                      <li
                        key={item.id}
                        className={`grid grid-cols-[32px_minmax(0,1fr)_auto_30px] items-center gap-2 rounded-2xl border border-[#6b2cff]/30 bg-[#c6a6ff]/10 px-4 py-4 text-[#f8f4ff] shadow-[0_12px_30px_rgba(11,6,20,0.35)] transition sm:grid-cols-[48px_minmax(0,1fr)_auto_40px] sm:gap-3 sm:px-4 sm:py-3 ${
                          isRemoving
                            ? "animate-[slideAway_220ms_ease-in_forwards]"
                            : "animate-[floatIn_520ms_ease-out]"
                        }`}
                        style={{ animationDelay: `${index * 60}ms` }}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggle(item)}
                          aria-pressed={item.completed}
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border sm:h-12 sm:w-12 ${
                            item.completed
                              ? "border-[#8c4bff] bg-[#8c4bff] text-white shadow-[0_0_16px_rgba(140,75,255,0.8)]"
                              : "border-[#c6a6ff]/50 bg-black/60 text-[#c6a6ff]"
                          }`}
                        >
                          <SkullIcon className="h-4 w-4 sm:h-6 sm:w-6" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p
                            className={`break-words pr-1 text-[14px] leading-snug sm:text-lg ${
                              item.completed
                                ? "text-[#c6a6ff] line-through opacity-60"
                                : "text-[#f8f4ff]"
                            }`}
                          >
                            {item.text}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-1 sm:gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item,
                                Math.max(1, item.quantity - 1),
                              )
                            }
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#6b2cff]/50 text-[#c6a6ff] transition hover:border-[#f5b0de] hover:text-[#f5b0de] sm:h-8 sm:w-8"
                            aria-label={`Decrease quantity for ${item.text}`}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={
                              quantityDrafts[item.id] ?? String(item.quantity)
                            }
                            onChange={(event) =>
                              setQuantityDrafts((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                            onBlur={() => handleQuantityCommit(item)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                handleQuantityCommit(item);
                              }
                            }}
                            className="h-7 w-9 rounded-lg border border-[#6b2cff]/40 bg-black/60 px-1 text-center text-xs text-[#f8f4ff] focus:border-[#f5b0de] focus:outline-none sm:h-9 sm:w-16 sm:px-2 sm:text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, item.quantity + 1)}
                            className="flex h-6 w-6 items-center justify-center rounded-lg border border-[#6b2cff]/50 text-[#c6a6ff] transition hover:border-[#f5b0de] hover:text-[#f5b0de] sm:h-8 sm:w-8"
                            aria-label={`Increase quantity for ${item.text}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPendingDelete(item)}
                          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[#f5b0de]/50 text-[#f5b0de] transition hover:border-[#f5b0de] hover:text-white sm:h-10 sm:w-10"
                          aria-label={`Delete ${item.text}`}
                        >
                          <SkullIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </section>
        </div>
      </div>
      {pendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
            onClick={() => setPendingDelete(null)}
            aria-label="Close delete confirmation"
          />
          <div className="relative w-full max-w-sm rounded-[28px] border border-[#8c4bff]/50 bg-[#120b24]/95 p-6 text-[#f8f4ff] shadow-[0_20px_40px_rgba(11,6,20,0.7)]">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#6b2cff]/30 text-[#f5b0de] shadow-[0_0_18px_rgba(140,75,255,0.5)]">
                <SkullIcon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-base font-semibold text-[#f8f4ff]">
                  Delete this item?
                </p>
                <p className="mt-1 text-sm text-[#c6a6ff]">
                  &quot;{pendingDelete.text}&quot; will be removed for everyone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-10 rounded-2xl border border-[#8c4bff]/50 px-4 text-sm font-semibold text-[#c6a6ff] transition hover:border-[#f5b0de] hover:text-white"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="h-10 rounded-2xl bg-[#f5b0de] px-4 text-sm font-semibold text-[#1a0f2e] shadow-[0_0_16px_rgba(245,176,222,0.7)] transition hover:bg-[#f8c8ee]"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
