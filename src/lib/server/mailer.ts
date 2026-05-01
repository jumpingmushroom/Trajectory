// SMTP-based mailer (nodemailer). Env-driven so any SMTP relay (Mailgun,
// SES, Postmark, your own postfix, Mailpit for dev) plugs in without code
// changes. Two transactional templates live in this file:
//
//   - sendInviteEmail:        admin-issued account, "set your password"
//   - sendResetPasswordEmail: self-service password reset
//
// Both render plain HTML + a text fallback. Branding stays minimal: a heading,
// a paragraph, a button, and a copy/paste fallback URL. No tracking pixels,
// no third-party assets.
//
// Boot guard: in production, hooks.server.ts refuses to start without
// SMTP_HOST + SMTP_FROM. In development, missing config logs and turns
// sendMail into a no-op so the dev loop isn't blocked.
//
// Re-using one Transporter across requests avoids reconnecting per send.

import nodemailer, { type Transporter } from 'nodemailer';

let transporter: Transporter | null = null;
let warnedMissingConfig = false;

function getTransporter(): Transporter | null {
	if (transporter) return transporter;

	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT ?? 587);
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;
	const secure = process.env.SMTP_SECURE === 'true';

	if (!host) {
		if (!warnedMissingConfig) {
			console.warn('[trajectory] SMTP_HOST not set — mailer is a no-op (dev mode)');
			warnedMissingConfig = true;
		}
		return null;
	}

	transporter = nodemailer.createTransport({
		host,
		port,
		secure,
		auth: user && pass ? { user, pass } : undefined
	});
	return transporter;
}

interface SendArgs {
	to: string;
	subject: string;
	html: string;
	text: string;
}

export async function sendMail(args: SendArgs): Promise<void> {
	const t = getTransporter();
	if (!t) {
		console.log(`[trajectory] (no-op mailer) would send to ${args.to}: ${args.subject}`);
		console.log(`[trajectory] (no-op mailer) text body:\n${args.text}`);
		return;
	}
	const from = process.env.SMTP_FROM ?? 'Trajectory <noreply@trajectory.local>';
	await t.sendMail({ from, ...args });
}

function escapeHtml(s: string): string {
	return s.replace(
		/[&<>"']/g,
		(c) =>
			({
				'&': '&amp;',
				'<': '&lt;',
				'>': '&gt;',
				'"': '&quot;',
				"'": '&#39;'
			})[c] as string
	);
}

function template({
	heading,
	body,
	buttonLabel,
	buttonUrl
}: {
	heading: string;
	body: string;
	buttonLabel: string;
	buttonUrl: string;
}): { html: string; text: string } {
	const safeUrl = escapeHtml(buttonUrl);
	const html = `<!doctype html>
<html><body style="font-family: -apple-system, system-ui, sans-serif; background:#0e1116; color:#e6e8eb; padding:24px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:520px; margin:0 auto;">
    <tr><td>
      <h1 style="margin:0 0 16px; font-size:22px;">${escapeHtml(heading)}</h1>
      <p style="margin:0 0 24px; line-height:1.5; font-size:15px;">${escapeHtml(body)}</p>
      <p style="margin:0 0 24px;">
        <a href="${safeUrl}" style="display:inline-block; padding:12px 18px; background:#fbbf24; color:#0e1116; text-decoration:none; border-radius:8px; font-weight:600;">${escapeHtml(buttonLabel)}</a>
      </p>
      <p style="margin:0; font-size:12px; color:#9ba1a6;">If the button doesn't work, paste this URL into your browser:<br>
        <span style="word-break:break-all;">${safeUrl}</span></p>
    </td></tr>
  </table>
</body></html>`;
	const text = `${heading}\n\n${body}\n\n${buttonLabel}: ${buttonUrl}\n`;
	return { html, text };
}

export async function sendInviteEmail(args: {
	to: string;
	name: string;
	url: string;
}): Promise<void> {
	const { html, text } = template({
		heading: `Welcome to Trajectory, ${args.name}`,
		body: 'An admin has created an account for you. Click the button below to set your password and finish signing in. This link expires in 7 days.',
		buttonLabel: 'Set your password',
		buttonUrl: args.url
	});
	await sendMail({
		to: args.to,
		subject: 'Welcome to Trajectory — set your password',
		html,
		text
	});
}

export async function sendResetPasswordEmail(args: {
	to: string;
	url: string;
}): Promise<void> {
	const { html, text } = template({
		heading: 'Reset your Trajectory password',
		body: 'We received a request to reset your password. Click the button below to choose a new one. If you did not request this, you can safely ignore this email.',
		buttonLabel: 'Reset password',
		buttonUrl: args.url
	});
	await sendMail({
		to: args.to,
		subject: 'Reset your Trajectory password',
		html,
		text
	});
}
