/**
 * ブラウザ標準の音声認識と読み上げ。
 *
 * 音声を別APIへアップロードせず、認識結果を既存のテキスト商談経路へ渡す。
 * 認識精度の補正はここへ混ぜず、必要になった時点で別の改善として扱う。
 */

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = Event & {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type RecognitionErrorEvent = Event & { error?: string };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type RecognitionConstructor = new () => Recognition;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

export function isBrowserSpeechRecognitionSupported(): boolean {
  return recognitionConstructor() !== null;
}

const RESULT_STABLE_MS = 400;
const MAX_FINALIZE_WAIT_MS = 2_000;

export class BrowserSpeechRecognizer {
  private recognition: Recognition | null = null;
  private finalText = "";
  private interimText = "";
  private resolveResult: ((text: string) => void) | null = null;
  private rejectResult: ((error: Error) => void) | null = null;
  private resultPromise: Promise<string> | null = null;
  private settled = false;
  private stopRequested = false;
  private stableTimer: number | null = null;
  private hardStopTimer: number | null = null;

  constructor(private readonly onUpdate?: (text: string) => void) {}

  start(): void {
    const Ctor = recognitionConstructor();
    if (!Ctor) throw new Error("このブラウザは音声認識に対応していません。");

    const recognition = new Ctor();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result?.[0]?.transcript ?? "";
        if (result?.isFinal) this.finalText += transcript;
        else interim += transcript;
      }
      this.interimText = interim;
      this.onUpdate?.(`${this.finalText}${this.interimText}`.trim());
      if (this.stopRequested) {
        this.scheduleStableFinish();
      }
    };
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "マイクの使用が許可されていません。",
        "audio-capture": "マイクから音声を取得できませんでした。",
        network: "ブラウザの音声認識に接続できませんでした。",
        "no-speech": "音声を聞き取れませんでした。",
      };
      this.reject(messages[event.error ?? ""] ?? "音声認識に失敗しました。");
    };
    recognition.onend = () => this.finish();

    this.finalText = "";
    this.interimText = "";
    this.settled = false;
    this.stopRequested = false;
    this.resultPromise = new Promise<string>((resolve, reject) => {
      this.resolveResult = resolve;
      this.rejectResult = reject;
    });
    // エラーが録音終了前に発生しても、stop() が回収するまで未処理拒否にしない。
    void this.resultPromise.catch(() => undefined);
    this.recognition = recognition;
    recognition.start();
  }

  async stop(): Promise<string> {
    const result = this.resultPromise;
    if (!result) throw new Error("音声認識が開始されていません。");
    const recognition = this.recognition;
    this.stopRequested = true;
    recognition?.stop();
    // Chromeの音声認識は、stop()後もonendを数十秒返さないことがある。
    // 固定時間で切ると末尾の認識結果を落とすため、結果が更新されるたびに待ち直し、
    // 文字列が安定した時点で確定する。サービス停止時だけ2秒を上限にする。
    this.hardStopTimer = window.setTimeout(
      () => this.forceFinish(recognition),
      MAX_FINALIZE_WAIT_MS,
    );
    try {
      return await result;
    } finally {
      this.clearFinalizeTimers();
      this.resultPromise = null;
    }
  }

  cancel(): void {
    this.recognition?.abort();
    this.reject("音声認識を中止しました。");
  }

  private finish(): void {
    if (this.settled) return;
    const text = `${this.finalText}${this.interimText}`.trim();
    if (!text) {
      this.reject("音声を聞き取れませんでした。もう一度話してください。");
      return;
    }
    this.settled = true;
    this.resolveResult?.(text);
    this.cleanup();
  }

  private scheduleStableFinish(): void {
    if (this.settled) return;
    if (this.stableTimer !== null) window.clearTimeout(this.stableTimer);
    this.stableTimer = window.setTimeout(() => {
      this.forceFinish(this.recognition);
    }, RESULT_STABLE_MS);
  }

  private forceFinish(recognition: Recognition | null): void {
    if (this.settled) return;
    this.finish();
    // finish()でsettledにしてから中断することで、abort由来のerrorを無視する。
    recognition?.abort();
  }

  private reject(message: string): void {
    if (this.settled) return;
    this.settled = true;
    this.rejectResult?.(new Error(message));
    this.cleanup();
  }

  private cleanup(): void {
    this.clearFinalizeTimers();
    this.stopRequested = false;
    this.recognition = null;
    this.resolveResult = null;
    this.rejectResult = null;
  }

  private clearFinalizeTimers(): void {
    if (this.stableTimer !== null) window.clearTimeout(this.stableTimer);
    if (this.hardStopTimer !== null) window.clearTimeout(this.hardStopTimer);
    this.stableTimer = null;
    this.hardStopTimer = null;
  }
}
