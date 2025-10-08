"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";

type Props = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  url: string;
  initialCover: string;
  initialContent: string;
  initialGallery: string[];
  isPreview: boolean;
};

// same compact, neat block you’re using
export default function ProjectClientView({
  slug,
  title,
  summary,
  tags,
  url,
  initialCover,
  initialContent,
  initialGallery,
  isPreview,
}: Props) {
  const [cover, setCover] = useState(initialCover);
  const [content, setContent] = useState(initialContent);
  const [gallery, setGallery] = useState<string[]>(initialGallery);

  // On preview, pull unsaved values from sessionStorage
  useEffect(() => {
    if (!isPreview) return;
    try {
      const raw = sessionStorage.getItem(`preview:project:${slug}`);
      if (!raw) return;
      const data = JSON.parse(raw || "{}");
      if (data?.slug !== slug) return;
      if (typeof data.cover_image === "string") setCover(data.cover_image);
      if (typeof data.content_md === "string") setContent(data.content_md);
      if (Array.isArray(data.gallery)) setGallery(data.gallery);
    } catch {
      // ignore malformed preview payloads
    }
  }, [isPreview, slug]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-white overflow-hidden shadow-sm ring-1 ring-slate-200/60">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={title} className="h-56 w-full object-cover" />
        ) : null}

        <div className="p-6">
          {/* Title + Visit button */}
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h1>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 inline-flex items-center rounded-lg bg-black px-3 py-1.5 text-xs md:text-sm text-white hover:opacity-90"
                aria-label="Visit project"
              >
                Visit project
              </a>
            )}
          </div>

          {summary && (
            <p className="mt-2 text-[13px] md:text-[14px] leading-6 text-gray-700">
              {summary}
            </p>
          )}

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="text-[11px] md:text-[12px] px-2 py-1 bg-neutral-50 ring-1 ring-slate-200 rounded-full"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Markdown body — compact */}
          {content ? (
            <div className="mt-6">
              <div
                className="
                  prose prose-slate prose-xs md:prose-sm max-w-none
                  prose-headings:font-semibold
                  prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-[1.05rem] md:prose-h2:text-[1.15rem]
                  prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-[1.0rem] md:prose-h3:text-[1.07rem]
                  prose-p:leading-6 prose-li:leading-6
                  prose-p:text-[13px] md:prose-p:text-[14px]
                  prose-li:text-[13px] md:prose-li:text-[14px]
                  prose-a:text-blue-600 hover:prose-a:text-blue-700
                  prose-strong:text-gray-900
                  prose-img:rounded-xl prose-img:ring-1 prose-img:ring-slate-200
                  prose-blockquote:border-l-4 prose-blockquote:border-slate-200 prose-blockquote:bg-slate-50 prose-blockquote:py-2 prose-blockquote:px-4
                  prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-slate-100 prose-code:rounded
                  prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-xl
                  prose-hr:my-8
                "
              >
                <ReactMarkdown
                  components={{
                    a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
                    // eslint-disable-next-line @next/next/no-img-element
                    img: (props) => <img {...props} className="my-4" />,
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <p className="mt-6 text-xs md:text-sm text-gray-500">
              No additional details yet. (Add content in the Admin panel.)
            </p>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {gallery.map((src, idx) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${src}-${idx}`}
                  src={src}
                  alt=""
                  className="rounded-xl ring-1 ring-slate-200 object-cover h-44 w-full"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
