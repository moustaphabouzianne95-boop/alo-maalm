import { env } from "@/lib/env";
import { optionalImport } from "@/lib/utils/optional-import";

/** Opaque specifier: keeps the optional package out of the build graph. */
const NODEMAILER = "nodemailer";

/**
 * Transactional email.
 *
 * A provider interface with a console implementation: the marketplace works
 * end-to-end without SMTP credentials, and switching to Resend/SES/SMTP later
 * means adding one file — no call-site changes.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  template?: string;
  data?: Record<string, unknown>;
}

export interface Mailer {
  send(message: MailMessage): Promise<{ delivered: boolean; provider: string; id?: string }>;
}

class ConsoleMailer implements Mailer {
  async send(message: MailMessage) {
    const box = [
      "",
      "┌──────────────────────────────────────────────────────────────",
      `│ ✉  ${message.subject}`,
      `│ To: ${message.to}`,
      `│ Template: ${message.template ?? "(none)"}`,
      "│",
      ...message.text.split("\n").map((line) => `│   ${line}`),
      "└──────────────────────────────────────────────────────────────",
      "",
    ].join("\n");
    console.info(box);
    return { delivered: true, provider: "console", id: `console-${Date.now()}` };
  }
}

class SmtpMailer implements Mailer {
  async send(message: MailMessage) {
    // Loaded lazily so `nodemailer` stays an optional dependency: a deployment
    // that never configures SMTP must not be forced to install it.
    const nodemailer = await optionalImport<{
      createTransport: (opts: Record<string, unknown>) => {
        sendMail: (opts: Record<string, unknown>) => Promise<{ messageId: string }>;
      };
    }>(NODEMAILER);
    if (!nodemailer) {
      console.warn("[mailer] SMTP selected but `nodemailer` is not installed — falling back to console.");
      return new ConsoleMailer().send(message);
    }
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    const info = await transport.sendMail({
      from: process.env.SMTP_FROM ?? "Alo Maalem <no-reply@alomaalem.ma>",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true, provider: "smtp", id: info.messageId };
  }
}

let mailer: Mailer | null = null;

function resolveMailer(): Mailer {
  if (mailer) return mailer;
  switch (env.EMAIL_PROVIDER) {
    case "smtp":
      mailer = new SmtpMailer();
      break;
    default:
      mailer = new ConsoleMailer();
  }
  return mailer;
}

export async function sendMail(message: MailMessage) {
  try {
    return await resolveMailer().send(message);
  } catch (error) {
    // Email must never break a business transaction.
    console.error("[mailer] delivery failed:", error instanceof Error ? error.message : error);
    return { delivered: false, provider: env.EMAIL_PROVIDER };
  }
}

/**
 * Future channel: WhatsApp/SMS. The signature is stable so notification
 * dispatchers can start calling it the day a provider is configured.
 */
export async function sendSms(_to: string, _body: string) {
  if (process.env.WHATSAPP_ENABLED !== "true") {
    return { delivered: false as const, reason: "channel-disabled" as const };
  }
  return { delivered: false as const, reason: "provider-not-configured" as const };
}
