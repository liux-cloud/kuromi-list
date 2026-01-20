"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

const getDatabaseInstance = () => {
  if (!hasFirebaseConfig) {
    return null;
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  return getDatabase(app);
};

const createRoomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `room-${Math.random().toString(36).slice(2, 10)}`;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room");

  const [roomId, setRoomId] = useState<string | null>(null);
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
    if (roomParam) {
      setRoomId(roomParam);
      return;
    }

    const nextRoom = createRoomId();
    setRoomId(nextRoom);
    router.replace(`${pathname}?room=${nextRoom}`);
  }, [pathname, roomParam, router]);

  useEffect(() => {
    if (!roomId || !hasFirebaseConfig) {
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
    if (!roomId || !origin) {
      return "";
    }

    return `${origin}${pathname}?room=${roomId}`;
  }, [origin, pathname, roomId]);

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
      <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[560px] w-[150%] -translate-x-1/2 -translate-y-[40%] rounded-[100%] bg-[#f7f1ff] sm:h-[660px] md:h-[740px]" />
      <div className="pointer-events-none absolute inset-0 z-0 kuromi-candy-pattern opacity-50" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[220px] -translate-x-1/2 translate-y-6 sm:w-[280px] sm:translate-y-8 md:w-[360px] lg:w-[420px]">
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
      <div className="relative z-10 min-h-screen w-full px-6 py-12 sm:px-10">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <header className="flex flex-col gap-4 pt-8">
            <div className="flex flex-wrap items-center gap-3 text-sm uppercase tracking-[0.35em] text-[#5b2aaa]">
              <span className="rounded-full border border-[#bfa7ff] bg-white/70 px-4 py-1 text-[#5b2aaa]">
                Kuromi List
              </span>
              <span className="text-[#d065a8]">Realtime Gothic-Pastel</span>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl leading-tight text-[#2a1248] sm:text-5xl">
                  Shareable shopping magic with a Kuromi edge.
                </h1>
                <p className="mt-3 max-w-2xl text-base text-[#5b2aaa]">
                  Add, check, and delete items while your friends see updates
                  instantly. Drop the room link to invite anyone.
                </p>
              </div>
              <div className="rounded-2xl border border-[#bfa7ff] bg-white/80 px-4 py-3 text-sm text-[#5b2aaa] shadow-[0_10px_30px_rgba(107,44,255,0.18)] backdrop-blur-sm">
                Room:{" "}
                <span className="font-semibold text-[#2a1248]">
                  {roomId ?? "Generating..."}
                </span>
              </div>
            </div>
          </header>

          <section className="relative overflow-hidden rounded-[32px] border border-[#6b2cff]/40 bg-black/60 shadow-[0_35px_80px_rgba(11,6,20,0.65)]">
            <div className="absolute inset-0 kuromi-pattern opacity-60" />
            <div className="absolute inset-0 border border-[#8c4bff]/45 glow-pulse" />
            <div className="relative z-10 flex flex-col gap-6 p-6 sm:p-10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <form
                  onSubmit={handleAdd}
                  className="flex w-full flex-col gap-4 md:flex-row"
                >
                  <input
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    placeholder="What should we take home?"
                    className="h-14 flex-1 rounded-2xl border border-[#6b2cff]/60 bg-black/60 px-5 text-lg text-[#f8f4ff] placeholder:text-[#c6a6ff]/70 focus:border-[#f5b0de] focus:outline-none focus:ring-2 focus:ring-[#f5b0de]/40"
                    disabled={!hasFirebaseConfig}
                  />
                  <div className="flex items-center gap-3 rounded-2xl border border-[#6b2cff]/60 bg-black/60 px-4 text-[#f8f4ff]">
                    <span className="text-sm uppercase tracking-[0.2em] text-[#c6a6ff]">
                      Qty
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={inputQuantity}
                      onChange={(event) => setInputQuantity(event.target.value)}
                      className="h-12 w-20 bg-transparent text-lg text-[#f8f4ff] focus:outline-none"
                      disabled={!hasFirebaseConfig}
                    />
                  </div>
                  <button
                    type="submit"
                    className="flex h-14 items-center justify-center gap-3 rounded-2xl bg-[#6b2cff] px-6 text-base font-semibold text-white shadow-[0_0_18px_rgba(140,75,255,0.6)] transition hover:bg-[#8c4bff]"
                    disabled={!hasFirebaseConfig}
                  >
                    <SkullIcon className="h-6 w-6 text-white" />
                    Add Item
                  </button>
                </form>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="h-12 rounded-2xl border border-[#f5b0de]/50 px-5 text-sm font-semibold text-[#f5b0de] transition hover:border-[#f5b0de] hover:text-white"
                  disabled={!hasFirebaseConfig || items.length === 0}
                >
                  Clear All
                </button>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-4 text-sm text-[#c6a6ff]">
                  <span>{items.length} items</span>
                  <span>{remainingCount} remaining</span>
                  {isLoading && <span>Syncing...</span>}
                </div>
                <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
                  <input
                    readOnly
                    value={shareLink || "Preparing share link..."}
                    className="h-11 w-full rounded-xl border border-[#6b2cff]/40 bg-black/70 px-4 text-sm text-[#f8f4ff]/80 md:w-[320px]"
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="h-11 rounded-xl bg-[#f5b0de] px-4 text-sm font-semibold text-[#1a0f2e] transition hover:bg-[#f8c8ee]"
                    disabled={!shareLink}
                  >
                    {copyState === "copied" ? "Copied!" : "Copy Link"}
                  </button>
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
                        className={`flex items-center gap-4 rounded-2xl border border-[#6b2cff]/30 bg-[#c6a6ff]/10 px-4 py-3 text-[#f8f4ff] shadow-[0_12px_30px_rgba(11,6,20,0.35)] transition ${
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
                          className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                            item.completed
                              ? "border-[#8c4bff] bg-[#8c4bff] text-white shadow-[0_0_16px_rgba(140,75,255,0.8)]"
                              : "border-[#c6a6ff]/50 bg-black/60 text-[#c6a6ff]"
                          }`}
                        >
                          <SkullIcon className="h-6 w-6" />
                        </button>
                        <div className="flex-1">
                          <p
                            className={`text-lg ${
                              item.completed
                                ? "text-[#c6a6ff] line-through opacity-60"
                                : "text-[#f8f4ff]"
                            }`}
                          >
                            {item.text}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item, Math.max(1, item.quantity - 1))
                            }
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#6b2cff]/50 text-[#c6a6ff] transition hover:border-[#f5b0de] hover:text-[#f5b0de]"
                            aria-label={`Decrease quantity for ${item.text}`}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={quantityDrafts[item.id] ?? String(item.quantity)}
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
                            className="h-9 w-16 rounded-lg border border-[#6b2cff]/40 bg-black/60 px-2 text-center text-sm text-[#f8f4ff] focus:border-[#f5b0de] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQuantity(item, item.quantity + 1)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#6b2cff]/50 text-[#c6a6ff] transition hover:border-[#f5b0de] hover:text-[#f5b0de]"
                            aria-label={`Increase quantity for ${item.text}`}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#f5b0de]/50 text-[#f5b0de] transition hover:border-[#f5b0de] hover:text-white"
                          aria-label={`Delete ${item.text}`}
                        >
                          <SkullIcon className="h-5 w-5" />
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
    </div>
  );
}
