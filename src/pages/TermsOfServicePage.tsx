export default function TermsOfServicePage() {
  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Legal</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Terms of Service</h2>
        <p className="mt-4 text-sm text-slate-300">Last updated: August 6, 2026</p>
      </div>

      <div className="space-y-4 rounded border border-slateBlue/70 bg-[#141a24] p-8 text-sm leading-7 text-slate-300">
        <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-silver">Acceptance</h3>
        <p>
          By using this site, you agree to follow these terms and all community rules enforced by Vaspirian Legion administration.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Account Linking and Consent</h3>
        <p>
          When you link a Roblox account or authenticate through Discord, you consent to the retrieval and processing of the minimum account
          data required for roster management, rank verification, and application review.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Acceptable Use</h3>
        <p>
          You agree not to misuse this service, attempt unauthorized access, submit fraudulent application data, or disrupt platform features,
          moderation tools, or other community members.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Administrative Rights</h3>
        <p>
          Administrative staff may review, approve, deny, or remove entries related to roster, applications, and rank data as needed to
          maintain operational integrity and community safety.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Disclaimer and Liability</h3>
        <p>
          This service is provided on an as-is basis for community use. We make no guarantee of uninterrupted availability and are not liable
          for losses resulting from outages, third-party API failures, or account issues outside our control.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Changes to Terms</h3>
        <p>
          These terms may be updated at any time. Continued use of this site after changes are published constitutes acceptance of the updated terms.
        </p>
      </div>
    </section>
  );
}
