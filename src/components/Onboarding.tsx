import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBrands, useCreateBrand } from "@/hooks/useBrands";
import { useCreatePitch, usePitches } from "@/hooks/usePitches";
import { useSettings, useUpdateSettings } from "@/hooks/useSettings";
import { BrandForm } from "@/components/BrandForm";
import { PitchForm } from "@/components/PitchForm";
import { Button, Card, Field, Icon, Input, Modal } from "@/components/ui";
import { DEFAULT_SETTINGS } from "@/types/db";

/**
 * Första gången.
 *
 * Utan den här guiden landar en ny användare på en tom Idag-vy där samtliga
 * flikar är tomma, och knappen för nytt uppdrag är utgråad eftersom den kräver
 * ett varumärke som ligger undanstoppat i sekundärmenyn. Det är en
 * återvändsgränd, och den syns inte förrän man faktiskt loggar in som ny.
 *
 * Guiden är avsiktligt inte en spärr. Hon kan klicka runt fritt, och stegen
 * bockas av på riktig data i stället för på klick, så att de aldrig kan visa
 * klart för något som inte finns.
 */
export function Onboarding() {
  const { data: settings } = useSettings();
  const { data: brands } = useBrands();
  const { data: pitches } = usePitches();
  const updateSettings = useUpdateSettings();
  const createBrand = useCreateBrand();
  const createPitch = useCreatePitch();
  const navigate = useNavigate();

  const [ratesOpen, setRatesOpen] = useState(false);
  const [brandOpen, setBrandOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const [video, setVideo] = useState<number | "">("");
  const [photo, setPhoto] = useState<number | "">("");
  const [story, setStory] = useState<number | "">("");

  if (!settings || settings.onboarded_at) return null;

  const hasBrand = (brands?.length ?? 0) > 0;
  const hasDeal = (pitches?.length ?? 0) > 0;

  // Priserna raknas som satta forst nar minst ett av dem skiljer sig fran
  // startvardena. Skulle hennes riktiga priser rakat vara exakt startvardena
  // blir steget bara staende obockat, vilket ar ofarligt. Det omvanda felet,
  // att bocka av ett steg hon aldrig gjort, hade daremot gjort att hon aldrig
  // satte sina priser alls.
  const ratesDone =
    settings.base_video_rate !== DEFAULT_SETTINGS.base_video_rate ||
    settings.base_photo_rate !== DEFAULT_SETTINGS.base_photo_rate ||
    settings.base_story_rate !== DEFAULT_SETTINGS.base_story_rate;

  const steps = [
    {
      id: "priser",
      done: ratesDone,
      title: "Säg vad du tar betalt",
      body: "Prisförslagen bygger på dina siffror, inte på gissningar. Du kan ändra dem när som helst under Inställningar.",
      action: "Sätt priser",
      onClick: () => {
        setVideo(settings.base_video_rate);
        setPhoto(settings.base_photo_rate);
        setStory(settings.base_story_rate);
        setRatesOpen(true);
      },
    },
    {
      id: "varumarke",
      done: hasBrand,
      title: "Lägg till ditt första varumärke",
      body: "Allt annat hänger på det här: uppdrag, rättigheter och intäkter räknas per varumärke.",
      action: "Lägg till",
      onClick: () => setBrandOpen(true),
    },
    {
      id: "uppdrag",
      done: hasDeal,
      title: "Skapa ditt första uppdrag",
      body: "Uppdraget följs hela vägen till betalt, och när du registrerar rättigheterna börjar klockan ticka mot förnyelsen.",
      action: "Skapa",
      onClick: () => setDealOpen(true),
      disabled: !hasBrand,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;

  function finish() {
    updateSettings.mutate({ onboarded_at: new Date().toISOString() });
  }

  return (
    <>
      <Card className="border-l-2 border-l-primary">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-headline-sm text-on-surface">
              {allDone ? "Du är igång" : "Kom igång"}
            </h2>
            <p className="mt-1 max-w-prose text-body-md text-on-surface-variant">
              {allDone
                ? "Allt som behövs finns på plats. Härifrån sköter appen bevakningen åt dig."
                : "Tre saker, sedan börjar appen jobba åt dig i stället för tvärtom."}
            </p>
          </div>
          <span className="shrink-0 font-mono text-mono-data text-on-surface-variant">
            {doneCount}/{steps.length}
          </span>
        </div>

        <ol className="mt-6 space-y-3">
          {steps.map((step) => (
            <li
              key={step.id}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 gap-3">
                <span
                  className={
                    step.done
                      ? "grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-on-primary"
                      : "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-outline-variant/60 text-on-surface-variant"
                  }
                >
                  {step.done ? <Icon name="check" size={16} filled /> : null}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      step.done
                        ? "text-body-lg text-on-surface-variant line-through"
                        : "text-body-lg text-on-surface"
                    }
                  >
                    {step.title}
                  </p>
                  {!step.done && (
                    <p className="mt-0.5 max-w-prose text-body-md text-on-surface-variant">
                      {step.body}
                    </p>
                  )}
                </div>
              </div>
              {!step.done && (
                <Button
                  variant="ghost"
                  className="shrink-0"
                  disabled={step.disabled}
                  onClick={step.onClick}
                >
                  {step.action}
                </Button>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {allDone ? (
            <Button onClick={finish} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Sparar..." : "Dölj guiden"}
            </Button>
          ) : (
            <button
              onClick={finish}
              className="text-body-md text-on-surface-variant underline transition-colors hover:text-on-surface"
            >
              Jag hittar själv, dölj guiden
            </button>
          )}
        </div>
      </Card>

      <Modal open={ratesOpen} title="Vad tar du betalt?" onClose={() => setRatesOpen(false)}>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateSettings.mutate(
              {
                base_video_rate: Number(video) || settings.base_video_rate,
                base_photo_rate: Number(photo) || settings.base_photo_rate,
                base_story_rate: Number(story) || settings.base_story_rate,
              },
              { onSuccess: () => setRatesOpen(false) },
            );
          }}
        >
          <p className="text-body-md text-on-surface-variant">
            Grundpriset är bara produktionen. Rättigheterna läggs på ovanpå, och det är oftast där
            de riktiga pengarna finns.
          </p>

          <Field label="Video, per styck" hint="Reel, TikTok och UGC-annons räknas som video.">
            <Input
              type="number"
              min={0}
              step={100}
              autoFocus
              value={video}
              onChange={(e) => setVideo(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Foto, per styck">
            <Input
              type="number"
              min={0}
              step={100}
              value={photo}
              onChange={(e) => setPhoto(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>
          <Field label="Story, per styck">
            <Input
              type="number"
              min={0}
              step={100}
              value={story}
              onChange={(e) => setStory(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </Field>

          <Button type="submit" disabled={updateSettings.isPending} className="w-full">
            {updateSettings.isPending ? "Sparar..." : "Spara priserna"}
          </Button>
        </form>
      </Modal>

      <Modal open={brandOpen} title="Ditt första varumärke" onClose={() => setBrandOpen(false)}>
        <BrandForm
          submitLabel="Lägg till"
          busy={createBrand.isPending}
          onSubmit={(draft) =>
            createBrand.mutate(draft, { onSuccess: () => setBrandOpen(false) })
          }
        />
      </Modal>

      <Modal open={dealOpen} title="Ditt första uppdrag" onClose={() => setDealOpen(false)}>
        <PitchForm
          brands={brands ?? []}
          busy={createPitch.isPending}
          onSubmit={(draft) => {
            if (!draft.brand_id) return;
            createPitch.mutate(
              { ...draft, brand_id: draft.brand_id },
              {
                onSuccess: (pitch) => {
                  setDealOpen(false);
                  navigate(`/uppdrag/${pitch.id}`);
                },
              },
            );
          }}
        />
      </Modal>
    </>
  );
}
