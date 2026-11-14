export function resolveApexTestSelection(mode, input = "") {
  if (!["none", "local", "specified"].includes(mode)) throw new Error("Unsupported test mode: " + mode);
  if (mode !== "specified") return { mode, classes: [] };
  const classes = String(input || "").split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  if (!classes.length || classes.length > 30 || classes.some(name => !/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) || new Set(classes).size !== classes.length) {
    throw new Error("specified test mode requires 1-30 unique Apex test class names.");
  }
  return { mode, classes };
}
