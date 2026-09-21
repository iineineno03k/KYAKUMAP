"use client";

import {
  ArrowRight,
  BookOpenText,
  Keyboard,
  LoaderCircle,
  Mic,
  MicOff,
  Send,
  SquareArrowOutUpRight,
  Volume2,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import { BrowserSpeechRecognizer } from "@/lib/browser-speech";

type Evidence = {
  evidenceId: string;
  sourceTitle: string;
  sourceAuthor: string;
  sourceUrl: string | null;
  quote: string;
};
type SuggestedPerson = {
  entityId: string;
  name: string;
  description: string;
  pathReason: string;
  href: string | null;
};
type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  status?: "known" | "partial" | "unknown";
  evidence?: Evidence[];
  suggestedPeople?: SuggestedPerson[];
};
type Reply = {
  status: "known" | "partial" | "unknown";
  answer: string;
  evidence: Evidence[];
  suggestedPeople: SuggestedPerson[];
  speech: { voice: string; delivery: string; mode: "browser" | "api" };
};

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function CustomerAiChat({
  customerId,
  customerName,
  customerImageUrl,
  sectionId,
  suggestedQuestions = [],
}: {
  customerId: string;
  customerName: string;
  customerImageUrl: string;
  sectionId: string;
  suggestedQuestions?: string[];
}) {
  const inputId = useId();
  const titleId = useId();
  const sessionId = useRef(`customer-${customerId}-${id()}`);
  const recognizerRef = useRef<BrowserSpeechRecognizer | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [liveTranscript, setLiveTranscript] = useState("");
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [audioReplayReady, setAudioReplayReady] = useState(false);
  const latestUserTurn = [...turns].reverse().find((turn) => turn.role === "user") ?? null;
  const latestReply = [...turns].reverse().find((turn) => turn.role === "assistant") ?? null;
  const questions = [
    ...suggestedQuestions,
    "仕事をするうえで、一番大事にしていることは何ですか？",
    "私がまだ知らないことで、確認しておいた方がいいことはありますか？",
  ].slice(0, 4);

  const openConversation = () => {
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setOpen(true);
  };

  const stopAudio = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setSpeaking(false);
    setAudioReplayReady(false);
  };

  const logAudioFailure = (phase: "autoplay" | "manual" | "decode", caught: unknown) => {
    const reason = caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught);
    void fetch("/api/client-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "audio_playback_failed",
        phase,
        reason,
        customerId,
        sessionId: sessionId.current,
      }),
      keepalive: true,
    }).catch(() => undefined);
  };

  const closeConversation = () => {
    recognizerRef.current?.cancel();
    recognizerRef.current = null;
    setRecording(false);
    stopAudio();
    setOpen(false);
    requestAnimationFrame(() => previousFocusRef.current?.focus());
  };

  useEffect(() => {
    const handleSuggestedQuestion = (event: Event) => {
      const question = (event as CustomEvent<string>).detail;
      if (!question) return;
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      setDraft(question);
      setOpen(true);
    };
    window.addEventListener("customer-ai-suggest-question", handleSuggestedQuestion);
    return () =>
      window.removeEventListener("customer-ai-suggest-question", handleSuggestedQuestion);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => micButtonRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const speak = async (reply: Reply, revealReply: () => void) => {
    stopAudio();
    const revealOnce = (() => {
      let revealed = false;
      return () => {
        if (revealed) return;
        revealed = true;
        revealReply();
      };
    })();
    const speakInBrowser = () => {
      if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        revealOnce();
        return;
      }
      const utterance = new SpeechSynthesisUtterance(reply.answer);
      utterance.lang = "ja-JP";
      utterance.rate = 0.95;
      utterance.onstart = () => {
        revealOnce();
        setSpeaking(true);
      };
      const finish = () => setSpeaking(false);
      utterance.onend = finish;
      utterance.onerror = () => {
        revealOnce();
        finish();
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    };
    if (reply.speech.mode === "browser") {
      speakInBrowser();
      return;
    }
    const response = await fetch("/api/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: reply.answer,
        voice: reply.speech.voice,
        delivery: reply.speech.delivery,
      }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string;
        fallback?: string;
      } | null;
      if (body?.fallback === "browser") {
        speakInBrowser();
        return;
      }
      revealOnce();
      throw new Error(body?.error ?? "音声を作れませんでした。回答は文字で表示しています。");
    }
    const url = URL.createObjectURL(await response.blob());
    const audio = new Audio(url);
    audioRef.current = audio;
    audioUrlRef.current = url;
    const finish = () => {
      if (audioRef.current !== audio) return;
      audioRef.current = null;
      URL.revokeObjectURL(url);
      audioUrlRef.current = null;
      setSpeaking(false);
    };
    audio.onplaying = () => {
      revealOnce();
      setSpeaking(true);
    };
    audio.onended = finish;
    audio.onerror = () => {
      revealOnce();
      logAudioFailure("decode", "音声データを再生できませんでした");
      setError("音声データを再生できませんでした。回答は文字で表示しています。");
      finish();
    };
    await audio.play().catch((caught: unknown) => {
      revealOnce();
      logAudioFailure("autoplay", caught);
      setSpeaking(false);
      setAudioReplayReady(true);
      setError("スマホの自動再生が止められました。「音声を再生」をタップしてください。");
    });
  };

  const playPreparedAudio = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    setAudioReplayReady(false);
    try {
      await audio.play();
    } catch (caught) {
      logAudioFailure("manual", caught);
      setAudioReplayReady(true);
      setError("音声を再生できませんでした。端末の音量とブラウザ設定を確認してください。");
    }
  };

  const ask = async (question: string) => {
    const clean = question.trim();
    if (!clean || busy) return;
    const userTurn: Turn = { id: id(), role: "user", text: clean };
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setDraft("");
    setLiveTranscript("");
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextTurns.slice(-12).map(({ role, text }) => ({ role, text })),
          sessionId: sessionId.current,
        }),
      });
      const body = (await response.json().catch(() => null)) as (Reply & { error?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.error ?? "返事を受け取れませんでした");
      const replyTurn: Turn = {
        id: id(),
        role: "assistant",
        text: body.answer,
        status: body.status,
        evidence: body.evidence,
        suggestedPeople: body.suggestedPeople,
      };
      await speak(body, () => setTurns([...nextTurns, replyTurn]));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "返事を受け取れませんでした");
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void ask(draft);
  };

  const startRecording = () => {
    if (busy || recording) return;
    stopAudio();
    setError(null);
    setLiveTranscript("");
    const recognizer = new BrowserSpeechRecognizer(setLiveTranscript);
    recognizerRef.current = recognizer;
    try {
      recognizer.start();
      setRecording(true);
    } catch (caught) {
      recognizerRef.current = null;
      setError(caught instanceof Error ? caught.message : "マイクを開始できませんでした");
    }
  };

  const stopRecording = async () => {
    const recognizer = recognizerRef.current;
    if (!recognizer) return;
    recognizerRef.current = null;
    setRecording(false);
    try {
      const text = await recognizer.stop();
      await ask(text);
    } catch (caught) {
      setLiveTranscript("");
      setError(caught instanceof Error ? caught.message : "音声を聞き取れませんでした");
    }
  };

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      closeConversation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <>
      <button type="button" className="customer-talk-launch" onClick={openConversation}>
        <span className="customer-talk-launch-icon">
          <Mic className="size-5" aria-hidden="true" />
        </span>
        <span>
          <strong>記録AIに聞く</strong>
          <small>{customerName}さんについて</small>
        </span>
      </button>

      {open ? (
        <div className="customer-talk-overlay">
          <div
            id={sectionId}
            ref={dialogRef}
            className="customer-talk-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
          >
            <header className="customer-talk-header">
              <div>
                <p>根拠つき顧客情報</p>
                <h2 id={titleId}>{customerName}さんの記録AI</h2>
              </div>
              <button type="button" onClick={closeConversation} aria-label="会話を閉じる">
                <X aria-hidden="true" />
              </button>
            </header>

            <div className="customer-talk-body">
              <div
                className={`customer-talk-portrait${recording ? " is-listening" : ""}${speaking ? " is-speaking" : ""}`}
              >
                <Image
                  src={customerImageUrl}
                  alt=""
                  fill
                  className="object-cover object-[center_25%]"
                  sizes="144px"
                />
                <span aria-hidden="true" />
              </div>

              <div className="customer-talk-state" aria-live="polite" aria-busy={busy}>
                {recording ? (
                  <>
                    <strong>聞いています</strong>
                    <p>{liveTranscript || "話してください…"}</p>
                  </>
                ) : busy ? (
                  <>
                    <strong>
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      社内記録を確認しています
                    </strong>
                    <p>音声の準備ができたら回答を始めます</p>
                  </>
                ) : speaking ? (
                  <>
                    <strong>
                      <Volume2 className="size-4" aria-hidden="true" />
                      回答中
                    </strong>
                    <p>{customerName}さんの人物設定に合う合成音声です</p>
                  </>
                ) : (
                  <>
                    <strong>{turns.length ? "続けて聞けます" : "何を聞きますか？"}</strong>
                    <p>マイクをタップして話してください</p>
                  </>
                )}
              </div>

              {latestUserTurn && busy ? (
                <p className="customer-talk-question">「{latestUserTurn.text}」</p>
              ) : null}

              {audioReplayReady && latestReply && !busy ? (
                <button
                  type="button"
                  className="customer-talk-replay"
                  onClick={() => void playPreparedAudio()}
                >
                  <Volume2 className="size-4" aria-hidden="true" />
                  音声を再生
                </button>
              ) : null}

              {latestReply && !busy ? (
                <article className="customer-talk-answer">
                  <p className="customer-talk-speaker">{customerName}さんの記録AI</p>
                  <p>{latestReply.text}</p>
                  {latestReply.evidence?.length ? (
                    <details className="customer-talk-evidence">
                      <summary>
                        <BookOpenText className="size-3.5" aria-hidden="true" /> 根拠を見る
                      </summary>
                      {latestReply.evidence.map((item) => (
                        <div key={item.evidenceId}>
                          <strong>
                            {item.sourceUrl ? (
                              <a
                                href={item.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 underline decoration-indigo-950/25 underline-offset-2 hover:decoration-indigo-950"
                              >
                                {item.sourceTitle}
                                <SquareArrowOutUpRight className="size-3" aria-hidden="true" />
                              </a>
                            ) : (
                              item.sourceTitle
                            )}{" "}
                            / {item.sourceAuthor}
                          </strong>
                          <p>{item.quote}</p>
                        </div>
                      ))}
                    </details>
                  ) : null}
                  {latestReply.suggestedPeople?.length ? (
                    <div className="customer-talk-people">
                      <p>この人なら知っているかも</p>
                      {latestReply.suggestedPeople.map((person) =>
                        person.href ? (
                          <Link key={person.entityId} href={person.href}>
                            <span>
                              <strong>{person.name}</strong>
                              <small>{person.pathReason}</small>
                            </span>
                            <ArrowRight className="size-4" aria-hidden="true" />
                          </Link>
                        ) : (
                          <div key={person.entityId}>
                            <span>
                              <strong>{person.name}</strong>
                              <small>{person.pathReason}</small>
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}
                </article>
              ) : null}

              {!busy && !recording ? (
                <div className="customer-talk-suggestions">
                  <p>{turns.length ? "次に聞くなら" : "例えば"}</p>
                  <div>
                    {questions.slice(0, turns.length ? 2 : 4).map((question) => (
                      <button key={question} type="button" onClick={() => void ask(question)}>
                        {question}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="customer-talk-controls">
              <button
                ref={micButtonRef}
                type="button"
                className={recording ? "customer-talk-mic is-recording" : "customer-talk-mic"}
                onClick={() => void (recording ? stopRecording() : startRecording())}
                disabled={busy}
                aria-label={recording ? "聞き取りを終了して質問する" : "音声で質問する"}
                aria-pressed={recording}
              >
                {recording ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />}
              </button>
              <p>{recording ? "タップして質問する" : "タップして話す"}</p>
            </div>

            <details className="customer-talk-keyboard" open={draft ? true : undefined}>
              <summary>
                <Keyboard className="size-4" aria-hidden="true" /> キーボードで聞く
              </summary>
              <form onSubmit={submit}>
                <label htmlFor={inputId} className="sr-only">
                  {customerName}さんの記録AIへの質問
                </label>
                <textarea
                  id={inputId}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="聞きたいことを入力"
                  rows={2}
                  disabled={busy || recording}
                />
                <button type="submit" disabled={busy || recording || !draft.trim()}>
                  <Send className="size-4" aria-hidden="true" /> 聞く
                </button>
              </form>
            </details>

            {turns.length > 2 ? (
              <details className="customer-talk-history">
                <summary>これまでの会話メモ</summary>
                <ol>
                  {turns.map((turn) => (
                    <li key={turn.id}>
                      <strong>{turn.role === "user" ? "あなた" : <span>記録AI</span>}</strong>
                      <p>{turn.text}</p>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}

            {error ? (
              <p className="customer-talk-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
