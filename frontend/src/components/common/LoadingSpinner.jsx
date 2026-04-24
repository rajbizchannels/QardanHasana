export default function LoadingSpinner({ fullScreen, size = 'md', text }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };

  const spinner = (
    <div className="flex flex-col items-center gap-3">
      <div className={`${sizes[size]} border-4 border-primary-200 border-t-primary-900 rounded-full animate-spin`} />
      {text && <p className="text-dark-500 text-sm">{text}</p>}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white z-50">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-primary-900 rounded-lg flex items-center justify-center">
              <span className="text-gold-400 font-bold text-sm">QH</span>
            </div>
            <span className="text-primary-900 font-bold text-xl">Qardan Hasana</span>
          </div>
          {spinner}
        </div>
      </div>
    );
  }

  return spinner;
}
