import { fetchNormalizedResume } from "@/lib/gist";

const sectionDefs = [
  { key: "work", label: "Work" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "awards", label: "Awards" },
];

export const revalidate = 0;

export default async function Home() {
  const resume = await fetchNormalizedResume();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap gap-2 border-b">
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
                <div className="flex justify-between">
                  <div className="font-medium">
                    {e.studyType} {e.area} @ {e.institution}
                  </div>
                  <div className="text-sm text-gray-600">
                    {e.startDate} – {e.endDate || "Present"}
                  </div>
                </div>
                {e.score && (
                  <div className="text-sm text-gray-600">Score: {e.score}</div>
                )}
              </article>
            ))}
          </section>

          {/* Skills */}
          <section id="sec-skills" className="space-y-4 mt-8">
            <h3 className="font-semibold text-lg">Skills</h3>
            <div className="flex flex-wrap gap-2">
              {(resume?.skills ?? []).flatMap((s: any) => s.keywords || []).map(
                (k: string, i: number) => (
                  <span
                    key={i}
                    className="px-2 py-1 rounded-full border text-sm bg-neutral-50"
                  >
                    {k}
                  </span>
                )
              )}
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
