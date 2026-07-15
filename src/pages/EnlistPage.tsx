import { ShieldCheck } from 'lucide-react';

const benefits = [
  'Full Kit Issue',
  'Elite Formation Status',
  'Commendation Pathway',
  'Specialized Gunnery / Engineering Training',
  'Brotherhood'
];

const requirements = ['Discord account linked', 'Roblox account linked', 'Joined the unit Discord', 'Completed basic training'];

const pipeline = ['Submit application', 'Receive review', 'Complete onboarding', 'Enter roster'];

export default function EnlistPage() {
  return (
    <section className="space-y-8">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">[ Enlistment ]</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Serve With Honor</h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Join the Grand Andouran Battery as a gunner, engineer, or field security specialist and stand ready for imperial service.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href="/login" className="rounded border border-silver/50 bg-silver px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue">Join the Battery</a>
          <a href="/enlist/apply" className="rounded border border-slateBlue/70 px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-silver">Apply Now</a>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {benefits.map((benefit) => (
          <div key={benefit} className="rounded border border-slateBlue/60 bg-[#141a24] p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Benefit</div>
            <div className="mt-2 font-semibold text-silver">{benefit}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Enlistment Requirements</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            {requirements.map((req) => (
              <li key={req} className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-silver" />{req}</li>
            ))}
          </ul>
        </div>
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Training Pipeline</h3>
          <ol className="mt-4 space-y-3 text-sm text-slate-300">
            {pipeline.map((step, index) => (
              <li key={step} className="flex gap-3"><span className="font-mono text-silver">0{index + 1}</span><span>{step}</span></li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
