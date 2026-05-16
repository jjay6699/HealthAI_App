import React, { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import { COUNTRIES } from "../../data/countries";
import { useI18n } from "../../i18n";
import { persistentStorage } from "../../services/persistentStorage";
import { AppTheme, useTheme } from "../../theme";

const PENDING_REGISTRATION_KEY = "pendingRegistration";

const RegisterScreen = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", country: "" });
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeHealthProcessing, setAgreeHealthProcessing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countrySearchOpen, setCountrySearchOpen] = useState(false);

  const updateField = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const filteredCountries = useMemo(() => {
    const query = form.country.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter((country) => country.toLowerCase().includes(query));
  }, [form.country]);

  const selectCountry = (country: string) => {
    setForm((prev) => ({ ...prev, country }));
    setCountrySearchOpen(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!agreeTerms || !agreeHealthProcessing) return;
    setLoading(true);
    setError("");
    try {
      const consentVersion = "2026-03";
      const consentAcceptedAt = new Date().toISOString();

      const profileDraft = {
        name: form.name,
        email: form.email,
        country: form.country
      };
      sessionStorage.setItem(
        PENDING_REGISTRATION_KEY,
        JSON.stringify({
          form,
          consents: {
            termsPrivacyAccepted: agreeTerms,
            healthDataProcessingAccepted: agreeHealthProcessing,
            consentVersion,
            acceptedAt: consentAcceptedAt
          }
        })
      );
      localStorage.setItem("userProfile", JSON.stringify(profileDraft));
      persistentStorage.setJSON("userConsents", {
        termsPrivacyAccepted: true,
        healthDataProcessingAccepted: true,
        researchParticipation: false,
        marketingCommunication: false,
        policyVersion: consentVersion,
        acceptedAt: consentAcceptedAt
      });
      setLoading(false);
      navigate("/intake");
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "Unable to create account right now.");
    }
  };

  return (
    <div style={styles.wrapper}>
      <h1 style={styles.heading}>{t("auth.register.heading")}</h1>
      <p style={styles.subheading}>{t("auth.register.subheading")}</p>

      <form style={styles.form} onSubmit={handleSubmit}>
        {error ? <p style={styles.error}>{error}</p> : null}
        <label style={styles.label} htmlFor="name">
          {t("auth.register.name")}
        </label>
        <input
          id="name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={updateField("name")}
          style={styles.input}
        />

        <label style={styles.label} htmlFor="register-email">
          Email
        </label>
        <input
          id="register-email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={updateField("email")}
          style={styles.input}
        />

        <label style={styles.label} htmlFor="register-password">
          {t("auth.login.password")}
        </label>
        <input
          id="register-password"
          type="password"
          placeholder="********"
          value={form.password}
          onChange={updateField("password")}
          style={styles.input}
        />
        <span style={styles.helper}>{t("auth.register.helper")}</span>

        <label style={styles.label} htmlFor="register-country">
          {t("auth.register.country")}
        </label>
        <div style={styles.countryCombobox}>
          <input
            id="register-country"
            placeholder="Search country or region"
            value={form.country}
            onChange={(event) => {
              updateField("country")(event);
              setCountrySearchOpen(true);
            }}
            onFocus={() => setCountrySearchOpen(true)}
            onBlur={() => window.setTimeout(() => setCountrySearchOpen(false), 120)}
            style={{ ...styles.input, ...styles.countryInput }}
            autoComplete="country-name"
            role="combobox"
            aria-expanded={countrySearchOpen}
            aria-controls="register-country-options"
          />
          <button
            type="button"
            style={styles.countryToggle}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setCountrySearchOpen((current) => !current)}
            aria-label="Show countries"
          >
            {countrySearchOpen ? "^" : "v"}
          </button>
          {countrySearchOpen ? (
            <div id="register-country-options" role="listbox" style={styles.countryMenu}>
              {filteredCountries.length > 0 ? (
                filteredCountries.map((country) => (
                  <button
                    key={country}
                    type="button"
                    role="option"
                    aria-selected={form.country === country}
                    style={{
                      ...styles.countryOption,
                      ...(form.country === country ? styles.countryOptionSelected : {})
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectCountry(country)}
                  >
                    {country}
                  </button>
                ))
              ) : (
                <p style={styles.countryEmpty}>No country found.</p>
              )}
            </div>
          ) : null}
        </div>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={agreeTerms}
            onChange={(event) => setAgreeTerms(event.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.checkboxLabel}>
            {t("auth.register.agree")} <a href="/terms" style={styles.inlineLink}>Terms</a> & <a href="/privacy" style={styles.inlineLink}>Privacy Policy</a>
          </span>
        </label>

        <label style={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={agreeHealthProcessing}
            onChange={(event) => setAgreeHealthProcessing(event.target.checked)}
            style={styles.checkbox}
          />
          <span style={styles.checkboxLabel}>{t("auth.register.healthConsent")}</span>
        </label>

        <Button
          title={t("auth.register.next")}
          type="submit"
          fullWidth
          disabled={!agreeTerms || !agreeHealthProcessing}
          loading={loading}
        />
      </form>

      <div style={styles.footerRow}>
        <span style={styles.footerText}>{t("auth.register.haveAccount")}</span>
        <Link to="/login" style={styles.link}>
          {t("auth.login.submit")}
        </Link>
      </div>
    </div>
  );
};

const createStyles = (theme: AppTheme) => ({
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    padding: `${theme.spacing.xxl}px ${theme.spacing.xl}px`
  },
  heading: {
    ...theme.typography.displayMd,
    marginBottom: theme.spacing.xs
  },
  subheading: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl
  },
  form: {
    display: "flex",
    flexDirection: "column" as const,
    gap: theme.spacing.md
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: theme.colors.text
  },
  input: {
    width: "100%",
    borderRadius: theme.radii.md,
    border: "1px solid #FFFFFF",
    backgroundColor: "#FFFFFF",
    padding: `${theme.spacing.lg}px ${theme.spacing.lg}px`,
    fontSize: 16,
    color: theme.colors.text,
    outline: "none"
  },
  countryCombobox: {
    position: "relative" as const
  },
  countryInput: {
    paddingRight: 48
  },
  countryToggle: {
    position: "absolute" as const,
    top: "50%",
    right: theme.spacing.md,
    transform: "translateY(-50%)",
    width: 30,
    height: 30,
    border: "none",
    borderRadius: theme.radii.pill,
    background: theme.colors.surface,
    color: theme.colors.primary,
    fontSize: 18,
    fontWeight: 800,
    lineHeight: "30px",
    cursor: "pointer"
  },
  countryMenu: {
    position: "absolute" as const,
    zIndex: 20,
    top: "calc(100% + 6px)",
    left: 0,
    right: 0,
    maxHeight: 260,
    overflowY: "auto" as const,
    display: "flex",
    flexDirection: "column" as const,
    borderRadius: theme.radii.lg,
    border: `1px solid ${theme.colors.divider}`,
    background: theme.colors.background,
    boxShadow: "0 18px 40px rgba(69, 48, 25, 0.14)",
    padding: theme.spacing.xs
  },
  countryOption: {
    width: "100%",
    border: "none",
    borderRadius: theme.radii.md,
    background: "transparent",
    color: theme.colors.text,
    fontFamily: "inherit",
    fontSize: 15,
    textAlign: "left" as const,
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    cursor: "pointer"
  },
  countryOptionSelected: {
    background: theme.colors.accentPeach,
    color: theme.colors.primary,
    fontWeight: 800
  },
  countryEmpty: {
    margin: 0,
    padding: `${theme.spacing.md}px`,
    color: theme.colors.textSecondary,
    fontSize: 14
  },
  helper: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: -theme.spacing.sm + 2,
    marginBottom: theme.spacing.sm
  },
  error: {
    margin: 0,
    color: theme.colors.error,
    fontSize: 14
  },
  checkboxRow: {
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    cursor: "pointer"
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    border: `1px solid ${theme.colors.background}`
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.colors.text
  },
  inlineLink: {
    color: theme.colors.primary,
    fontWeight: 600
  },
  footerRow: {
    display: "flex",
    justifyContent: "center",
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xl
  },
  footerText: {
    color: theme.colors.textSecondary,
    fontSize: 14
  },
  link: {
    color: theme.colors.primary,
    fontSize: 14,
    fontWeight: 600
  }
});

export default RegisterScreen;
