const services = [
  "Web Design",
  "Photography",
  "Cleaning",
  "IT Support",
  "Graphic Design",
  "Plumbing",
  "Video Editing",
  "Tutoring",
  "Catering",
  "Social Media",
  "Carpentry",
  "Translation",
  "Music Lessons",
  "Accounting",
  "Driving",
];

export default function ServicesMarquee() {
  return (
    <div className="bg-[#1a2e5a] py-5 overflow-hidden border-y border-white/5">
      <div className="flex gap-0">
        <div className="flex gap-8 animate-marquee whitespace-nowrap">
          {[...services, ...services].map((service, i) => (
            <span
              key={i}
              className="text-white/40 text-sm font-medium flex items-center gap-8"
            >
              {service}
              <span className="w-1 h-1 bg-blue-500/60 rounded-full inline-block" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
