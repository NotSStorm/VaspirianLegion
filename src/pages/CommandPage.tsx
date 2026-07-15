import CommandSlotCard from '../components/shared/CommandSlotCard';

const tiers = [
  { title: 'Grand Battery Command', slots: [{ title: 'Commanding Officer', assigned: 'S-Lt. Jolyne Valeryon', filled: true }, { title: 'Executive Officer', assigned: 'S-Lt. Lurac_Case', filled: true }, { title: 'Battery Assistant', assigned: 'Regal_Case', filled: true }] },
  { title: '82nd Pirkland', slots: [{ title: 'Commander', assigned: 'Ens. Wūlrīc Valeryon', filled: true }, { title: 'Executive', assigned: 'SSgt. weaponizedbrick', filled: true }, { title: 'Security Slot', filled: false }] },
  { title: '87th Melrose', slots: [{ title: 'Commander', assigned: 'SgtM. Askel Amar Aït-Zenata', filled: true }, { title: 'Executive', assigned: 'SSgt. Jorge Jørgensen', filled: true }, { title: 'Gun Team III', filled: false }] }
];

export default function CommandPage() {
  return (
    <section className="space-y-6">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Command Structure</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">ORBAT</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div key={tier.title} className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
            <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">{tier.title}</h3>
            <div className="mt-4 space-y-3">
              {tier.slots.map((slot) => (
                <CommandSlotCard key={slot.title} title={slot.title} assigned={slot.assigned} filled={slot.filled} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
