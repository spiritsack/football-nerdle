import type { LogoLookup } from "../../api/clubLogoLookup";

const FOUND_BY: Record<string, string> = {
  "wikidata-id": "Wikidata id",
  transfermarkt: "TransferMarkt id",
  name: "name search",
};

const SOURCE: Record<string, string> = {
  wikidata: "Wikidata logo",
  article: "article image",
};

/** Preview of a logo found on Wikipedia or reused from a youth team's parent club, or why it needs checking by hand */
export default function LogoCandidate({ logo }: { logo: LogoLookup }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-12 h-12 shrink-0 rounded bg-gray-700 flex items-center justify-center">
        {logo.imageUrl ? (
          <img src={logo.imageUrl} alt={logo.file ?? ""} referrerPolicy="no-referrer" className="max-w-full max-h-full object-contain" />
        ) : (
          <span className="text-gray-500 text-[10px]">No image</span>
        )}
      </div>
      <div className="min-w-0 text-xs">
        {logo.parent && (
          <p className="text-sky-300 truncate" title={`${logo.parent.name} (${logo.parent.id})`}>
            From parent club {logo.parent.name}
            <span className="text-gray-500"> · {logo.parent.id}</span>
          </p>
        )}
        {logo.status === "found" && logo.source === "parent" ? (
          <p className="text-gray-500 truncate">Its current crest</p>
        ) : logo.status === "found" ? (
          <p className="text-gray-300 truncate" title={logo.file}>
            {logo.file}
            <span className="text-gray-500"> · {SOURCE[logo.source]}, by {FOUND_BY[logo.foundBy]}</span>
          </p>
        ) : (
          <p className="text-amber-200">
            {logo.reason}
            {logo.candidates && <span className="text-gray-400">: {logo.candidates.join(", ")}</span>}
          </p>
        )}
        {logo.articleUrl && (
          <a href={logo.articleUrl} target="_blank" rel="noreferrer" className="text-green-400 hover:underline truncate block">
            {logo.articleTitle} ↗
          </a>
        )}
      </div>
    </div>
  );
}
