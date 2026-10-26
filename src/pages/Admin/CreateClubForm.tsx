import { useEffect, useRef, useState } from "react";
import { createClub, findSimilarClubs, getCountries, uploadClubCrest } from "../../api/adminApi";
import type { ClubSummary } from "../../api/adminApi";
import type { RankedClub, Status } from "./createClub";
import { closesCreatePanel, validateNewClubName } from "./createClub";
import ImageDropZone from "./ImageDropZone";
import { FOCUS_OUTLINE } from "./constants";

interface Props {
  initialName: string;
  /** `crestFailed`: a crest was picked but its upload failed (the club exists anyway) */
  onCreated: (club: ClubSummary, crestFailed: boolean) => void;
  /** An existing club from the duplicate warning was picked instead */
  onUseClub: (club: ClubSummary) => void;
  onCancel: () => void;
}

const INPUT_CLASS =
  "w-full px-2 py-1.5 bg-gray-700 border rounded-lg text-white text-sm focus:outline-none focus:border-green-500 disabled:opacity-50";
// Below `sm` the buttons are 44×44 px tap targets; from `sm` up they keep their compact size
const TAP_TARGET = "inline-flex items-center justify-center min-h-11 min-w-11 sm:min-h-0 sm:min-w-0";
const PRIMARY_BUTTON =
  `${TAP_TARGET} ${FOCUS_OUTLINE} flex-1 sm:flex-none px-2.5 py-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors`;
const SECONDARY_BUTTON =
  `${TAP_TARGET} ${FOCUS_OUTLINE} px-2.5 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-colors`;

/** Inline "Create a club" panel in AddClubForm: name, country, crest, then a duplicate check before the insert */
export default function CreateClubForm({ initialName, onCreated, onUseClub, onCancel }: Props) {
  const [name, setName] = useState(initialName.trim());
  const [countryId, setCountryId] = useState("");
  const [countries, setCountries] = useState<{ id: string; name: string }[] | null>(null);
  const [crestFile, setCrestFile] = useState<File | null>(null);
  const [crestPreview, setCrestPreview] = useState("");
  const [matches, setMatches] = useState<RankedClub<ClubSummary>[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [nameInvalid, setNameInvalid] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCountries()
      .then((rows) => { if (!cancelled) setCountries(rows); })
      .catch((err: unknown) => {
        // Country is optional: a failed load leaves only "No country"
        console.error("getCountries failed:", err);
        if (!cancelled) setCountries([]);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const busy = status !== "idle";
  const hasMatches = matches.length > 0;

  function handleNameChange(value: string) {
    setName(value);
    setMatches([]);
    setError(null);
    setNameInvalid(false);
  }

  /** Preview only: the crest is uploaded once the club exists */
  async function pickCrest(file: File): Promise<string> {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setCrestFile(file);
    return url;
  }

  async function create() {
    setStatus("creating");
    let club: ClubSummary;
    try {
      club = await createClub({ name, countryId: countryId || null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("idle");
      return;
    }
    let crestFailed = false;
    if (crestFile) {
      const badge = await uploadClubCrest(club.id, crestFile).catch((err: unknown) => {
        console.error("uploadClubCrest failed:", err);
        return null;
      });
      if (badge) club = { ...club, badge };
      else {
        console.error("Crest upload failed for new club", club.id);
        crestFailed = true;
      }
    }
    onCreated(club, crestFailed);
  }

  async function handlePrimary() {
    if (busy) return;
    setError(null);
    const invalid = validateNewClubName(name);
    if (invalid) {
      setNameInvalid(true);
      setError(invalid);
      return;
    }
    if (hasMatches) {
      await create();
      return;
    }
    setStatus("checking");
    let found: RankedClub<ClubSummary>[];
    try {
      found = await findSimilarClubs(name);
    } catch (err) {
      console.error("findSimilarClubs failed:", err);
      setError("Couldn't check for existing clubs. Try again.");
      setStatus("idle");
      return;
    }
    if (found.length > 0) {
      setMatches(found);
      setStatus("idle");
      return;
    }
    await create();
  }

  const primaryLabel =
    status === "checking" ? "Checking…" : status === "creating" ? "Creating…" : hasMatches ? "Create anyway" : "Check & create";

  return (
    <section
      role="region"
      aria-label="Create a club"
      onKeyDown={(e) => {
        if (closesCreatePanel(e.key, status)) {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
      className="rounded-lg border border-gray-600 bg-gray-900/60 p-2.5 space-y-2"
    >
      <h3 className="text-sm font-semibold text-white">Create a club</h3>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <label htmlFor="create-club-name" className="block mb-1 text-xs text-gray-400">Name</label>
          <input
            id="create-club-name"
            ref={nameRef}
            type="text"
            value={name}
            disabled={busy}
            onChange={(e) => handleNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handlePrimary();
              }
            }}
            aria-invalid={nameInvalid || undefined}
            className={`${INPUT_CLASS} ${nameInvalid ? "border-red-400" : "border-gray-600"}`}
          />
        </div>
        <div className="w-full sm:w-44">
          <label htmlFor="create-club-country" className="block mb-1 text-xs text-gray-400">Country</label>
          <select
            id="create-club-country"
            value={countryId}
            disabled={busy}
            onChange={(e) => setCountryId(e.target.value)}
            className={`${INPUT_CLASS} border-gray-600`}
          >
            <option value="">No country</option>
            {countries === null ? (
              <option disabled value="__loading">Loading countries…</option>
            ) : (
              countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
            )}
          </select>
        </div>
      </div>

      <div className={`flex items-center gap-2 ${busy ? "pointer-events-none opacity-50" : ""}`}>
        <ImageDropZone
          currentImage={crestPreview}
          alt="Crest preview"
          title="Drop or click to pick a crest"
          fallbackText="+"
          upload={pickCrest}
          onUpdated={setCrestPreview}
        />
        <span className="text-[11px] text-gray-400">
          {crestFile
            ? "Crest picked, uploaded when the club is created."
            : "Crest (optional): drop an image or click. Uploaded when the club is created."}
        </span>
      </div>

      {hasMatches && (
        <div className="space-y-1">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-400">Already in the database ({matches.length})</p>
            <p className="text-xs text-gray-300">Use one of these instead, or create anyway if it's a different club.</p>
          </div>
          <ul aria-label="Existing clubs with a similar name" className="divide-y divide-gray-800">
            {matches.map(({ club, match }) => (
              <li key={club.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 py-2">
                {club.badge ? (
                  <img src={club.badge} alt="" referrerPolicy="no-referrer" className="w-6 h-6 shrink-0 object-contain bg-gray-700 rounded" />
                ) : (
                  <div className="w-6 h-6 shrink-0 bg-gray-700 rounded" aria-hidden="true" />
                )}
                <div className="flex-1 min-w-0 basis-[calc(100%-36px)] sm:basis-auto">
                  <p className="text-sm text-white truncate">{club.name}</p>
                  <p className="text-[11px] text-gray-400 truncate">{club.id}</p>
                </div>
                {match === "same" ? (
                  <span className="ml-9 sm:ml-0 shrink-0 text-[11px] text-amber-400 border border-amber-400/40 rounded px-1.5">Same name</span>
                ) : (
                  <span className="ml-9 sm:ml-0 shrink-0 text-[11px] text-gray-300 border border-gray-600 rounded px-1.5">Similar</span>
                )}
                <button
                  type="button"
                  onClick={() => onUseClub(club)}
                  disabled={busy}
                  className={`ml-auto sm:ml-0 shrink-0 ${SECONDARY_BUTTON}`}
                >
                  Use this club
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button type="button" onClick={handlePrimary} disabled={busy} className={PRIMARY_BUTTON}>
          {primaryLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={status === "creating"} className={`flex-1 sm:flex-none ${SECONDARY_BUTTON}`}>
          Cancel
        </button>
      </div>

      {error && <p className="text-red-400 text-xs" role="alert">{error}</p>}
    </section>
  );
}
