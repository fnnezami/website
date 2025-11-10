import { fetchNormalizedResume } from "@/lib/gist";
import DownloadCvButton from "@/components/DownloadCvButton";

const sectionDefs = [
  { key: "work", label: "Work" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "awards", label: "Awards" },
];

export const revalidate = 0;

export default async function Home() {
  const resume = await fetchNormalizedResume();

  // helper to pick badge color by level
  const getLevelClass = (level?: string) => {
    if (!level) return "bg-gray-100 text-gray-800";
    const l = level.toLowerCase();
    if (l.includes("expert")) return "bg-emerald-100 text-emerald-800";
    if (l.includes("advanced")) return "bg-sky-100 text-sky-800";
    if (l.includes("proficient")) return "bg-indigo-100 text-indigo-800";
    if (l.includes("experienced")) return "bg-teal-100 text-teal-800";
    if (l.includes("basic")) return "bg-amber-100 text-amber-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-4">
        {/* Nav + Download button */}
        <div className="flex items-center justify-between gap-3 border-b pb-3">
          <div className="flex flex-wrap gap-2">
            {sectionDefs.map((s) => (
              <a
                key={s.key}
                href={`#sec-${s.key}`}
                className="px-3 py-2 text-sm rounded-t-lg hover:bg-neutral-100"
              >
                {s.label}
              </a>
            ))}
          </div>
          <DownloadCvButton />
        </div>

        <div className="pt-4">
          {/* Work */}
          <section id="sec-work" className="space-y-4">
            <h3 className="font-semibold text-lg">Work</h3>
            {(resume?.work ?? []).map((w: any, i: number) => (
              <article
                key={i}
                className="rounded-xl border p-4 bg-white shadow-sm"
              >
                <div className="flex justify-between gap-4">
                  <div className="font-medium">
                    {w.position} @ {w.name}
                  </div>
                  <div className="text-sm text-gray-600">
                    {w.startDate} – {w.endDate || "Present"}
                  </div>
                </div>
                {w.location && (
                  <div className="text-sm text-gray-600">{w.location}</div>
                )}
                {w.summary && <p className="mt-2">{w.summary}</p>}
                {Array.isArray(w.highlights) && w.highlights.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                    {w.highlights.map((h: string, j: number) => (
                      <li key={j}>{h}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </section>

          {/* Education */}
          <section id="sec-education" className="space-y-4 mt-8">
            <h3 className="font-semibold text-lg">Education</h3>
            {(resume?.education ?? []).map((e: any, i: number) => (
              <article key={i} className="rounded-xl border p-4 bg-white">
                <div className="flex justify-between items-start">
                  <div className="font-medium">
                    {e.studyType} @ {e.institution}
                  </div>
                  <div className="text-sm text-gray-600">
                    {e.startDate} – {e.endDate || "Present"}
                  </div>
                </div>

                {/* focus areas moved below as smaller badges */}
                {e.area && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Array.isArray(e.area)
                      ? e.area.map((area: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs text-gray-700"
                          >
                            {area}
                          </span>
                        ))
                      : (
                          <span className="px-2 py-1 text-xs text-gray-700">
                            {e.area}
                          </span>
                        )}
                  </div>
                )}

                {e.score && (
                  <div className="text-sm text-gray-600 mt-2">Score: {e.score}</div>
                )}
              </article>
            ))}
          </section>

          {/* Skills */}
          <section id="sec-skills" className="space-y-4 mt-8">
            <h3 className="font-semibold text-lg">Skills</h3>

            {/* responsive grid of skill cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(resume?.skills ?? []).map((s: any, i: number) => (
                <article
                  key={i}
                  className="rounded-xl border p-4 bg-white shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="font-medium">{s.name}</div>
                    <div>
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded ${getLevelClass(
                          s.level
                        )}`}
                      >
                        {s.level || "—"}
                      </span>
                    </div>
                  </div>

                  {/* keywords as small chips */}
                  {Array.isArray(s.keywords) && s.keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {s.keywords.map((k: string, j: number) => (
                        <span
                          key={j}
                          className="px-2 py-1 text-xs rounded-full border bg-neutral-50 text-gray-700"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>

          {/* Awards */}
          <section id="sec-awards" className="space-y-4 mt-8">
            <h3 className="font-semibold text-lg">Awards</h3>
            {(resume?.awards ?? []).map((a: any, i: number) => (
              <article key={i} className="rounded-xl border p-4 bg-white">
                <div className="font-medium">{a.title}</div>
                <div className="text-sm text-gray-600">
                  {a.awarder} — {a.date}
                </div>
                {a.summary && <p className="mt-2">{a.summary}</p>}
              </article>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
