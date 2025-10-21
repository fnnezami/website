// Server component exported by the blog-posts module.
// If this file exists the universal route will import and render it.
import React from "react";
import { listPublishedPosts } from "../server/api";
import ListView from "./ListView.client";

export const dynamic = "force-dynamic";

export default async function PublicBlogIndex() {
  let posts = [];
  try {
    const res: any = await listPublishedPosts();
    posts = Array.isArray(res) ? res : Array.isArray(res?.posts) ? res.posts : Array.isArray(res?.data) ? res.data : [];
  } catch {}

  return (
    <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8 sm:mb-10">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Blog</h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">Thoughts, guides, and updates.</p>
      </header>

      <ListView posts={posts} />
    </main>
  );
}
