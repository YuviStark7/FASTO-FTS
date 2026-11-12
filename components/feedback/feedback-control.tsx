"use client";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { getMyFeedback, saveFeedback, type FeedbackTarget, type Rating } from "@/app/[locale]/(app)/feedback-actions";

const RATINGS: Rating[] = ["right", "partly_right", "wrong"];

export function FeedbackControl({ targetType, targetId }: { targetType: FeedbackTarget; targetId: number }) {
  const t = useTranslations("feedback");
  const id = useId();
  const [state, setState] = useState<"loading" | "viewer" | "ready">("loading");
  const [rating, setRating] = useState<Rating | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    getMyFeedback(targetType, targetId)
      .then((f) => {
        if (!live) return;
        setRating(f.rating);
        setComment(f.comment);
        setState(f.canWrite ? "ready" : "viewer");
      })
      .catch(() => {
        if (live) setState("ready");
      });
    return () => {
      live = false;
    };
  }, [targetType, targetId]);

  function submit(next: Rating) {
    const previous = rating;
    setRating(next); // optimistic
    setStatus("idle");
    start(async () => {
      const r = await saveFeedback(targetType, targetId, next, comment).catch(() => ({ ok: false }));
      if (r.ok) setStatus("saved");
      else {
        setRating(previous); // rollback
        setStatus("error");
      }
    });
  }

  const question = targetType === "csi_snapshot" ? t("csiQuestion") : t("briefQuestion");
  return (
    <div className="mt-6 border-t border-border pt-5" data-testid="feedback-control">
      <p id={`${id}-q`} className="text-sm font-medium">{question}</p>
      {state === "loading" && <p className="mt-2 text-sm text-muted" role="status">{t("loading")}</p>}
      {state === "viewer" && <p className="mt-2 text-sm text-muted">{t("viewer")}</p>}
      {state === "ready" && (
        <>
          <div role="group" aria-labelledby={`${id}-q`} className="mt-2 flex flex-wrap gap-2">
            {RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={rating === r}
                disabled={pending}
                onClick={() => submit(r)}
                className={`btn px-4 ${rating === r ? "btn-primary" : "btn-quiet"}`}
              >
                {rating === r && <Check aria-hidden strokeWidth={2.5} className="-ml-0.5 size-4" />}
                {t(r)}
              </button>
            ))}
          </div>
          <div className="mt-3">
            <label htmlFor={`${id}-c`} className="t-label">{t("commentLabel")}</label>
            <textarea
              id={`${id}-c`}
              value={comment}
              maxLength={2000}
              rows={3}
              onChange={(e) => setComment(e.target.value)}
              className="field mt-1.5 bg-surface-2 text-sm"
            />
            <button
              type="button"
              disabled={pending || rating == null}
              onClick={() => rating && submit(rating)}
              className="btn btn-ghost mt-2"
            >
              {t("send")}
            </button>
          </div>
          <p role="status" className="mt-2 min-h-5 text-sm text-muted">
            {status === "saved" && t("saved")}
            {status === "error" && t("error")}
          </p>
        </>
      )}
    </div>
  );
}
