/**
 * Loads an *optional* runtime dependency.
 *
 * `@aws-sdk/client-s3` and `nodemailer` are deliberately not installed: this
 * project ships a pluggable storage provider and a pluggable mailer, and a
 * local-disk + log-mailer deployment must not be forced to carry them.
 *
 * Bundlers resolve every literal `import("…")` at build time, so a guarded
 * dynamic import of a missing package still fails the build. Constructing the
 * import through `Function` keeps the specifier opaque to static analysis and
 * defers the decision to runtime, where the caller can degrade gracefully.
 */
export async function optionalImport<T = Record<string, unknown>>(specifier: string): Promise<T | null> {
  try {
    const dynamicImport = new Function("module", "return import(module)") as (
      module: string
    ) => Promise<unknown>;
    return (await dynamicImport(specifier)) as T;
  } catch {
    return null;
  }
}
