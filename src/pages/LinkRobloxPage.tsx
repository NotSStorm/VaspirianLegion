import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

export default function LinkRobloxPage() {
  const [username, setUsername] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const generatedCode = useMemo(() => (code ? code : `LEGION-${Math.floor(Math.random() * 0x1000000).toString(16).toUpperCase()}`), [code]);

  const handleGenerate = () => {
    setCode(generatedCode);
  };

  return (
    <section className="flex min-h-[70vh] items-center justify-center">
      <div className="w-full max-w-2xl rounded border border-slateBlue/70 bg-[#141a24] p-8">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-silver/40 bg-slateBlue/30"><ShieldCheck className="h-6 w-6 text-silver" /></div>
        </div>
        <div className="text-center text-[10px] uppercase tracking-[0.35em] text-slate-400">Temporary Verification</div>
        <h2 className="mt-2 text-center text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Link Your Roblox Account</h2>
        <p className="mt-4 text-center text-slate-300">This temporary profile-bio verification method will be replaced by one-click Roblox OAuth once approval is granted.</p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <label className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Your Roblox Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-2 w-full rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-silver" />
            <button onClick={handleGenerate} className="mt-4 rounded border border-silver/50 bg-silver px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-slateBlue">Get My Code</button>
          </div>
          <div className="rounded border border-slateBlue/60 bg-[#0d121b] p-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Verification Code</div>
            <div className="mt-2 rounded border border-silver/30 bg-slateBlue/20 p-3 font-mono text-lg text-silver">{generatedCode}</div>
            <p className="mt-4 text-sm text-slate-300">Paste this code into your Roblox profile About section, save it, and confirm.</p>
            <button className="mt-4 rounded border border-slateBlue/70 px-4 py-2 text-sm font-semibold uppercase tracking-[0.3em] text-silver">Confirm</button>
          </div>
        </div>
      </div>
    </section>
  );
}
