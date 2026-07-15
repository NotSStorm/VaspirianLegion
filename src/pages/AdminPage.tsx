import { useState } from 'react';

const members = [
  { username: 'discord-user', role: 'admin' },
  { username: 'recruit-1', role: 'officer' },
  { username: 'applicant-2', role: 'member' }
];

export default function AdminPage() {
  const [selectedRole, setSelectedRole] = useState('admin');

  return (
    <section className="space-y-8">
      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">Administration</div>
        <h2 className="mt-2 text-3xl font-semibold uppercase tracking-[0.2em] text-silver">Admin Panel</h2>
      </div>

      <div className="rounded border border-slateBlue/70 bg-[#141a24] p-6">
        <h3 className="text-lg font-semibold uppercase tracking-[0.3em] text-silver">Linked Accounts</h3>
        <div className="mt-4 space-y-3">
          {members.map((member) => (
            <div key={member.username} className="flex flex-wrap items-center justify-between gap-3 rounded border border-slateBlue/60 p-3">
              <div>
                <div className="font-semibold text-silver">{member.username}</div>
                <div className="text-sm text-slate-400">{member.role}</div>
              </div>
              <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className="rounded border border-slateBlue/60 bg-[#0d121b] px-3 py-2 text-sm text-silver">
                <option value="member">member</option>
                <option value="officer">officer</option>
                <option value="admin">admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
