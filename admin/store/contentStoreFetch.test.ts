import { describe, expect, it, vi } from "vitest";

import { fetchBranchContent } from "./contentStoreFetch";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockConfig = {
  contentFolder: "cms/content",
  mediaFolder: "public/media",
  collections: {
    post: {
      label: "Post",
      fields: {
        body: { label: "Body", format: "markdown" },
        title: { label: "Title", format: "string" },
      },
    },
    media: {
      label: "Media",
      fields: {},
    },
  },
} as any;

vi.mock("../../lib/configStore", () => ({ getConfig: () => mockConfig }));

vi.mock("octocms/lib/cmsServerLog", () => ({
  logCmsServerError: vi.fn(),
}));

vi.mock("octocms/lib/companionMarkdown", () => ({
  companionMarkdownPathsForEntry: (jsonPath: string, type: string) => {
    if (type === "post") return { body: jsonPath.replace(".json", ".body.md") };
    return {};
  },
  companionRichTextPathsForEntry: () => ({}),
}));

function makeOctokit(
  treeItems: object[],
  blobContents: Record<string, string>,
) {
  return {
    rest: {
      git: {
        getTree: vi.fn().mockResolvedValue({
          data: { sha: "tree-sha-123", tree: treeItems, truncated: false },
        }),
        getBlob: vi
          .fn()
          .mockImplementation(({ file_sha }: { file_sha: string }) => {
            const content = blobContents[file_sha];
            if (!content) throw new Error(`Blob not found: ${file_sha}`);
            return Promise.resolve({
              data: { content: Buffer.from(content).toString("base64") },
            });
          }),
      },
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("fetchBranchContent", () => {
  it("fetches and indexes content correctly", async () => {
    const postJson = JSON.stringify({
      sys: { id: "1", type: "post" },
      fields: { title: "Hello" },
    });

    const octokit = makeOctokit(
      [
        { path: "cms/content/post/post-1.json", type: "blob", sha: "sha-json" },
        {
          path: "cms/content/post/post-1.body.md",
          type: "blob",
          sha: "sha-md",
        },
        { path: "README.md", type: "blob", sha: "sha-readme" }, // Should be filtered out
        { path: "src/app", type: "tree", sha: "sha-dir" }, // Should be filtered out
      ],
      {
        "sha-json": postJson,
        "sha-md": "# Hello World",
      },
    );

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result).not.toBeNull();
    expect(result!.branch).toBe("main");
    expect(result!.treeSha).toBe("tree-sha-123");

    // Entry should be indexed
    expect(result!.entries.size).toBe(1);
    const entry = result!.entries.get("cms/content/post/post-1.json");
    expect(entry).toBeDefined();
    expect((entry!.content as any).sys.type).toBe("post");
    expect(entry!.sha).toBe("sha-json");

    // Companion markdown should be merged
    expect(entry!.companionMarkdown.body).toBe("# Hello World");

    // Collection index
    expect(result!.byCollection.get("post")).toEqual([
      "cms/content/post/post-1.json",
    ]);

    // No media entries
    expect(result!.mediaEntries.size).toBe(0);
  });

  it("indexes media entries separately", async () => {
    const mediaJson = JSON.stringify({
      sys: { id: "uuid", type: "media" },
      fields: { title: "Photo", extension: "jpg" },
    });

    const octokit = makeOctokit(
      [
        {
          path: "cms/content/media/media-uuid.json",
          type: "blob",
          sha: "sha-m",
        },
      ],
      {
        "sha-m": mediaJson,
      },
    );

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result!.mediaEntries.size).toBe(1);
    expect(result!.mediaEntries.has("cms/content/media/media-uuid.json")).toBe(
      true,
    );
  });

  it("skips malformed JSON gracefully", async () => {
    const octokit = makeOctokit(
      [
        {
          path: "cms/content/post/post-bad.json",
          type: "blob",
          sha: "sha-bad",
        },
      ],
      {
        "sha-bad": "not valid json {{{",
      },
    );

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result).not.toBeNull();
    expect(result!.entries.size).toBe(0);
  });

  it("returns null when getTree fails", async () => {
    const octokit = {
      rest: {
        git: {
          getTree: vi.fn().mockRejectedValue(new Error("API error")),
          getBlob: vi.fn(),
        },
      },
    } as any;

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result).toBeNull();
  });

  it("returns empty store when no CMS files exist", async () => {
    const octokit = makeOctokit(
      [
        { path: "README.md", type: "blob", sha: "sha-readme" },
        { path: "package.json", type: "blob", sha: "sha-pkg" },
      ],
      {},
    );

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result).not.toBeNull();
    expect(result!.entries.size).toBe(0);
    expect(result!.byCollection.size).toBe(0);
  });

  it("handles blob fetch failures gracefully", async () => {
    const octokit = makeOctokit(
      [
        {
          path: "cms/content/post/post-fail.json",
          type: "blob",
          sha: "sha-fail",
        },
      ],
      {}, // No blob content — will throw
    );

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result).not.toBeNull();
    // Entry with failed blob should be skipped
    expect(result!.entries.size).toBe(0);
  });

  it("filters only json and md files under contentFolder", async () => {
    const octokit = makeOctokit(
      [
        { path: "cms/content/post/post-1.json", type: "blob", sha: "sha-1" },
        { path: "cms/content/post/image.png", type: "blob", sha: "sha-img" },
        { path: "public/media/file.jpg", type: "blob", sha: "sha-pub" },
      ],
      {
        "sha-1": JSON.stringify({ sys: { id: "1", type: "post" }, fields: {} }),
      },
    );

    const result = await fetchBranchContent(octokit, "owner", "repo", "main");
    expect(result!.entries.size).toBe(1);
    // Only the json blob should have been fetched
    expect(octokit.rest.git.getBlob).toHaveBeenCalledTimes(1);
  });
});
