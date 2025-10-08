"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import ReactMarkdown from "react-markdown";

type ProjectOption = { slug: string; name: string };

function extFromFilename(name: string) {
  const m = name.toLowerCase().match(/\.(png|jpg|jpeg|webp|gif|svg)$/i);
  return m ? m[1] : "png";
}

async function uploadViaApi(path: string, file: File) {
  const fd = new FormData();
  fd.append("path", path);
  fd.append("file", file);
  const res = await fetch("/api/admin/storage/upload", { method: "POST", body: fd });
  const j = await res.json();
  if (!res.ok || j?.ok === false) throw new Error(j?.error || `Upload failed (${res.status})`);
  return j.publicUrl as string;
}

export default function AdminProjects() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");

  const [content, setContent] = useState("");
  const [cover, setCover] = useState("");
  const [gallery, setGallery] = useState("");

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);

  // cache-bust for admin previews
  const [imgVersion, setImgVersion] = useState(0);
  const withBust = (url: string, v: number) => (url ? (url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`) : url);
  const isDraftUrl = (url: string) => /\/storage\/v1\/object\/public\/projects\/drafts\//i.test(url);

  // --- NEW: derived gallery list + local remove helper ---
  const galleryList = useMemo(
    () => (gallery ? gallery.split(",").map(s => s.trim()).filter(Boolean) : []),
    [gallery]
  );
  function removeGalleryAt(index: number) {
    const next = galleryList.filter((_, i) => i !== index);
    setGallery(next.join(", "));
    setImgVersion(Date.now());
  }

  // Load projects from CV
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/cv-projects", { cache: "no-store" });
        const ct = (r.headers.get("content-type") || "").toLowerCase();
        const body = await r.text();
        const data = ct.includes("application/json")
          ? JSON.parse(body)
          : (() => {
              try { return JSON.parse(body); }
              catch { return { ok: false, error: `Unexpected content-type: ${ct}`, snippet: body.slice(0,200) }; }
            })();
        if (!r.ok || data?.ok === false) {
          setError(data?.error || `Failed to load projects (status ${r.status})`);
          return;
        }
        const arr = Array.isArray(data.projects) ? data.projects : [];
        setProjects(arr.map((p: any) => ({ slug: p.slug, name: p.name })));
      } catch (e: any) {
        setError(e?.message || "Failed to load projects");
      }
    })();
  }, []);

  const options = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );

  async function loadDetailFor(selSlug: string) {
    if (!selSlug) return;
    const { data, error } = await supabaseBrowser
      .from("project_details")
      .select("*")
      .eq("slug", selSlug)
      .single();

    if (error && error.code !== "PGRST116") return;

    if (data) {
      setContent(data.content_md || "");
      setCover(data.cover_image || "");
      const gall = Array.isArray(data.gallery) ? data.gallery : [];
      setGallery(gall.join(", "));
    } else {
      setContent("");
      setCover("");
      setGallery("");
    }
    setImgVersion(Date.now()); // refresh previews
  }

  function onSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const nextSlug = e.target.value;
    setSlug(nextSlug);
    const proj = projects.find((p) => p.slug === nextSlug);
    setTitle(proj?.name || "");
    loadDetailFor(nextSlug);
  }

  function onPreview() {
    if (!slug) return;
    const payload = {
      slug,
      content_md: content || "",
      cover_image: cover || "",
      gallery: (gallery ? gallery.split(",").map(s => s.trim()).filter(Boolean) : []),
    };
    sessionStorage.setItem(`preview:project:${slug}`, JSON.stringify(payload));
    const ts = Date.now();
    window.open(`/projects/${slug}?preview=1&ts=${ts}`, "_blank");
  }

  // ---- Uploads go to DRAFT paths; only admin preview changes before Save ----

  async function onUploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !slug) return;
    try {
      setUploadingCover(true);
      setError(""); setMsg("");
      const ext = extFromFilename(file.name);
      const path = `drafts/${slug}/cover-${Date.now()}.${ext}`; // DRAFT
      const publicUrl = await uploadViaApi(path, file);
      setCover(publicUrl);                // show in admin only
      setImgVersion(Date.now());
      setMsg("Cover uploaded (draft).");
    } catch (err: any) {
      setError(err?.message || "Cover upload failed");
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  }

  async function onUploadGallery(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length || !slug) return;
    try {
      setUploadingGallery(true);
      setError(""); setMsg("");
      const uploaded: string[] = [];
      for (const f of files) {
        const ext = extFromFilename(f.name);
        const path = `drafts/${slug}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`; // DRAFT
        const url = await uploadViaApi(path, f);
        uploaded.push(url);
      }
      const existing = gallery ? gallery.split(",").map(s => s.trim()).filter(Boolean) : [];
      const next = [...existing, ...uploaded];
      setGallery(next.join(", "));
      setImgVersion(Date.now());
      setMsg(`Uploaded ${uploaded.length} draft image(s).`);
    } catch (err: any) {
      setError(err?.message || "Gallery upload failed");
    } finally {
      setUploadingGallery(false);
      e.target.value = "";
    }
  }

  // ---- Save: promote drafts -> final URLs, then upsert detail ----
  async function onSave() {
    setMsg(""); setError("");
    if (!slug) { setError("Choose a project first."); return; }

    try {
      // 1) Promote drafts (cover/gallery) to final storage paths
      const galleryArr = gallery ? gallery.split(",").map(s => s.trim()).filter(Boolean) : [];
      const promoteRes = await fetch("/api/admin/storage/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          coverDraftUrl: /\/drafts\//i.test(cover) ? cover : null,
          galleryDraftUrls: galleryArr,
        }),
      });
      const promote = await promoteRes.json();
      if (!promoteRes.ok || promote?.ok === false) {
        throw new Error(promote?.error || `Promote failed (${promoteRes.status})`);
      }

      // 2) Use final URLs; add a cache-busting version param before saving
      const ver = Date.now();
      const addV = (u?: string | null) => (u ? (u.includes("?") ? `${u}&v=${ver}` : `${u}?v=${ver}`) : null);

      const coverFinal = addV(promote.coverFinalUrl || cover || null);
      const galleryFinal = (Array.isArray(promote.galleryFinalUrls) ? promote.galleryFinalUrls : galleryArr)
        .map(addV) // add ?v= to each
        .filter(Boolean) as string[];

      // 3) Upsert to DB
      const payload = {
        slug,
        content_md: content || null,
        cover_image: coverFinal,
        gallery: galleryFinal,
      };

      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/api/admin/project-details`;

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.error || `Save failed (status ${r.status})`);
      }

      // 4) Update local fields to final *versioned* URLs so the admin preview updates
      setCover(coverFinal || "");
      setGallery(galleryFinal.join(", "));

      // 5) Ask Next.js to revalidate the listing + detail pages (server cache)
      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paths: [`/projects/${slug}`, `/projects`],
        }),
      }).catch(() => { /* ignore revalidate errors */ });

      setMsg("Saved!");

      // Optional: open the live page with an extra ts to also bust any client cache
      const ts = Date.now();
      window.open(`/projects/${slug}?ts=${ts}`, "_blank");
    } catch (e: any) {
      setError(e?.message || "Save failed");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
      <h1 className="text-2xl md:text-3xl font-semibold">Projects (Admin)</h1>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {msg && (
        <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {msg}
        </div>
      )}

      <label className="block">
        <span className="text-sm">Select a CV project</span>
        <select
          className="w-full border rounded-md p-2"
          value={slug}
          onChange={onSelect}
        >
          <option value="">— choose —</option>
          {options.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm">Title (from CV)</span>
        <input
          className="w-full border rounded-md p-2 bg-neutral-50"
          value={title}
          readOnly
        />
      </label>

      <label className="block">
        <span className="text-sm">Detail content (Markdown)</span>
        <div className="mt-2 grid gap-4 md:grid-cols-2">
          <textarea
            className="w-full rounded-md border p-3 font-mono text-sm h-96 md:h-[28rem]"
            placeholder="Write the long description here in Markdown..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <div className="rounded-md ring-1 ring-slate-200/60 bg-white p-4 overflow-auto h-96 md:h-[28rem]">
            <div
              className="
                prose prose-slate prose-sm lg:prose-base max-w-none
                prose-headings:font-semibold
                prose-h2:mt-4 prose-h2:mb-2
                prose-h3:mt-3 prose-h3:mb-1.5
                prose-p:leading-7 prose-li:leading-7
                prose-a:text-blue-600 hover:prose-a:text-blue-700
                prose-img:rounded-lg prose-img:ring-1 prose-img:ring-slate-200
                prose-code:px-1.5 prose-code:py-0.5 prose-code:bg-slate-100 prose-code:rounded
                prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-pre:rounded-lg
              "
            >
              {content?.trim() ? (
                <ReactMarkdown
                  components={{
                    a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
                    // eslint-disable-next-line @next/next/no-img-element
                    img: (props) => <img {...props} className="my-3" />,
                  }}
                >
                  {content}
                </ReactMarkdown>
              ) : (
                <p className="text-xs text-gray-500">
                  Live preview will appear here as you type…
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
          <span>{content.length.toLocaleString()} chars</span>
          <span>Markdown supported: headings, lists, images, code, links</span>
        </div>
      </label>

      {/* Cover image (URL or upload) */}
<label className="block">
  <span className="text-sm">Cover image (URL or upload)</span>
  <div className="flex gap-2">
    <input
      className="w-full border rounded-md p-2"
      placeholder="https://..."
      value={cover}
      onChange={(e) => { setCover(e.target.value); setImgVersion(Date.now()); }}
    />
    <label className="inline-flex items-center gap-2 rounded-md border px-3 cursor-pointer">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onUploadCover}
        disabled={!slug || uploadingCover}
      />
      {uploadingCover ? "Uploading..." : "Upload"}
    </label>
  </div>

  {cover && (
    <div className="relative mt-2 inline-block">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={withBust(cover, imgVersion)}
        alt="Cover preview"
        className="h-28 rounded-md ring-1 ring-slate-200 object-cover"
      />
      {/* remove cover button (local only; persists after Save) */}
      <button
        type="button"
        title="Remove cover"
        onClick={() => { setCover(""); setImgVersion(Date.now()); }}
        className="
          absolute -top-1 -right-1 h-5 w-5 grid place-items-center
          rounded-full bg-white/90 border shadow
          text-[11px] leading-none hover:bg-white
        "
        aria-label="Remove cover"
      >
        ×
      </button>
    </div>
  )}

  {isDraftUrl(cover) && (
    <p className="mt-1 text-[11px] text-amber-600">
      Draft image — will be promoted to final on Save.
    </p>
  )}
</label>


      {/* Gallery (comma URLs or upload multiple) */}
      <label className="block">
        <span className="text-sm">Gallery (comma-separated URLs or upload)</span>
        <div className="flex gap-2">
          <input
            className="w-full border rounded-md p-2"
            placeholder="https://... , https://..."
            value={gallery}
            onChange={(e) => { setGallery(e.target.value); setImgVersion(Date.now()); }}
          />
          <label className="inline-flex items-center gap-2 rounded-md border px-3 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onUploadGallery}
              disabled={!slug || uploadingGallery}
            />
            {uploadingGallery ? "Uploading..." : "Upload"}
          </label>
        </div>

        {/* quick thumbs with remove buttons */}
        <div className="mt-2 flex flex-wrap gap-2">
          {galleryList.slice(0, 12).map((src, i) => (
            <div key={`${src}-${i}`} className="relative h-16 w-16">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={withBust(src, imgVersion)}
                alt=""
                className="h-16 w-16 object-cover rounded-md ring-1 ring-slate-200"
                draggable={false}
              />
              <button
                type="button"
                title="Remove image"
                onClick={() => removeGalleryAt(i)}
                className="
                  absolute -top-1 -right-1 h-5 w-5 grid place-items-center
                  rounded-full bg-white/90 border shadow
                  text-[11px] leading-none hover:bg-white
                "
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {gallery.split(",").some(s => /\/drafts\//i.test(s)) && (
          <p className="mt-1 text-[11px] text-amber-600">
            Draft images present — they will be promoted to final on Save.
          </p>
        )}
      </label>

      <div className="flex gap-3 items-center">
        <button
          type="button"
          onClick={onPreview}
          disabled={!slug}
          className="text-sm underline underline-offset-4 disabled:opacity-50"
          title="Preview (unsaved changes)"
        >
          Preview
        </button>

        <button
          disabled={!slug}
          onClick={onSave}
          className="rounded-md bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
