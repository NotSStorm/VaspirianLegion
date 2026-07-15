import { useState } from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export default function ApplyPage() {
  const [serviceNumber, setServiceNumber] = useState('PVT-');
  const [callsign, setCallsign] = useState('');
  const [timezone, setTimezone] = useState('');

  return (
    <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">[ Enlistment ]</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Enlistment / Re-enlistment</h2>
        <p className="mt-4 text-slate-300">A new application is queued for review and does not immediately grant membership.</p>

        <div className="mt-6 rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-200">
          <div className="font-semibold uppercase tracking-[0.3em]">Request to Join the Battery</div>
          <p className="mt-2">Please send a request to the Roblox group before applying.</p>
        </div>

        <div className="mt-6 grid gap-4">
          <label>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Service Number</div>
            <input value={serviceNumber} onChange={(e) => setServiceNumber(e.target.value)} className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-silver" />
          </label>
          <label>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Field Name / Callsign</div>
            <input value={callsign} onChange={(e) => setCallsign(e.target.value)} className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-silver" />
          </label>
          <label>
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Timezone</div>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-silver" placeholder="e.g. EST, CST, GMT" />
          </label>
          <button className="rounded border border-silver/50 bg-silver px-4 py-3 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue">Submit Application</button>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/30"><ShieldCheck className="h-5 w-5 text-silver" /></div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Recruit</div>
              <div className="font-semibold text-silver">Roblox Username</div>
            </div>
          </div>
          <div className="mt-4 space-y-3 text-sm text-slate-300">
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Status</div><div className="font-semibold text-silver">Applicant</div></div>
            <div className="rounded border border-slateBlue/60 p-3"><div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Discord</div><div className="font-semibold text-silver">@discord-user</div></div>
          </div>
        </div>

        <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
          <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Verification Checklist</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Discord linked</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" />In unit Discord server</li>
            <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-amber-400" />Minimum group rank met</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
