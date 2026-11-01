export default function Placeholder({ note }: { note: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {note}
    </div>
  );
}
