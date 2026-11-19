import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as P from "../apps/web/src/themePalette.ts";
import { EnvironmentThemeFile, EnvironmentThemeId } from "../packages/contracts/src/server.ts";
import { themeCssLoadsRemoteFiles } from "../packages/shared/src/themeCss.ts";
import { UNPUBLISHABLE_THEME_IDS } from "../packages/shared/src/themePalettes.ts";

const MAX_SERVER_THEME_FILES = 32;
const SUFFIX = " Videorc";
const MANIFEST = ".videorc-manifest";

const here = import.meta.dir;
const Schema: typeof import("effect/Schema") = await import(
  Bun.resolveSync("effect/Schema", NodePath.join(here, "..", "packages", "contracts"))
);
const [mode = "plan", dirArg] = process.argv.slice(2);
const themesDir = dirArg ?? NodePath.join(NodeOS.homedir(), ".t3", "userdata", "themes");
const css = NodeFS.readFileSync(NodePath.join(here, "videorc-theme.css"), "utf8");
const draftingCss = NodeFS.readFileSync(NodePath.join(here, "drafting.css"), "utf8");
const draftingFlatCss = NodeFS.readFileSync(NodePath.join(here, "drafting-flat.css"), "utf8");
const runeButtonsCss = NodeFS.readFileSync(NodePath.join(here, "rune-buttons.css"), "utf8");
const runeCss = NodeFS.readFileSync(NodePath.join(here, "rune-theme.css"), "utf8");
const decode = Schema.decodeUnknownExit(Schema.fromJsonString(EnvironmentThemeFile));
const isId = Schema.is(EnvironmentThemeId);

const fail = (message: string): never => {
  console.error(`error: ${message}`);
  process.exit(1);
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const jsonFiles = (dir: string) =>
  NodeFS.existsSync(dir)
    ? NodeFS.readdirSync(dir)
        .filter((name) => name.endsWith(".json"))
        .toSorted()
    : [];

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(NodeFS.readFileSync(path, "utf8"));

type Output = { id: string; name: string; source: string; text: string; css: string };
const outputs: Output[] = [];

const addCopy = (source: string, theme: Record<string, unknown>) => {
  const { id: _id, collection: _collection, managed: _managed, ...rest } = theme;
  const name = `${String(rest.name)}${SUFFIX}`;
  outputs.push({
    id: `${slug(String(rest.name))}-videorc`,
    name,
    source,
    css,
    text: `${JSON.stringify({ ...rest, name, css }, null, 2)}\n`,
  });
};

const builtIns = [
  {
    id: "t3-code",
    label: "T3 Code",
    appearance: "light" as const,
    colors: P.getDefaultThemeColors("light"),
    variants: { dark: P.getDefaultThemeColors("dark") },
  },
  P.T3_CHAT_THEME,
  P.GROVE_THEME,
  P.OCEAN_THEME,
  P.EMBER_THEME,
  P.IRIS_THEME,
];
for (const theme of builtIns) {
  addCopy(`built-in ${theme.id}`, JSON.parse(P.serializeThemeFile(theme)));
}

for (const file of jsonFiles(NodePath.join(here, "themes", "custom"))) {
  const theme = P.parseThemeFile(readJson(NodePath.join(here, "themes", "custom", file)));
  addCopy(`custom ${file}`, JSON.parse(P.serializeThemeFile(theme)));
}

const environmentDir = NodePath.join(here, "themes", "environment");
const addEnvironment = (
  id: string,
  theme: Record<string, unknown>,
  baseCss: string,
  source: string,
) => {
  const sidecarPath = NodePath.join(environmentDir, `${id}.css`);
  const sidecar = NodeFS.existsSync(sidecarPath) ? NodeFS.readFileSync(sidecarPath, "utf8") : null;
  if (sidecar !== null && themeCssLoadsRemoteFiles(sidecar)) fail(`${id}.css loads remote files`);
  const parts = [
    baseCss,
    sidecar,
    id.endsWith("-drafting") || id.endsWith("-rune") ? draftingCss : null,
  ];
  const themeCss = parts.filter((part) => part !== null).join("\n");
  outputs.push({
    id,
    name: String(theme.name),
    source,
    css: themeCss,
    text: `${JSON.stringify({ ...theme, css: themeCss }, null, 2)}\n`,
  });
};

for (const file of jsonFiles(environmentDir)) {
  const id = file.slice(0, -".json".length);
  const { css: _css, ...theme } = readJson(NodePath.join(environmentDir, file));
  if (!id.endsWith("-drafting")) {
    addEnvironment(id, theme, css, `environment ${file}`);
    continue;
  }
  addEnvironment(id, theme, `${css}\n${draftingFlatCss}\n${runeButtonsCss}`, `environment ${file}`);
  const { description: _description, ...rest } = theme;
  const runeId = id.replace(/-drafting$/, "-rune");
  const runeName = `${String(theme.name).replace(/ Drafting$/, "")} Rune`;
  addEnvironment(
    runeId,
    { ...rest, id: runeId, name: runeName },
    `${runeButtonsCss}\n${runeCss}`,
    `rune copy of ${file}`,
  );
}

if (themeCssLoadsRemoteFiles(css)) fail("videorc-theme.css loads remote files");
if (themeCssLoadsRemoteFiles(draftingCss)) fail("drafting.css loads remote files");
if (themeCssLoadsRemoteFiles(draftingFlatCss)) fail("drafting-flat.css loads remote files");
if (themeCssLoadsRemoteFiles(runeButtonsCss)) fail("rune-buttons.css loads remote files");
if (themeCssLoadsRemoteFiles(runeCss)) fail("rune-theme.css loads remote files");

const ids = new Set<string>();
for (const output of outputs) {
  if (!isId(output.id) || UNPUBLISHABLE_THEME_IDS.has(output.id)) {
    fail(`theme id "${output.id}" from ${output.source} cannot be published`);
  }
  if (ids.has(output.id)) fail(`two themes publish as "${output.id}"`);
  ids.add(output.id);
  const decoded = decode(output.text);
  if (decoded._tag !== "Success") fail(`${output.source} is not a valid environment theme`);
  if (decoded._tag === "Success" && decoded.value.css !== output.css) {
    fail(`${output.source} lost its CSS`);
  }
}

const manifestPath = NodePath.join(themesDir, MANIFEST);
const previous = NodeFS.existsSync(manifestPath)
  ? NodeFS.readFileSync(manifestPath, "utf8").split("\n").filter(Boolean)
  : [];
const stale = previous.filter((id) => !ids.has(id));
const foreign = jsonFiles(themesDir)
  .map((file) => file.slice(0, -".json".length))
  .filter((id) => !ids.has(id) && !stale.includes(id));
const total = foreign.length + outputs.length;
if (total > MAX_SERVER_THEME_FILES) {
  fail(`${total} theme files. The server reads only ${MAX_SERVER_THEME_FILES}`);
}

let changes = 0;
for (const output of outputs) {
  const path = NodePath.join(themesDir, `${output.id}.json`);
  const current = NodeFS.existsSync(path) ? NodeFS.readFileSync(path, "utf8") : null;
  const state = current === null ? "ADD" : current === output.text ? "SAME" : "UPDATE";
  if (state !== "SAME") changes += 1;
  console.log(
    `${state.padEnd(6)} ${output.id.padEnd(34)} ${output.name.padEnd(34)} ${output.source}`,
  );
}
for (const id of stale) {
  if (NodeFS.existsSync(NodePath.join(themesDir, `${id}.json`))) {
    changes += 1;
    console.log(`REMOVE ${id}`);
  }
}
for (const id of foreign) console.log(`OTHER  ${id} (not managed, not changed)`);

if (mode === "plan") {
  console.log(changes === 0 ? "ok: published themes are current" : `${changes} change(s) to apply`);
  process.exit(changes === 0 ? 0 : 2);
}
if (mode !== "apply") fail(`unknown mode "${mode}". Use plan or apply`);

NodeFS.mkdirSync(themesDir, { recursive: true });
const writeAtomic = (path: string, text: string) => {
  const tmp = `${path}.${process.pid}.tmp`;
  NodeFS.writeFileSync(tmp, text);
  NodeFS.renameSync(tmp, path);
};
for (const output of outputs)
  writeAtomic(NodePath.join(themesDir, `${output.id}.json`), output.text);
for (const id of stale) NodeFS.rmSync(NodePath.join(themesDir, `${id}.json`), { force: true });
writeAtomic(manifestPath, `${[...ids].toSorted().join("\n")}\n`);
console.log(`ok: ${outputs.length} themes published to ${themesDir}`);
