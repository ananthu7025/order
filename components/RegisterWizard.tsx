"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Factory,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Check,
  X,
  ShieldCheck,
  Clock,
  TrendingUp,
  Headphones,
  Building2,
  UploadCloud,
  CheckCircle2,
} from "lucide-react";

const STEPS = ["Basic Information", "Business Details", "Verification", "Complete"] as const;

const FEATURES = [
  {
    icon: ShieldCheck,
    color: "var(--blue)",
    bg: "var(--blue-light)",
    title: "Verified Buyers",
    desc: "Connect with serious buyers looking for bulk quantities.",
  },
  {
    icon: Clock,
    color: "var(--green)",
    bg: "var(--green-light)",
    title: "Timely Payments",
    desc: "Secure payments and faster settlements.",
  },
  {
    icon: TrendingUp,
    color: "var(--amber)",
    bg: "var(--amber-light)",
    title: "Grow Your Business",
    desc: "Increase capacity utilization and sales.",
  },
  {
    icon: Headphones,
    color: "var(--purple, #7c3aed)",
    bg: "var(--purple-light, #f5f3ff)",
    title: "Dedicated Support",
    desc: "Our team is here to support you at every step.",
  },
];

type BasicInfo = {
  fullName: string;
  email: string;
  countryCode: string;
  mobile: string;
  password: string;
  confirmPassword: string;
  agreedToTerms: boolean;
};

type BusinessDetails = {
  companyName: string;
  businessType: string;
  gstin: string;
  registrationNumber: string;
  yearOfEstablishment: string;
  numberOfEmployees: string;
  registeredAddress: string;
};

type VerificationInfo = {
  panNumber: string;
  panDocument: File | null;
  gstCertificate: File | null;
  businessRegistrationCertificate: File | null;
  additionalDocumentType: string;
  additionalDocument: File | null;
};

const EMPTY_BASIC: BasicInfo = {
  fullName: "",
  email: "",
  countryCode: "+91",
  mobile: "",
  password: "",
  confirmPassword: "",
  agreedToTerms: false,
};

const EMPTY_BUSINESS: BusinessDetails = {
  companyName: "",
  businessType: "",
  gstin: "",
  registrationNumber: "",
  yearOfEstablishment: "",
  numberOfEmployees: "",
  registeredAddress: "",
};

const EMPTY_VERIFICATION: VerificationInfo = {
  panNumber: "",
  panDocument: null,
  gstCertificate: null,
  businessRegistrationCertificate: null,
  additionalDocumentType: "",
  additionalDocument: null,
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 60 }, (_, i) => CURRENT_YEAR - i);
const EMPLOYEE_RANGES = ["1 - 10", "11 - 50", "50 - 100", "100 - 500", "500+"];
const BUSINESS_TYPES = ["Manufacturer", "Trader", "Wholesaler", "Distributor", "Exporter"];

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function validateBasic(values: BasicInfo): string | null {
  if (!values.fullName.trim()) return "Full name is required";
  if (!/^\S+@\S+\.\S+$/.test(values.email)) return "Enter a valid email address";
  if (!values.mobile.trim() || values.mobile.trim().length < 6) return "Enter a valid mobile number";
  const checks = passwordChecks(values.password);
  if (!Object.values(checks).every(Boolean)) return "Password does not meet all requirements";
  if (values.password !== values.confirmPassword) return "Passwords do not match";
  if (!values.agreedToTerms) return "You must agree to the Terms & Conditions and Privacy Policy";
  return null;
}

function validateBusiness(values: BusinessDetails): string | null {
  if (!values.companyName.trim()) return "Company / business name is required";
  if (!values.businessType) return "Select a business type";
  if (!values.yearOfEstablishment) return "Select a year of establishment";
  if (!values.numberOfEmployees) return "Select the number of employees";
  if (!values.registeredAddress.trim()) return "Registered address is required";
  return null;
}

function validateVerification(values: VerificationInfo): string | null {
  if (!values.panNumber.trim()) return "Authorized person PAN is required";
  if (!values.panDocument) return "Upload the PAN document";
  return null;
}

export function RegisterWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [basic, setBasic] = useState<BasicInfo>(EMPTY_BASIC);
  const [business, setBusiness] = useState<BusinessDetails>(EMPTY_BUSINESS);
  const [verification, setVerification] = useState<VerificationInfo>(EMPTY_VERIFICATION);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  function updateBasic<K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) {
    setBasic((prev) => ({ ...prev, [key]: value }));
  }
  function updateBusiness<K extends keyof BusinessDetails>(key: K, value: BusinessDetails[K]) {
    setBusiness((prev) => ({ ...prev, [key]: value }));
  }
  function updateVerification<K extends keyof VerificationInfo>(key: K, value: VerificationInfo[K]) {
    setVerification((prev) => ({ ...prev, [key]: value }));
  }

  function goNext() {
    setStepError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }
  function goBack() {
    setStepError(null);
    setStep((s) => Math.max(s - 1, 0));
  }

  function handleBasicContinue() {
    const err = validateBasic(basic);
    if (err) {
      setStepError(err);
      return;
    }
    goNext();
  }

  function handleBusinessContinue() {
    const err = validateBusiness(business);
    if (err) {
      setStepError(err);
      return;
    }
    goNext();
  }

  async function handleVerificationContinue() {
    const err = validateVerification(verification);
    if (err) {
      setStepError(err);
      return;
    }

    setSubmitting(true);
    setStepError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: basic.fullName,
          email: basic.email,
          countryCode: basic.countryCode,
          mobile: basic.mobile,
          password: basic.password,
          companyName: business.companyName,
          businessType: business.businessType,
          gstin: business.gstin || undefined,
          registrationNumber: business.registrationNumber || undefined,
          yearOfEstablishment: business.yearOfEstablishment,
          numberOfEmployees: business.numberOfEmployees,
          registeredAddress: business.registeredAddress,
          panNumber: verification.panNumber,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to create account");
      }

      setRegistered(true);
      goNext();
    } catch (err) {
      setStepError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setSubmitting(false);
    }
  }

  function goToDashboard() {
    router.push("/dashboard");
    router.refresh();
  }

  const checks = passwordChecks(basic.password);

  return (
    <div className="auth-page">
      <div className="row g-0">
        <div className="col-lg-4 auth-side">
          <div className="auth-side-logo">
            <div className="mark">
              <Factory size={20} />
            </div>
            <div>
              <div className="brand-name">MOQ Pool</div>
              <div className="brand-tag">Smart Manufacturing. Stronger Together.</div>
            </div>
          </div>

          <div className="auth-side-heading">
            Join thousands of manufacturers growing their business with MOQ Pool
          </div>
          <p className="auth-side-copy">
            Connect with verified buyers, get bulk orders, and grow your manufacturing capacity.
          </p>

          <div className="auth-feature-list">
            {FEATURES.map((f) => (
              <div className="auth-feature" key={f.title}>
                <div className="auth-feature-icon" style={{ background: f.bg, color: f.color }}>
                  <f.icon />
                </div>
                <div>
                  <div className="auth-feature-title">{f.title}</div>
                  <div className="auth-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="auth-side-illustration">
            <Building2 size={120} strokeWidth={1} color="var(--blue-border)" />
          </div>
        </div>

        <div className="col-lg-8 auth-form-side">
          <div className="auth-form-wrap">
            <div className="auth-form-header">
              <h1>Create your manufacturer account</h1>
              <p>Fill in the details below to get started</p>
            </div>

            <div className="stepper auth-stepper">
              {STEPS.map((label, i) => (
                <div className="d-flex align-items-center flex-grow-1" key={label} style={{ flex: i === STEPS.length - 1 ? "0 0 auto" : 1 }}>
                  <div className={`step${i === step ? " active" : ""}${i < step ? " done" : ""}`} style={{ flexDirection: "column", alignItems: "center", gap: 6 }}>
                    <div className="step-circle">{i < step ? <Check size={14} /> : i + 1}</div>
                    <div className="step-label">{label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`step-line${i < step ? " done" : ""}`} style={{ marginBottom: 20 }} />}
                </div>
              ))}
            </div>

            <div className="card card-pad">
              {stepError && step < 3 && (
                <div className="banner banner-amber" style={{ marginBottom: 18 }}>
                  {stepError}
                </div>
              )}

              {step === 0 && (
                <BasicInfoStep
                  values={basic}
                  onChange={updateBasic}
                  showPassword={showPassword}
                  setShowPassword={setShowPassword}
                  showConfirmPassword={showConfirmPassword}
                  setShowConfirmPassword={setShowConfirmPassword}
                  checks={checks}
                  onContinue={handleBasicContinue}
                />
              )}
              {step === 1 && (
                <BusinessDetailsStep values={business} onChange={updateBusiness} onBack={goBack} onContinue={handleBusinessContinue} />
              )}
              {step === 2 && (
                <VerificationStep
                  values={verification}
                  onChange={updateVerification}
                  onBack={goBack}
                  onContinue={handleVerificationContinue}
                  submitting={submitting}
                />
              )}
              {step === 3 && registered && <CompleteStep basic={basic} business={business} onGoToDashboard={goToDashboard} />}
            </div>

            {step === 0 && (
              <p className="text-center text-sm text-muted" style={{ marginTop: 18 }}>
                Already have an account? <a href="/login" style={{ color: "var(--blue)", fontWeight: 600 }}>Sign in</a>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="field-label">
      {children} {required && <span style={{ color: "var(--red)" }}>*</span>}
    </label>
  );
}

function BasicInfoStep({
  values,
  onChange,
  showPassword,
  setShowPassword,
  showConfirmPassword,
  setShowConfirmPassword,
  checks,
  onContinue,
}: {
  values: BasicInfo;
  onChange: <K extends keyof BasicInfo>(key: K, value: BasicInfo[K]) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  showConfirmPassword: boolean;
  setShowConfirmPassword: (v: boolean) => void;
  checks: Record<"length" | "upper" | "lower" | "number" | "special", boolean>;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="auth-section-title">Basic Information</div>
      <div style={{ height: 1, background: "var(--border)", margin: "12px 0 18px" }} />

      <div className="row row-cols-1 row-cols-md-2 g-3">
        <div className="col">
          <FieldLabel required>Full Name</FieldLabel>
          <div className="input-icon-wrap">
            <User className="field-icon" />
            <input
              className="input"
              placeholder="Enter your full name"
              value={values.fullName}
              onChange={(e) => onChange("fullName", e.target.value)}
            />
          </div>
        </div>
        <div className="col">
          <FieldLabel required>Email Address</FieldLabel>
          <div className="input-icon-wrap">
            <Mail className="field-icon" />
            <input
              className="input"
              type="email"
              placeholder="Enter your email address"
              value={values.email}
              onChange={(e) => onChange("email", e.target.value)}
            />
          </div>
        </div>
        <div className="col">
          <FieldLabel required>Mobile Number</FieldLabel>
          <div className="phone-input-group">
            <div className="country-code">🇮🇳 {values.countryCode}</div>
            <Phone className="field-icon" />
            <input
              className="input"
              placeholder="Enter mobile number"
              value={values.mobile}
              onChange={(e) => onChange("mobile", e.target.value)}
            />
          </div>
        </div>
        <div className="col">
          <FieldLabel required>Password</FieldLabel>
          <div className="input-icon-wrap">
            <Lock className="field-icon" />
            <input
              className="input has-toggle"
              type={showPassword ? "text" : "password"}
              placeholder="Create a strong password"
              value={values.password}
              onChange={(e) => onChange("password", e.target.value)}
            />
            <button type="button" className="input-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div className="col">
          <FieldLabel required>Confirm Password</FieldLabel>
          <div className="input-icon-wrap">
            <Lock className="field-icon" />
            <input
              className="input has-toggle"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm your password"
              value={values.confirmPassword}
              onChange={(e) => onChange("confirmPassword", e.target.value)}
            />
            <button
              type="button"
              className="input-toggle"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label="Toggle password visibility"
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>

      <div className="password-checklist" style={{ marginTop: 16 }}>
        <div className="password-checklist-title">Password must contain:</div>
        <div className="password-checklist-grid">
          <ChecklistItem met={checks.length}>At least 8 characters</ChecklistItem>
          <ChecklistItem met={checks.lower}>One lowercase letter (a-z)</ChecklistItem>
          <ChecklistItem met={checks.upper}>One uppercase letter (A-Z)</ChecklistItem>
          <ChecklistItem met={checks.number}>One number (0-9)</ChecklistItem>
          <ChecklistItem met={checks.special}>One special character (#@$%^&*)</ChecklistItem>
        </div>
      </div>

      <label className="checkbox-row" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={values.agreedToTerms} onChange={(e) => onChange("agreedToTerms", e.target.checked)} />
        <span>
          I agree to the <a href="#" style={{ color: "var(--blue)", fontWeight: 600 }}>Terms &amp; Conditions</a> and{" "}
          <a href="#" style={{ color: "var(--blue)", fontWeight: 600 }}>Privacy Policy</a> <span style={{ color: "var(--red)" }}>*</span>
        </span>
      </label>

      <div className="d-flex justify-content-end" style={{ marginTop: 22 }}>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continue →
        </button>
      </div>
    </>
  );
}

function ChecklistItem({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <div className={`password-checklist-item${met ? " met" : ""}`}>
      {met ? <Check /> : <X />}
      {children}
    </div>
  );
}

function BusinessDetailsStep({
  values,
  onChange,
  onBack,
  onContinue,
}: {
  values: BusinessDetails;
  onChange: <K extends keyof BusinessDetails>(key: K, value: BusinessDetails[K]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="auth-section-title">Business Details</div>
      <p className="auth-section-subtitle">Tell us more about your manufacturing business</p>

      <div className="row row-cols-1 row-cols-md-2 g-3">
        <div className="col">
          <FieldLabel required>Company / Business Name</FieldLabel>
          <input
            className="input"
            placeholder="Enter company or business name"
            value={values.companyName}
            onChange={(e) => onChange("companyName", e.target.value)}
          />
        </div>
        <div className="col">
          <FieldLabel required>Business Type</FieldLabel>
          <select className="input" value={values.businessType} onChange={(e) => onChange("businessType", e.target.value)}>
            <option value="">Select business type</option>
            {BUSINESS_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="col">
          <FieldLabel>GST Number (Optional)</FieldLabel>
          <input className="input" placeholder="Enter GST number" value={values.gstin} onChange={(e) => onChange("gstin", e.target.value)} />
        </div>
        <div className="col">
          <FieldLabel>Company Registration Number (Optional)</FieldLabel>
          <input
            className="input"
            placeholder="Enter registration number"
            value={values.registrationNumber}
            onChange={(e) => onChange("registrationNumber", e.target.value)}
          />
        </div>
        <div className="col">
          <FieldLabel required>Year of Establishment</FieldLabel>
          <select className="input" value={values.yearOfEstablishment} onChange={(e) => onChange("yearOfEstablishment", e.target.value)}>
            <option value="">Select year</option>
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="col">
          <FieldLabel required>Number of Employees</FieldLabel>
          <select className="input" value={values.numberOfEmployees} onChange={(e) => onChange("numberOfEmployees", e.target.value)}>
            <option value="">Select number of employees</option>
            {EMPLOYEE_RANGES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <FieldLabel required>Registered Address</FieldLabel>
        <textarea
          className="ui-textarea"
          placeholder="Enter your complete registered address"
          value={values.registeredAddress}
          onChange={(e) => onChange("registeredAddress", e.target.value)}
        />
      </div>

      <div className="d-flex justify-content-between" style={{ marginTop: 22 }}>
        <button type="button" className="btn btn-outline" onClick={onBack}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onContinue}>
          Continue →
        </button>
      </div>
    </>
  );
}

function UploadField({
  label,
  hint,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  return (
    <label className={`upload-box${file ? " has-file" : ""}`}>
      <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
      <UploadCloud />
      <div className="upload-label">{file ? file.name : label}</div>
      <div className="upload-hint">{hint}</div>
    </label>
  );
}

function VerificationStep({
  values,
  onChange,
  onBack,
  onContinue,
  submitting,
}: {
  values: VerificationInfo;
  onChange: <K extends keyof VerificationInfo>(key: K, value: VerificationInfo[K]) => void;
  onBack: () => void;
  onContinue: () => void;
  submitting: boolean;
}) {
  return (
    <>
      <div className="auth-section-title">Verification</div>
      <p className="auth-section-subtitle">Verify your identity and business to access all features</p>

      <div className="text-label" style={{ marginBottom: 10 }}>
        Identity Verification
      </div>
      <div className="row row-cols-1 row-cols-md-2 g-3">
        <div className="col">
          <FieldLabel required>Authorized Person PAN</FieldLabel>
          <input
            className="input"
            placeholder="Enter PAN number"
            value={values.panNumber}
            onChange={(e) => onChange("panNumber", e.target.value)}
          />
        </div>
        <div className="col">
          <FieldLabel required>PAN Document</FieldLabel>
          <UploadField
            label="Upload PAN Card"
            hint="JPG, PNG or PDF (Max. 5MB)"
            file={values.panDocument}
            onChange={(f) => onChange("panDocument", f)}
          />
        </div>
        <div className="col">
          <FieldLabel>GST Certificate (If applicable)</FieldLabel>
          <UploadField
            label="Upload GST Certificate"
            hint="JPG, PNG or PDF (Max. 5MB)"
            file={values.gstCertificate}
            onChange={(f) => onChange("gstCertificate", f)}
          />
        </div>
        <div className="col">
          <FieldLabel>Business Registration Certificate (If applicable)</FieldLabel>
          <UploadField
            label="Upload Certificate"
            hint="JPG, PNG or PDF (Max. 5MB)"
            file={values.businessRegistrationCertificate}
            onChange={(f) => onChange("businessRegistrationCertificate", f)}
          />
        </div>
        <div className="col">
          <FieldLabel>Additional Document (Optional)</FieldLabel>
          <select
            className="input"
            value={values.additionalDocumentType}
            onChange={(e) => onChange("additionalDocumentType", e.target.value)}
          >
            <option value="">Select document type</option>
            <option value="Trade License">Trade License</option>
            <option value="Factory License">Factory License</option>
            <option value="ISO Certificate">ISO Certificate</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="col">
          <FieldLabel>Upload Document</FieldLabel>
          <UploadField
            label="Upload Document"
            hint="JPG, PNG or PDF (Max. 5MB)"
            file={values.additionalDocument}
            onChange={(f) => onChange("additionalDocument", f)}
          />
        </div>
      </div>

      <div className="banner banner-blue" style={{ marginTop: 18 }}>
        <ShieldCheck />
        <div>
          <strong>Your documents are safe with us.</strong>
          <div>We use bank-level encryption to protect your data and documents.</div>
        </div>
      </div>

      <div className="d-flex justify-content-between" style={{ marginTop: 22 }}>
        <button type="button" className="btn btn-outline" onClick={onBack} disabled={submitting}>
          ← Back
        </button>
        <button type="button" className="btn btn-primary" onClick={onContinue} disabled={submitting}>
          {submitting ? "Creating account…" : "Continue →"}
        </button>
      </div>
    </>
  );
}

function CompleteStep({
  basic,
  business,
  onGoToDashboard,
}: {
  basic: BasicInfo;
  business: BusinessDetails;
  onGoToDashboard: () => void;
}) {
  return (
    <>
      <div className="success-icon-wrap">
        <CheckCircle2 />
      </div>
      <div className="auth-success-title">Almost done!</div>
      <p className="auth-success-copy">
        Your manufacturer account has been created successfully. Please review your details and complete the registration.
      </p>

      <div className="summary-card">
        <div className="summary-grid">
          <SummaryItem label="Full Name" value={basic.fullName || "—"} />
          <SummaryItem label="GST Number" value={business.gstin || "—"} />
          <SummaryItem label="Email Address" value={basic.email || "—"} />
          <SummaryItem label="Year of Establishment" value={business.yearOfEstablishment || "—"} />
          <SummaryItem label="Mobile Number" value={basic.mobile ? `${basic.countryCode} ${basic.mobile}` : "—"} />
          <SummaryItem label="Employees" value={business.numberOfEmployees || "—"} />
          <SummaryItem label="Company Name" value={business.companyName || "—"} />
          <SummaryItem label="Registered Address" value={business.registeredAddress || "—"} />
          <SummaryItem label="Business Type" value={business.businessType || "—"} />
        </div>
      </div>

      <div className="banner banner-blue" style={{ marginTop: 18 }}>
        <ShieldCheck />
        <div>
          <strong>Your account is under review.</strong>
          <div>We will verify your information and documents. You will receive an email/SMS once your account is verified.</div>
        </div>
      </div>

      <div className="d-flex justify-content-end" style={{ marginTop: 22 }}>
        <button type="button" className="btn btn-primary" onClick={onGoToDashboard}>
          Go to Dashboard →
        </button>
      </div>
    </>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="summary-item-label">{label}</div>
      <div className="summary-item-value">{value}</div>
    </div>
  );
}
