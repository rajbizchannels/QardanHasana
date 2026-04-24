export default function Pagination({ page, totalPages, total, limit, onPageChange }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <p className="text-dark-500">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="px-2 py-1 rounded border border-dark-200 hover:bg-dark-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ←
        </button>
        {start > 1 && <><button onClick={() => onPageChange(1)} className="px-2 py-1 rounded border border-dark-200 hover:bg-dark-100">1</button><span className="px-1">…</span></>}
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`px-2.5 py-1 rounded border ${p === page ? 'bg-primary-900 text-white border-primary-900' : 'border-dark-200 hover:bg-dark-100'}`}
          >
            {p}
          </button>
        ))}
        {end < totalPages && <><span className="px-1">…</span><button onClick={() => onPageChange(totalPages)} className="px-2 py-1 rounded border border-dark-200 hover:bg-dark-100">{totalPages}</button></>}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="px-2 py-1 rounded border border-dark-200 hover:bg-dark-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          →
        </button>
      </div>
    </div>
  );
}
