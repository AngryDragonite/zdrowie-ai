import { useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileDown,
  HeartPulse,
  LoaderCircle,
  Mic,
  Pencil,
  Pause,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import "./App.css";
import { analyseRecordings as requestAnalysis } from "./services/analysis";

type Step = "welcome" | "record" | "summary";
type Recording = { id: string; blob: Blob; url: string; duration: number };

const demoInsights = [
  "Odczuwasz obniżony nastrój i trudniej jest Ci czerpać przyjemność z codziennych aktywności.",
  "Towarzyszy Ci napięcie lub niepokój, które wpływają na codzienne funkcjonowanie.",
  "Warto porozmawiać z lekarzem o jakości snu, poziomie energii i czasie trwania tych objawów.",
];

function App() {
  const [step, setStep] = useState<Step>("welcome");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [insights, setInsights] = useState<string[]>([]);
  const [editingInsightIndex, setEditingInsightIndex] = useState<number | null>(
    null,
  );
  const [draftInsight, setDraftInsight] = useState("");
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const startedAtRef = useRef(0);

  const startRecording = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ta przeglądarka nie udostępnia nagrywania audio.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, {
          type: recorder.mimeType || "audio/webm",
        });
        setRecordings((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            blob,
            url: URL.createObjectURL(blob),
            duration: Math.max(
              1,
              Math.round((Date.now() - startedAtRef.current) / 1000),
            ),
          },
        ]);
        stream.getTracks().forEach((track) => track.stop());
      };
      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setIsRecording(true);
    } catch {
      setError(
        "Nie udało się uzyskać dostępu do mikrofonu. Sprawdź uprawnienia przeglądarki.",
      );
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
  };
  const removeRecording = (id: string) =>
    setRecordings((current) => {
      const recording = current.find((item) => item.id === id);
      if (recording) URL.revokeObjectURL(recording.url);
      return current.filter((item) => item.id !== id);
    });
  const analyseRecordings = async () => {
    setIsAnalysing(true);
    try {
      setInsights(
        await requestAnalysis(recordings.map((recording) => recording.blob)),
      );
    } catch {
      setInsights(demoInsights);
    } finally {
      setIsAnalysing(false);
      setStep("summary");
    }
  };
  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFontSize(22);
    pdf.text("Moje samopoczucie", 20, 25);
    pdf.setFontSize(11);
    pdf.text("Lista tematow do omowienia z lekarzem psychiatra", 20, 34);
    insights.forEach((insight, index) =>
      pdf.text(
        pdf.splitTextToSize(`${index + 1}. ${insight}`, 165),
        20,
        52 + index * 22,
      ),
    );
    pdf.save("moje-samopoczucie.pdf");
  };
  const reset = () => {
    recordings.forEach((recording) => URL.revokeObjectURL(recording.url));
    setRecordings([]);
    setInsights([]);
    setEditingInsightIndex(null);
    setDraftInsight("");
    setStep("welcome");
  };
  const startEditingInsight = (index: number) => {
    setEditingInsightIndex(index);
    setDraftInsight(insights[index]);
  };
  const saveInsight = () => {
    if (editingInsightIndex === null || !draftInsight.trim()) return;
    setInsights((current) =>
      current.map((insight, index) =>
        index === editingInsightIndex ? draftInsight.trim() : insight,
      ),
    );
    setEditingInsightIndex(null);
    setDraftInsight("");
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={reset} aria-label="Wróć na początek">
          <span className="brand-mark">
            <HeartPulse size={19} />
          </span>
          <span>dobrze.mi</span>
        </button>
        <div className="progress" aria-label="Postęp">
          <span className={step === "welcome" ? "active" : "done"}>1</span>
          <span
            className={
              step === "record" ? "active" : step === "summary" ? "done" : ""
            }
          >
            2
          </span>
          <span className={step === "summary" ? "active" : ""}>3</span>
        </div>
      </header>
      {step === "welcome" && (
        <section className="hero screen">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" /> Twoja przestrzeń do szczerej
              rozmowy
            </p>
            <h1>
              Opisz, jak się czujesz.
              <br />
              <em>My pomożemy to uporządkować.</em>
            </h1>
            <p className="lead">
              Zbierz swoje myśli w jednym miejscu, żeby łatwiej było Ci
              przedstawić je lekarzowi psychiatrii.
            </p>
            <button
              className="primary-button"
              onClick={() => setStep("record")}
            >
              Zaczynajmy <span>↗</span>
            </button>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-orbit orbit-one" />
            <div className="art-orbit orbit-two" />
            <div className="art-core">
              <HeartPulse size={55} strokeWidth={1.3} />
            </div>
            <span className="art-note note-one">Twoje tempo</span>
            <span className="art-note note-two">Twoje słowa</span>
          </div>
        </section>
      )}
      {step === "record" && (
        <section className="record-screen screen">
          <div className="section-heading">
            <p className="eyebrow">
              <span className="eyebrow-dot" /> Etap 02 / Zatrzymaj się na chwilę
            </p>
            <h2>Opisz, jak się czujesz</h2>
            <p>
              Nie musisz niczego przygotowywać. Mów własnymi słowami, w swoim
              tempie.
            </p>
          </div>
          <div className={`record-center ${isRecording ? "recording" : ""}`}>
            <div className="wave-field">
              {[...Array(18)].map((_, index) => (
                <i key={index} style={{ animationDelay: `${index * 0.06}s` }} />
              ))}
            </div>
            <button
              className="mic-button"
              onClick={() => (isRecording ? stopRecording() : startRecording())}
              aria-label={
                isRecording ? "Zakończ nagrywanie" : "Rozpocznij nagrywanie"
              }
            >
              {isRecording ? (
                <Pause size={35} fill="currentColor" />
              ) : (
                <Mic size={38} />
              )}
            </button>
            <span className="record-label">
              {isRecording ? "Nagrywanie trwa..." : "Dotknij, aby mówić"}
            </span>
            {isRecording && (
              <span className="timer">
                <span /> LIVE
              </span>
            )}
          </div>
          {error && <p className="error-message">{error}</p>}
          {recordings.length > 0 && (
            <div className="recordings">
              <div className="list-heading">
                <span>
                  Twoje nagrania <b>{recordings.length}</b>
                </span>
                <small>Możesz dodać ich więcej</small>
              </div>
              {recordings.map((recording, index) => (
                <RecordingItem
                  key={recording.id}
                  recording={recording}
                  index={index}
                  onRemove={removeRecording}
                />
              ))}
              <button
                className="analyse-button"
                onClick={analyseRecordings}
                disabled={isAnalysing}
              >
                {isAnalysing ? (
                  <>
                    <LoaderCircle className="spin" size={18} /> Analizuję...
                  </>
                ) : (
                  <>
                    Przeanalizuj moje nagrania{" "}
                    <ArrowLeft size={18} className="arrow-forward" />
                  </>
                )}
              </button>
            </div>
          )}
          {recordings.length === 0 && (
            <button className="text-button" onClick={() => setStep("welcome")}>
              <ArrowLeft size={16} /> Wróć do początku
            </button>
          )}
        </section>
      )}
      {step === "summary" && (
        <section className="summary-screen screen">
          <div className="summary-header">
            <div>
              <p className="eyebrow">
                <span className="eyebrow-dot" /> Etap 03 / Twój skrót
              </p>
              <h2>
                To warto omówić
                <br />
                <em>z lekarzem.</em>
              </h2>
            </div>
            <div className="summary-actions">
              <button
                className="secondary-button"
                onClick={() => setStep("record")}
              >
                <Plus size={17} /> Dodaj nagranie
              </button>
              <button className="primary-button compact" onClick={downloadPdf}>
                <FileDown size={17} /> Pobierz PDF
              </button>
            </div>
          </div>
          <div className="notice">
            <Check size={18} />
            <span>
              To nie jest diagnoza. Ta lista ma pomóc Ci rozpocząć rozmowę ze
              specjalistą.
            </span>
          </div>
          <ol className="insights">
            {insights.map((insight, index) => (
              <li key={`${index}-${insight}`}>
                <span className="insight-number">0{index + 1}</span>
                {editingInsightIndex === index ? (
                  <div className="insight-editing">
                    <textarea
                      className="insight-input"
                      value={draftInsight}
                      onChange={(event) => setDraftInsight(event.target.value)}
                      aria-label={`Edytuj problem ${index + 1}`}
                      autoFocus
                      rows={3}
                    />
                    <div className="insight-edit-actions">
                      <button
                        className="insight-save-button"
                        onClick={saveInsight}
                        disabled={!draftInsight.trim()}
                      >
                        Zapisz
                      </button>
                      <button
                        className="insight-cancel-button"
                        onClick={() => setEditingInsightIndex(null)}
                      >
                        Anuluj
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="insight-content">
                    <p>{insight}</p>
                    <button
                      className="insight-edit-button"
                      onClick={() => startEditingInsight(index)}
                      aria-label={`Edytuj problem ${index + 1}`}
                    >
                      <Pencil size={15} /> Edytuj
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
          <button className="text-button" onClick={reset}>
            <ArrowLeft size={16} /> Zacznij od nowa
          </button>
        </section>
      )}
      <footer>
        Twoje dane zostają z Tobą <span>•</span> Przygotowanie do rozmowy, nie
        diagnoza
      </footer>
    </main>
  );
}

function RecordingItem({
  recording,
  index,
  onRemove,
}: {
  recording: Recording;
  index: number;
  onRemove: (id: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const toggle = () => {
    if (playing) audioRef.current?.pause();
    else audioRef.current?.play();
    setPlaying(!playing);
  };
  return (
    <div className="recording-item">
      <button
        className="play-button"
        onClick={toggle}
        aria-label={playing ? "Pauza" : "Odtwórz"}
      >
        {playing ? (
          <Pause size={15} fill="currentColor" />
        ) : (
          <Play size={15} fill="currentColor" />
        )}
      </button>
      <div className="recording-meta">
        <strong>Nagranie {index + 1}</strong>
        <span>
          {recording.duration}s{" "}
          <audio
            ref={audioRef}
            src={recording.url}
            onEnded={() => setPlaying(false)}
          />
        </span>
      </div>
      <div className="mini-wave">
        {[...Array(16)].map((_, item) => (
          <i key={item} style={{ height: `${8 + ((item * 13) % 17)}px` }} />
        ))}
      </div>
      <button
        className="delete-button"
        onClick={() => onRemove(recording.id)}
        aria-label={`Usuń nagranie ${index + 1}`}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}

export default App;
