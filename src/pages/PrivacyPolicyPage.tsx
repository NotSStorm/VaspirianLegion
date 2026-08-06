export default function PrivacyPolicyPage() {
  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Legal</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Privacy Policy</h2>
        <p className="mt-4 text-sm text-slate-300">Last updated: August 6, 2026</p>
      </div>

      <div className="space-y-4 rounded border border-slateBlue/70 bg-[#141a24] p-8 text-sm leading-7 text-slate-300">
        <h3 className="text-lg font-semibold uppercase tracking-[0.2em] text-silver">Data We Collect</h3>
        <p>
          We collect only the information needed to operate enlistment, roster management, and rank verification features for the Vaspirian Legion community.
          This may include Roblox account identifiers (such as Roblox ID and username), Discord account identifiers, application form responses,
          and battle or participation records submitted through this site.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">How We Use Data</h3>
        <p>
          Collected data is used to process applications, verify Roblox group rank eligibility, manage roster status, support moderation and
          administrative workflows, and display community statistics.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Data Sharing</h3>
        <p>
          We do not sell personal data. Data is shared only with the services required to operate this experience, such as Roblox APIs,
          Discord authentication, and our database and hosting providers.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Data Retention</h3>
        <p>
          We retain data for as long as needed to maintain community records, application history, and roster integrity, unless removal is
          required by law or approved by administration policy.
        </p>

        <h3 className="pt-2 text-lg font-semibold uppercase tracking-[0.2em] text-silver">Contact</h3>
        <p>
          For privacy-related requests, contact the Vaspirian Legion administrative team through official community channels.
        </p>
      </div>
    </section>
  );
}
