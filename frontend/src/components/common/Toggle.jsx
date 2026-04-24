export default function Toggle({ checked, onChange, disabled, label, id }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none" htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only"
          checked={!!checked}
          onChange={(e) => onChange?.(e.target.checked)}
          disabled={disabled}
        />
        <div className={`w-11 h-6 rounded-full transition-colors duration-200 ${checked ? 'bg-primary-800' : 'bg-dark-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`} />
        <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
      {label && <span className="text-sm text-dark-700">{label}</span>}
    </label>
  );
}
