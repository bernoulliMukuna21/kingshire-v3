"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  Plus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type ServiceEntry = {
  name: string;
  rate: string;
  rate_type: "per_hour" | "per_day" | "per_project";
};

const RATE_TYPES = [
  { value: "per_hour", label: "/hr" },
  { value: "per_day", label: "/day" },
  { value: "per_project", label: "fixed" },
] as const;

const SERVICE_SUGGESTIONS = [
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
  "Accounting",
  "Music Lessons",
  "Translation",
  "Driving",
  "Other",
];

interface Props {
  profile: Profile;
}

export default function ProfileForm({ profile }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [tagline, setTagline] = useState(profile.tagline ?? "");
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolio_url ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");

  const [services, setServices] = useState<ServiceEntry[]>(() => {
    const saved = profile.services ?? [];
    return saved.length > 0
      ? saved.map((s) => ({
          name: s.name,
          rate: String(s.rate),
          rate_type: (s.rate_type as ServiceEntry["rate_type"]) ?? "per_hour",
        }))
      : [];
  });

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isKinglancer = profile.role === "kinglancer";

  const roleBadgeColor =
    profile.role === "client"
      ? "bg-blue-100 text-blue-700"
      : "bg-green-100 text-green-700";

  const roleLabel = profile.role === "client" ? "Client" : "Kinglancer";

  const addService = () =>
    setServices((prev) => [
      ...prev,
      { name: "", rate: "", rate_type: "per_hour" },
    ]);

  const removeService = (i: number) =>
    setServices((prev) => prev.filter((_, idx) => idx !== i));

  const updateService = (i: number, field: keyof ServiceEntry, value: string) =>
    setServices((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s)),
    );

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("Photo must be under 2MB.");
      return;
    }

    setAvatarUploading(true);
    setError(null);

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setError("Failed to upload photo. Please try again.");
      setAvatarUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(path);

    const freshUrl = `${urlData.publicUrl}?t=${Date.now()}`;
    setAvatarUrl(freshUrl);
    setAvatarUploading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    if (!fullName.trim()) {
      setError("Full name is required.");
      setSaving(false);
      return;
    }

    const parsedServices = services
      .filter((s) => s.name.trim() && s.rate)
      .map((s) => ({
        name: s.name.trim(),
        rate: parseFloat(s.rate) || 0,
        rate_type: s.rate_type,
      }));

    const supabase = createClient();

    const updates: Database["public"]["Tables"]["profiles"]["Update"] = {
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      location: location.trim() || null,
      bio: bio.trim() || null,
      avatar_url: avatarUrl || null,
      ...(isKinglancer && {
        tagline: tagline.trim() || null,
        services: parsedServices,
        // Sync skills from service names so filter pages still work
        skills: parsedServices.map((s) => s.name),
        portfolio_url: portfolioUrl.trim() || null,
      }),
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);

    if (updateError) {
      setError("Failed to save changes. Please try again.");
    } else {
      setSuccess(true);
      router.refresh();
    }

    setSaving(false);
  };

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Avatar */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-5">Profile Photo</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div
              onClick={handleAvatarClick}
              className={`w-20 h-20 rounded-full overflow-hidden flex items-center justify-center cursor-pointer ${isKinglancer ? "bg-linear-to-br from-green-500 to-emerald-600" : "bg-linear-to-br from-blue-500 to-indigo-600"}`}
            >
              {avatarUploading ? (
                <Loader2 size={24} className="text-white animate-spin" />
              ) : avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt="Profile photo"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white font-bold text-xl">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Camera size={13} className="text-white" />
            </button>
          </div>
          <div>
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={avatarUploading}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {avatarUploading ? "Uploading..." : "Change photo"}
            </button>
            <p className="text-xs text-gray-400 mt-0.5">
              JPG, PNG or WebP · Max 2MB
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      {/* Personal info */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-gray-900">Personal Information</h2>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${roleBadgeColor}`}
          >
            {roleLabel}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Full name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              placeholder="Your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">
              Email cannot be changed here.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              placeholder="+44 7700 000000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              placeholder="e.g. London, UK"
            />
          </div>
        </div>
      </div>

      {/* Kinglancer section */}
      {isKinglancer && (
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h2 className="font-bold text-gray-900 mb-1">Kinglancer Profile</h2>
          <p className="text-sm text-gray-500 mb-5">
            This information is visible to clients when you apply to jobs.
          </p>

          {/* Professional title */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Professional title
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              maxLength={80}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              placeholder="e.g. Freelance Web Designer · Event Photographer"
            />
            <p className="text-xs text-gray-400 mt-1">
              One line that tells clients what you do.
            </p>
          </div>

          {/* Bio */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              About me
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              maxLength={500}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all resize-none"
              placeholder="Tell clients a bit about yourself and what you offer..."
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {bio.length}/500
            </p>
          </div>

          {/* Skills */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Services &amp; Rates
            </label>
            <p className="text-xs text-gray-400 mb-3">
              Add each service you offer with its own price. Clients will see
              exactly what to expect.
            </p>

            {/* Browser-native datalist for service name suggestions */}
            <datalist id="service-suggestions">
              {SERVICE_SUGGESTIONS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>

            <div className="space-y-2">
              {services.map((svc, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  {/* Service name — free text with suggestions */}
                  <input
                    type="text"
                    list="service-suggestions"
                    value={svc.name}
                    onChange={(e) => updateService(i, "name", e.target.value)}
                    placeholder="e.g. Web Design"
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                  />

                  {/* Rate type 3-way toggle */}
                  <div className="flex">
                    {RATE_TYPES.map((rt) => (
                      <button
                        key={rt.value}
                        type="button"
                        onClick={() => updateService(i, "rate_type", rt.value)}
                        className={`px-2.5 py-2 text-xs font-semibold border transition-all cursor-pointer first:rounded-l-lg last:rounded-r-lg -ml-px first:ml-0 ${
                          svc.rate_type === rt.value
                            ? "bg-blue-600 text-white border-blue-600 z-10 relative"
                            : "bg-white text-gray-500 border-gray-200 hover:border-blue-300 hover:text-blue-600"
                        }`}
                      >
                        {rt.label}
                      </button>
                    ))}
                  </div>

                  {/* Rate amount */}
                  <div className="relative w-24 shrink-0">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm select-none">
                      £
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={svc.rate}
                      onChange={(e) => updateService(i, "rate", e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-2 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
                    />
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => removeService(i)}
                    title="Remove"
                    className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer shrink-0"
                  >
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>

            {services.length === 0 && (
              <p className="text-xs text-gray-400 mt-2 text-center py-4 border-2 border-dashed border-gray-100 rounded-xl">
                No services yet — add one below.
              </p>
            )}

            {services.length < 10 && (
              <button
                type="button"
                onClick={addService}
                className="mt-2 w-full py-2.5 flex items-center justify-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-600 transition-all cursor-pointer font-medium"
              >
                <Plus size={15} />
                Add a service
              </button>
            )}
          </div>

          {/* Portfolio URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Portfolio URL
            </label>
            <input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm transition-all"
              placeholder="https://yourportfolio.com"
            />
          </div>
        </div>
      )}

      {/* Feedback + Save */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}
          {success && !error && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle size={16} />
              Changes saved successfully.
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={saving || avatarUploading}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all hover:scale-105 text-sm shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving...
            </>
          ) : (
            "Save changes"
          )}
        </button>
      </div>
    </form>
  );
}
