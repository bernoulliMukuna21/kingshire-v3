"use client";

export function BudgetField({
  budget,
  onChange,
  error,
}: {
  budget: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <>
      <h3 className="border-b-2 border-gray-300 pb-1.5 text-sm font-bold text-gray-900">
        Budget
      </h3>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Total budget (£) <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
            £
          </span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            inputMode="decimal"
            value={budget}
            onChange={(e) => onChange(e.target.value)}
            className={`w-full pl-8 pr-4 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:border-transparent text-sm transition-all ${
              error
                ? "border-red-400 focus:ring-red-300"
                : "border-gray-200 focus:ring-blue-500"
            }`}
            placeholder="0"
          />
        </div>
        {error ? (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        ) : (
          <p className="text-xs text-gray-400 mt-1">
            The total price for the whole job — held in escrow once you select a
            Kinglancer.
          </p>
        )}
      </div>
    </>
  );
}
