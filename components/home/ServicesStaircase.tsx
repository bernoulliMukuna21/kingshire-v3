const jobs = [
  "Cleaning",
  "Gardening",
  "Graphic Design",
  "Photography",
  "Tutoring",
  "Plumbing",
  "Catering",
  "Web Design",
];

// A stepped "staircase" of job types. Each label ripples bright→dim across the
// steps via a staggered CSS fade (animation-delay per index).
export default function ServicesStaircase() {
  return (
    <section className="overflow-hidden bg-[#0f1e42] py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-blue-300/70">
          What your community offers
        </p>
        <h2 className="mt-3 text-center text-2xl font-black text-white sm:text-3xl">
          One place for every kind of job
        </h2>
        <div className="mt-12 flex flex-wrap items-end justify-center gap-x-3 gap-y-5 sm:gap-x-5">
          {jobs.map((job, i) => (
            <span
              key={job}
              className="animate-stair rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white sm:text-base"
              style={{
                marginBottom: `${i * 13}px`,
                animationDelay: `${i * 0.22}s`,
              }}
            >
              {job}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
