import fs from "node:fs/promises";
import path from "node:path";
import type { APIRoute } from "astro";

export const prerender = false;

type NoteEntry = {
  note: string;
  updatedAt: string;
};

type NotesFile = {
  notes: Record<string, NoteEntry>;
};

const notesDir = path.resolve(".garden");
const notesPath = path.join(notesDir, "compare-notes.json");

function normalizePagePath(value: unknown) {
  const pagePath =
    typeof value === "string" && value.trim() ? value.trim() : "/";
  return pagePath.startsWith("/") ? pagePath : `/${pagePath}`;
}

async function readNotes(): Promise<NotesFile> {
  try {
    const raw = await fs.readFile(notesPath, "utf8");
    const parsed = JSON.parse(raw) as NotesFile;
    return { notes: parsed.notes ?? {} };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { notes: {} };
    }

    throw error;
  }
}

async function writeNotes(notes: NotesFile) {
  await fs.mkdir(notesDir, { recursive: true });
  await fs.writeFile(notesPath, `${JSON.stringify(notes, null, 2)}\n`);
}

export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV) {
    return new Response("Not found", { status: 404 });
  }

  const notes = await readNotes();
  const pagePath = url.searchParams.get("path");

  if (pagePath) {
    return Response.json(notes.notes[normalizePagePath(pagePath)] ?? null);
  }

  return Response.json(notes);
};

export const POST: APIRoute = async ({ request }) => {
  if (!import.meta.env.DEV) {
    return new Response("Not found", { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    path?: unknown;
    note?: unknown;
  } | null;

  if (!body) {
    return new Response("Invalid JSON", { status: 400 });
  }

  const pagePath = normalizePagePath(body.path);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  const notes = await readNotes();

  if (note) {
    notes.notes[pagePath] = {
      note,
      updatedAt: new Date().toISOString(),
    };
  } else {
    delete notes.notes[pagePath];
  }

  await writeNotes(notes);

  return Response.json({
    path: pagePath,
    entry: notes.notes[pagePath] ?? null,
  });
};
